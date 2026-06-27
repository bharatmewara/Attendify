import { pool } from './backend/src/db.js';
import { calculateEmployeePayroll } from './backend/src/services/payrollEngine.js';

async function test() {
  const calc = await calculateEmployeePayroll({
    employeeId: 2,
    companyId: 1,
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    workingDays: 26,
    overtimeRate: 1.5,
  });

  console.log(JSON.stringify(calc, null, 2));
  process.exit(0);
}

test().catch(console.error);
