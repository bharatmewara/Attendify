/**
 * attendanceCalculationService.js
 * ----------------------------------------------------------------------
 * Authoritative shared attendance service for Attendify HRMS.
 *
 * Rules:
 *  1. Inactive, resigned, or terminated employees must NEVER appear as present,
 *     absent, or attendance-eligible for dates after their effective exit/termination.
 *  2. Historical attendance records created while active remain intact and accessible.
 *  3. Absence is NEVER auto-generated for future dates, holidays, non-working days,
 *     or dates with approved leave.
 *  4. Provides day-wise grouped attendance and reconciled statistics across the application.
 */

import { query } from '../db.js';

export const normalizeDateKey = (val) => {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : str;
};

/**
 * Determine if an employee is attendance-eligible on a given date (YYYY-MM-DD)
 */
export function isEmployeeEligibleOnDate(employee, dateStr) {
  if (!employee || !dateStr) return false;

  const joinStr = normalizeDateKey(employee.joining_date);
  if (joinStr && dateStr < joinStr) {
    return false;
  }

  const exitStr = normalizeDateKey(employee.exit_date);
  if (exitStr && dateStr > exitStr) {
    return false;
  }

  const delStr = normalizeDateKey(employee.deleted_at);
  if (delStr && dateStr > delStr) {
    return false;
  }

  const empStatus = String(employee.status || '').toLowerCase();
  if (['inactive', 'terminated', 'resigned'].includes(empStatus)) {
    // If exit_date or deleted_at is set, it was checked above.
    // If not set, check against updated_at date as effective transition date.
    if (!exitStr && !delStr && employee.updated_at) {
      const updatedStr = normalizeDateKey(employee.updated_at);
      if (updatedStr && dateStr > updatedStr) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Shared, robust auto-mark absent generation.
 * Idempotent, safe, and strictly respects employment lifecycle.
 */
export async function autoMarkAbsentService({ companyId, employeeId = null, startDate, endDate }) {
  if (!companyId || !startDate || !endDate) return 0;

  const start = normalizeDateKey(startDate);
  const end = normalizeDateKey(endDate);

  try {
    const sql = `
      INSERT INTO attendance_records (employee_id, company_id, work_date, status)
      SELECT e.id, e.company_id, gs.date::date, 'absent'
      FROM employees e
      CROSS JOIN generate_series($2::date, $3::date, '1 day'::interval) gs(date)
      LEFT JOIN employee_shifts es 
        ON e.id = es.employee_id 
       AND es.effective_from <= gs.date::date 
       AND (es.effective_to IS NULL OR es.effective_to >= gs.date::date)
      LEFT JOIN shifts s ON s.id = COALESCE(
        es.shift_id,
        (SELECT s2.id FROM shifts s2 WHERE s2.company_id = e.company_id AND s2.is_active = TRUE ORDER BY s2.id DESC LIMIT 1)
      )
      WHERE e.company_id = $1::int
        AND ($4::int IS NULL OR e.id = $4::int)
        -- Must not be future date
        AND gs.date::date < CURRENT_DATE
        -- Employment lifecycle eligibility checks
        AND (e.joining_date IS NULL OR gs.date::date >= e.joining_date::date)
        AND (e.exit_date IS NULL OR gs.date::date <= e.exit_date::date)
        AND (e.deleted_at IS NULL OR gs.date::date <= e.deleted_at::date)
        AND (
          e.status = 'active' 
          OR (e.status IN ('inactive', 'terminated', 'resigned') AND (
            (e.exit_date IS NOT NULL AND gs.date::date <= e.exit_date::date)
            OR (e.deleted_at IS NOT NULL AND gs.date::date <= e.deleted_at::date)
            OR (e.exit_date IS NULL AND e.deleted_at IS NULL AND gs.date::date <= e.updated_at::date)
          ))
        )
        -- Shift working day check (if shift exists with working_days array)
        AND (
          s.working_days IS NULL 
          OR s.working_days @> jsonb_build_array(to_char(gs.date, 'FMDay'))
        )
        -- Not a company holiday
        AND NOT EXISTS (
          SELECT 1 FROM holidays h 
          WHERE h.company_id = e.company_id AND h.holiday_date = gs.date::date
        )
        -- Not on approved leave
        AND NOT EXISTS (
          SELECT 1 FROM leave_requests lr
          WHERE lr.employee_id = e.id 
            AND lr.status = 'approved'
            AND gs.date::date BETWEEN lr.start_date AND lr.end_date
        )
        -- Record doesn't already exist
        AND NOT EXISTS (
          SELECT 1 FROM attendance_records ar 
          WHERE ar.employee_id = e.id AND ar.work_date = gs.date::date
        )
      ON CONFLICT (employee_id, work_date) DO NOTHING
    `;

    const result = await query(sql, [companyId, start, end, employeeId]);
    return result.rowCount || 0;
  } catch (error) {
    console.error('Error in autoMarkAbsentService:', error.message);
    return 0;
  }
}

/**
 * Reconciled Attendance Summary
 *
 * Supports:
 * - Specific single date (e.g. today)
 * - Date range (startDate to endDate)
 * - Specific month & year
 * - Filter by employee or department
 *
 * Denominator counts only attendance-eligible employees on the specified dates.
 */
export async function getAttendanceSummaryService({
  companyId,
  date = null,
  startDate = null,
  endDate = null,
  month = null,
  year = null,
  employeeId = null,
  departmentId = null,
}) {
  let dateCondition = '';
  const params = [companyId];

  if (date) {
    const singleDate = normalizeDateKey(date);
    dateCondition = ` AND ar.work_date = $${params.length + 1}::date`;
    params.push(singleDate);
  } else if (startDate && endDate) {
    dateCondition = ` AND ar.work_date >= $${params.length + 1}::date AND ar.work_date <= $${params.length + 2}::date`;
    params.push(normalizeDateKey(startDate), normalizeDateKey(endDate));
  } else if (month && year) {
    dateCondition = ` AND EXTRACT(MONTH FROM ar.work_date) = $${params.length + 1} AND EXTRACT(YEAR FROM ar.work_date) = $${params.length + 2}`;
    params.push(Number(month), Number(year));
  }

  let empFilter = '';
  if (employeeId) {
    empFilter += ` AND ar.employee_id = $${params.length + 1}::int`;
    params.push(Number(employeeId));
  }
  if (departmentId) {
    empFilter += ` AND e.department_id = $${params.length + 1}::int`;
    params.push(Number(departmentId));
  }

  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present_count,
      COUNT(*) FILTER (WHERE ar.status = 'absent')::int AS absent_count,
      COUNT(*) FILTER (WHERE ar.status = 'on_leave')::int AS leave_count,
      COUNT(*) FILTER (WHERE ar.status = 'half_day')::int AS half_day_count,
      COUNT(*) FILTER (WHERE ar.late_minutes > 0)::int AS late_count,
      COALESCE(SUM(ar.late_minutes), 0)::int AS total_late_minutes,
      COALESCE(SUM(ar.total_hours), 0)::decimal(10,2) AS total_hours
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    WHERE ar.company_id = $1::int
      ${dateCondition}
      ${empFilter}
  `;

  const result = await query(sql, params);
  const counts = result.rows[0] || {
    present_count: 0,
    absent_count: 0,
    leave_count: 0,
    half_day_count: 0,
    late_count: 0,
    total_late_minutes: 0,
    total_hours: 0,
  };

  // Calculate count of eligible employees for the period
  let eligibleCount = 0;
  if (date) {
    const singleDate = normalizeDateKey(date);
    const eligibleRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM employees e
       WHERE e.company_id = $1::int
         AND (e.joining_date IS NULL OR e.joining_date::date <= $2::date)
         AND (e.exit_date IS NULL OR e.exit_date::date >= $2::date)
         AND (e.deleted_at IS NULL OR e.deleted_at::date >= $2::date)
         AND (
           e.status = 'active'
           OR (e.status IN ('inactive', 'terminated', 'resigned') AND (
             (e.exit_date IS NOT NULL AND $2::date <= e.exit_date::date)
             OR (e.deleted_at IS NOT NULL AND $2::date <= e.deleted_at::date)
             OR (e.exit_date IS NULL AND e.deleted_at IS NULL AND $2::date <= e.updated_at::date)
           ))
         )
         AND ($3::int IS NULL OR e.id = $3::int)
         AND ($4::int IS NULL OR e.department_id = $4::int)`,
      [companyId, singleDate, employeeId, departmentId],
    );
    eligibleCount = Number(eligibleRes.rows[0]?.count || 0);
  } else {
    // Current active employees
    const eligibleRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM employees e
       WHERE e.company_id = $1::int
         AND e.deleted_at IS NULL
         AND e.status = 'active'
         AND ($2::int IS NULL OR e.id = $2::int)
         AND ($3::int IS NULL OR e.department_id = $3::int)`,
      [companyId, employeeId, departmentId],
    );
    eligibleCount = Number(eligibleRes.rows[0]?.count || 0);
  }

  const workingCount = Number(counts.present_count || 0) + Number(counts.half_day_count || 0) + Number(counts.absent_count || 0);
  const attendancePercentage = workingCount > 0
    ? Math.round(((Number(counts.present_count || 0) + Number(counts.half_day_count || 0) * 0.5) / workingCount) * 100)
    : (eligibleCount > 0 && counts.present_count > 0 ? Math.round((counts.present_count / eligibleCount) * 100) : 0);

  return {
    ...counts,
    eligible_count: eligibleCount,
    total_eligible: eligibleCount,
    attendance_percentage: attendancePercentage,
  };
}

/**
 * Day-Wise Grouped Attendance for Admin
 *
 * Implements Phase 5:
 * - Groups records by attendance date (descending)
 * - Parent grouping is the attendance date
 * - Expandable child records for associated employees
 * - Daily summary counts (present, absent, late, half-day, on-leave, eligible)
 * - Filtering by date range, month, department, designation, status, and search
 * - Pagination support
 * - Clean reconciliation between summary counts and employee rows
 */
export async function getDayWiseGroupedAttendanceService({
  companyId,
  startDate,
  endDate,
  month = null,
  year = null,
  search = null,
  departmentId = null,
  designationId = null,
  status = null,
  page = 1,
  limit = 15,
}) {
  let start = normalizeDateKey(startDate);
  let end = normalizeDateKey(endDate);

  if (!start && !end && month && year) {
    const y = Number(year);
    const m = Number(month);
    start = normalizeDateKey(new Date(Date.UTC(y, m - 1, 1)));
    end = normalizeDateKey(new Date(Date.UTC(y, m, 0)));
  }

  if (!start) {
    // Default to current month start
    const now = new Date();
    start = normalizeDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  }
  if (!end) {
    const now = new Date();
    end = normalizeDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
  }

  // Ensure automated absences are up to date for this range
  await autoMarkAbsentService({ companyId, startDate: start, endDate: end });

  // 1. Fetch all distinct dates that have records or fall in range
  const dateParams = [companyId, start, end];
  let filterSql = '';

  if (departmentId) {
    dateParams.push(Number(departmentId));
    filterSql += ` AND e.department_id = $${dateParams.length}::int`;
  }
  if (designationId) {
    dateParams.push(Number(designationId));
    filterSql += ` AND e.designation_id = $${dateParams.length}::int`;
  }
  if (status) {
    dateParams.push(String(status).toLowerCase());
    filterSql += ` AND LOWER(ar.status) = $${dateParams.length}`;
  }
  if (search) {
    dateParams.push(String(search).trim());
    filterSql += ` AND (
      e.first_name ILIKE '%' || $${dateParams.length} || '%'
      OR e.last_name ILIKE '%' || $${dateParams.length} || '%'
      OR e.employee_code ILIKE '%' || $${dateParams.length} || '%'
    )`;
  }

  // Count total distinct dates for pagination
  const countSql = `
    SELECT COUNT(DISTINCT ar.work_date)::int AS total_dates
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    WHERE ar.company_id = $1::int
      AND ar.work_date >= $2::date
      AND ar.work_date <= $3::date
      ${filterSql}
  `;
  const countResult = await query(countSql, dateParams);
  const totalDates = Number(countResult.rows[0]?.total_dates || 0);

  // Paginate dates
  const offset = Math.max(0, (Number(page) - 1) * Number(limit));
  const datesSql = `
    SELECT DISTINCT ar.work_date
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    WHERE ar.company_id = $1::int
      AND ar.work_date >= $2::date
      AND ar.work_date <= $3::date
      ${filterSql}
    ORDER BY ar.work_date DESC
    LIMIT $${dateParams.length + 1} OFFSET $${dateParams.length + 2}
  `;
  const datesParams = [...dateParams, Number(limit), offset];
  const datesResult = await query(datesSql, datesParams);
  const pageDates = datesResult.rows.map((r) => normalizeDateKey(r.work_date));

  if (pageDates.length === 0) {
    return {
      total_dates: 0,
      page: Number(page),
      limit: Number(limit),
      groups: [],
      overall_summary: {
        present_count: 0,
        absent_count: 0,
        leave_count: 0,
        half_day_count: 0,
        late_count: 0,
        total_late_minutes: 0,
      },
    };
  }

  // 2. Fetch records for the selected page of dates
  const recordsSql = `
    SELECT
      ar.id,
      ar.employee_id,
      ar.work_date,
      ar.punch_in_time,
      ar.punch_out_time,
      ar.total_hours,
      ar.late_minutes,
      ar.early_leave_minutes,
      ar.status,
      ar.notes,
      e.first_name,
      e.last_name,
      e.employee_code,
      d.name AS department_name,
      ds.title AS designation_name
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations ds ON e.designation_id = ds.id
    WHERE ar.company_id = $1::int
      AND ar.work_date = ANY($2::date[])
      ${filterSql}
    ORDER BY ar.work_date DESC, e.first_name ASC, e.last_name ASC
  `;

  const recordsParams = [companyId, pageDates];
  // Re-append other filters
  if (departmentId) recordsParams.push(Number(departmentId));
  if (designationId) recordsParams.push(Number(designationId));
  if (status) recordsParams.push(String(status).toLowerCase());
  if (search) recordsParams.push(String(search).trim());

  // Replace indices in filterSql for recordsParams
  let paramIdx = 2;
  const adjustedFilterSql = filterSql.replace(/\$(\d+)/g, () => {
    paramIdx += 1;
    return `$${paramIdx}`;
  });

  const finalRecordsSql = `
    SELECT
      ar.id,
      ar.employee_id,
      ar.work_date,
      ar.punch_in_time,
      ar.punch_out_time,
      ar.total_hours,
      ar.late_minutes,
      ar.early_leave_minutes,
      ar.status,
      ar.notes,
      e.first_name,
      e.last_name,
      e.employee_code,
      d.name AS department_name,
      ds.title AS designation_name
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations ds ON e.designation_id = ds.id
    WHERE ar.company_id = $1::int
      AND ar.work_date = ANY($2::date[])
      ${adjustedFilterSql}
    ORDER BY ar.work_date DESC, e.first_name ASC, e.last_name ASC
  `;

  const recordsResult = await query(finalRecordsSql, recordsParams);

  // Group by date
  const groupsMap = new Map();
  for (const dateKey of pageDates) {
    groupsMap.set(dateKey, {
      date: dateKey,
      summary: {
        present: 0,
        absent: 0,
        late: 0,
        half_day: 0,
        on_leave: 0,
        total_records: 0,
      },
      employees: [],
    });
  }

  for (const row of recordsResult.rows) {
    const dKey = normalizeDateKey(row.work_date);
    if (!groupsMap.has(dKey)) continue;

    const group = groupsMap.get(dKey);
    group.employees.push({
      ...row,
      work_date: dKey,
    });
    group.summary.total_records += 1;

    const s = String(row.status || '').toLowerCase();
    if (s === 'present') group.summary.present += 1;
    else if (s === 'absent') group.summary.absent += 1;
    else if (s === 'on_leave') group.summary.on_leave += 1;
    else if (s === 'half_day') group.summary.half_day += 1;

    if (Number(row.late_minutes || 0) > 0) {
      group.summary.late += 1;
    }
  }

  // 3. Overall summary for the full queried range
  const overallSummary = await getAttendanceSummaryService({
    companyId,
    startDate: start,
    endDate: end,
    departmentId,
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const formattedGroups = Array.from(groupsMap.values()).map(g => {
    const present = g.summary?.present || 0;
    const totalEligible = overallSummary?.eligible_count || g.employees?.length || 0;
    const attPct = totalEligible > 0 ? Math.round((present / totalEligible) * 100) : 0;

    return {
      date: g.date,
      is_today: g.date === todayStr,
      day_name: new Date(g.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      counts: {
        present: g.summary?.present || 0,
        absent: g.summary?.absent || 0,
        late: g.summary?.late || 0,
        half_day: g.summary?.half_day || 0,
        on_leave: g.summary?.on_leave || 0,
        total_eligible: totalEligible,
        attendance_percentage: attPct,
      },
      summary: g.summary,
      employees: g.employees,
      records: g.employees,
    };
  });

  return {
    total_dates: totalDates,
    page: Number(page),
    limit: Number(limit),
    start_date: start,
    end_date: end,
    overall_summary: overallSummary,
    groups: formattedGroups,
    dates: formattedGroups,
  };
}
