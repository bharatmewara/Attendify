import { autoMarkAbsentService } from '../services/attendanceCalculationService.js';

/**
 * Automatically marks employees as absent for missing working days.
 * Ensures active lifecycle, exit_date cutoff, holiday exclusions, and approved leave exclusions.
 *
 * @param {number} companyId - The company ID
 * @param {number|null} employeeId - Optional specific employee ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 */
export const autoMarkAbsent = async (companyId, employeeId, startDate, endDate) => {
  return await autoMarkAbsentService(companyId, employeeId, startDate, endDate);
};
