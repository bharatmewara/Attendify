const sanitizeCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
};

export const downloadBlob = (content, filename, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportRowsToCsv = (rows, columns, filename) => {
  const header = columns.map((column) => sanitizeCell(column.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((column) => sanitizeCell(typeof column.value === 'function' ? column.value(row) : row[column.value]))
        .join(','),
    )
    .join('\n');

  downloadBlob(`${header}\n${body}`, filename, 'text/csv;charset=utf-8');
};

export const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const buildPayslipHtml = ({ payroll, employee, companyName, template = {}, generatedAt = new Date() }) => {
  const accent = template.accentColor || '#0f766e';
  const heading = template.heading || 'Payslip';
  const note = template.note || 'Computer generated payslip';

  const workingDays = Number(payroll.working_days || 26);
  const presentDays = Number(payroll.present_days || 0);
  const basicSalary = Number(payroll.basic_salary || 0);
  const extraIncome = Number(payroll.extra_income || 0);
  const earnedBasic = workingDays ? (basicSalary / workingDays) * presentDays : basicSalary;
  const earnedExtra = workingDays ? (extraIncome / workingDays) * presentDays : extraIncome;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${heading}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
      .sheet { border: 1px solid #cbd5e1; border-radius: 18px; overflow: hidden; }
      .hero { background: ${accent}; color: white; padding: 24px 28px; }
      .hero h1 { margin: 0 0 6px; font-size: 28px; }
      .hero p { margin: 0; opacity: 0.9; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 24px 28px; }
      .card { background: #f8fafc; border-radius: 14px; padding: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .totals { padding: 0 28px 28px; }
      .pill { display: inline-block; background: #dcfce7; color: #166534; border-radius: 999px; padding: 6px 10px; font-size: 12px; }
      .footer { padding: 0 28px 28px; color: #475569; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="hero">
        <h1>${heading}</h1>
        <p>${companyName || 'Attendify Workspace'}</p>
      </div>
      <div class="grid">
        <div class="card">
          <strong>Employee</strong>
          <div>${employee?.first_name || ''} ${employee?.last_name || ''}</div>
          <div>${employee?.employee_code || ''}</div>
          <div>${employee?.designation_title || ''}</div>
        </div>
        <div class="card">
          <strong>Payroll Period</strong>
          <div>${new Date(payroll.year, payroll.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
          <div>Processed: ${new Date(generatedAt).toLocaleDateString('en-IN')}</div>
          <div class="pill">${payroll.status || 'processed'}</div>
        </div>
      </div>
      <div class="grid">
        <div>
          <strong>Earnings</strong>
          <table>
            <tr><th>Basic Salary (Prorated)</th><td>${currency(earnedBasic)}</td></tr>
            <tr><th>Extra Income (Target)</th><td>${currency(earnedExtra)}</td></tr>
            <tr><th>Allowances</th><td>${currency(payroll.total_allowances)}</td></tr>
            <tr><th>Incentives</th><td>${currency(payroll.incentives)}</td></tr>
            <tr><th>Gross Salary</th><td>${currency(payroll.gross_salary)}</td></tr>
          </table>
        </div>
        <div>
          <strong>Deductions</strong>
          <table>
            <tr><th>Standard Deductions</th><td>${currency(payroll.total_deductions)}</td></tr>
            <tr><th>Late Penalties</th><td>${currency(payroll.late_penalties)}</td></tr>
            <tr><th>Early Leave Penalties</th><td>${currency(payroll.early_leave_penalties)}</td></tr>
          </table>
        </div>
      </div>
      <div class="totals">
        <table>
          <tr><th>Present Days</th><td>${payroll.present_days || 0}</td></tr>
          <tr><th>Absent Days</th><td>${payroll.absent_days || 0}</td></tr>
          <tr><th>Leave Days</th><td>${payroll.leave_days || 0}</td></tr>
          ${payroll.sales_total !== undefined ? `<tr><th>Sales Total</th><td>${currency(payroll.sales_total)}</td></tr>` : ''}
          ${payroll.target_total_salary !== undefined && Number(payroll.target_total_salary || 0) > 0 ? `<tr><th>Target Salary Tier</th><td>${currency(payroll.target_total_salary)}</td></tr>` : ''}
          <tr><th>Net Salary</th><td><strong>${currency(payroll.net_salary)}</strong></td></tr>
        </table>
      </div>
      <div class="footer">${note}</div>
    </div>
  </body>
</html>`;
};

export const fetchImageAsDataUrl = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const buildDocumentHtml = ({
  title,
  employeeName,
  companyName,
  companyLogo,
  companyAddress,
  companyPhone,
  companyTel,
  companyEmail,
  companyWebsite,
  serialNumber,
  content,
  accentColor = '#1d4ed8',
}) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Georgia, serif; padding: 36px; color: #111827; }
      .frame { max-width: 900px; margin: 0 auto; border: 1px solid #dbeafe; border-radius: 18px; overflow: hidden; }
      .head { background: linear-gradient(135deg, ${accentColor}, #0f172a); color: white; padding: 28px; }
      .head-top { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
      .logo { height: 60px; width: auto; vertical-align: middle; display: block; }
      .org { text-align: right; font-size: 12px; line-height: 1.5; opacity: 0.95; }
      .serial { font-size: 11px; opacity: 0.75; margin-top: 4px; text-align: right; }
      .content { padding: 32px; white-space: pre-wrap; line-height: 1.7; }
      .meta { font-size: 13px; opacity: 0.8; margin-top: 6px; }
      .footer { border-top: 1px solid #e5e7eb; padding: 18px 32px 24px; background: #f8fafc; font-size: 12px; color: #475569; }
      .footer strong { color: #1f2937; }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="head">
        <div class="head-top">
          <div>
            ${companyLogo ? `<img src="${companyLogo}" class="logo" alt="${companyName}">` : `<div style="font-size:20px;font-weight:900;">${companyName || ''}</div>`}
          </div>
          <div class="org">
            ${companyAddress ? `<div>${companyAddress}</div>` : ''}
            ${companyPhone ? `<div>Phone: ${companyPhone}</div>` : ''}
            ${companyTel ? `<div>Tel: ${companyTel}</div>` : ''}
            ${companyEmail ? `<div>Email: ${companyEmail}</div>` : ''}
            ${companyWebsite ? `<div>Web: ${companyWebsite}</div>` : ''}
            ${serialNumber ? `<div class="serial">Serial No: ${serialNumber}</div>` : ''}
          </div>
        </div>
        <h1>${title}</h1>
        <div class="meta">
          ${companyName || 'Attendify'} | ${employeeName || ''}
        </div>
      </div>
      <div class="content">${content || ''}</div>
      <div class="footer">
        <strong>${companyName || 'Attendify'}</strong>
        ${companyAddress ? ` | ${companyAddress}` : ''}
        ${companyPhone ? ` | ${companyPhone}` : ''}
        ${companyEmail ? ` | ${companyEmail}` : ''}
        ${companyWebsite ? ` | ${companyWebsite}` : ''}
      </div>
    </div>
  </body>
</html>`;