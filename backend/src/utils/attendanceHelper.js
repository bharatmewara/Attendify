
import { query } from '../db.js';

/**
 * Automatically marks employees as absent for missing working days.
 * @param {number} companyId - The company ID
 * @param {number|null} employeeId - Optional specific employee ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 */
export const autoMarkAbsent = async (companyId, employeeId, startDate, endDate) => {
  try {
    // We only mark absent for dates in the past (before today)
    const today = new Date().toISOString().split('T')[0];
    const effectiveEndDate = endDate < today ? endDate : today;

    const sql = `
      INSERT INTO attendance_records (employee_id, company_id, work_date, status)
      SELECT e.id, e.company_id, gs.date::date, 'absent'
      FROM employees e
      CROSS JOIN generate_series($2::date, $3::date, '1 day'::interval) gs(date)
      JOIN employee_shifts es ON e.id = es.employee_id 
          AND es.effective_from <= gs.date::date 
          AND (es.effective_to IS NULL OR es.effective_to >= gs.date::date)
      JOIN shifts s ON es.shift_id = s.id
      WHERE e.company_id = $1
        AND e.status = 'active'
        AND ($4::int IS NULL OR e.id = $4)
        AND gs.date::date < CURRENT_DATE
        AND gs.date::date >= e.joining_date
        -- Day of week check (e.g., 'Monday' in ["Monday", "Tuesday", ...])
        AND s.working_days @> jsonb_build_array(to_char(gs.date, 'FMDay'))
        -- Check if record already exists
        AND NOT EXISTS (
          SELECT 1 FROM attendance_records ar 
          WHERE ar.employee_id = e.id AND ar.work_date = gs.date::date
        )
        -- Check if it's a holiday
        AND NOT EXISTS (
          SELECT 1 FROM holidays h 
          WHERE h.company_id = e.company_id AND h.holiday_date = gs.date::date
        )
      ON CONFLICT (employee_id, work_date) DO NOTHING
    `;

    const result = await query(sql, [companyId, startDate, effectiveEndDate, employeeId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error in autoMarkAbsent:', error);
    return 0;
  }
};
