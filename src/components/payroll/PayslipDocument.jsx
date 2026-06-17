import React, { useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Paper,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Print as PrintIcon,
  Business as BusinessIcon,
  Badge as BadgeIcon,
  AccountBalance as BankIcon,
  CalendarMonth as CalendarIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

/**
 * PayslipDocument
 * Enterprise-grade, print-ready payslip component.
 *
 * Props:
 *   data – full payslip data object (see type annotation below)
 *
 * Printing:
 *   Uses window.print(). A global <style> tag adds @media print rules
 *   to hide everything except the payslip container and suppress browser chrome.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatINR = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PRINT_STYLE_ID = '__payslip_print_style__';

function injectPrintStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #payslip-printable-root,
      #payslip-printable-root * { visibility: visible !important; }
      #payslip-printable-root {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        padding: 24px !important;
        background: #fff !important;
        box-shadow: none !important;
        border: none !important;
        z-index: 99999 !important;
      }
      .payslip-no-print { display: none !important; }
      @page {
        size: A4 portrait;
        margin: 12mm 14mm;
      }
    }
  `;
  document.head.appendChild(style);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PRIMARY = '#6366F1';
const PRIMARY_DARK = '#4F46E5';
const PRIMARY_LIGHT = '#EEF2FF';
const BORDER_COLOR = '#E5E7EB';
const ROW_ALT = '#F9FAFB';

const SectionHeader = ({ children, icon: Icon }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 2,
      py: 1,
      background: PRIMARY_LIGHT,
      borderLeft: `4px solid ${PRIMARY}`,
      borderRadius: '0 6px 6px 0',
      mb: 0,
    }}
  >
    {Icon && <Icon sx={{ fontSize: 16, color: PRIMARY }} />}
    <Typography
      sx={{
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        color: PRIMARY_DARK,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {children}
    </Typography>
  </Box>
);

const InfoRow = ({ label, value, highlight }) => (
  <Box
    sx={{
      display: 'flex',
      py: 0.6,
      borderBottom: `1px dashed ${BORDER_COLOR}`,
      '&:last-of-type': { borderBottom: 'none' },
    }}
  >
    <Typography
      sx={{
        width: '48%',
        fontSize: '0.78rem',
        color: '#6B7280',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 500,
      }}
    >
      {label}
    </Typography>
    <Typography
      sx={{
        width: '52%',
        fontSize: '0.82rem',
        fontWeight: highlight ? 700 : 600,
        color: highlight ? PRIMARY : '#111827',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {value || '—'}
    </Typography>
  </Box>
);

const AmountTable = ({ title, rows, icon: Icon, accentColor = PRIMARY }) => {
  const total = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  return (
    <Box sx={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: '10px', overflow: 'hidden', mb: 2.5 }}>
      {/* Table header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.1,
          background: `linear-gradient(90deg, ${accentColor}18 0%, transparent 100%)`,
          borderBottom: `1px solid ${BORDER_COLOR}`,
        }}
      >
        {Icon && <Icon sx={{ fontSize: 16, color: accentColor }} />}
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: accentColor,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {title}
        </Typography>
      </Box>

      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow sx={{ background: '#FAFAFA' }}>
            <TableCell
              sx={{
                fontWeight: 700,
                fontSize: '0.72rem',
                color: '#6B7280',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                borderBottom: `1px solid ${BORDER_COLOR}`,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                width: '65%',
              }}
            >
              Component
            </TableCell>
            <TableCell
              align="right"
              sx={{
                fontWeight: 700,
                fontSize: '0.72rem',
                color: '#6B7280',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                borderBottom: `1px solid ${BORDER_COLOR}`,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Amount
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2}
                align="center"
                sx={{ color: '#9CA3AF', fontSize: '0.78rem', py: 2, fontStyle: 'italic' }}
              >
                No components
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, idx) => (
              <TableRow
                key={idx}
                sx={{ background: idx % 2 === 0 ? '#FFFFFF' : ROW_ALT }}
              >
                <TableCell
                  sx={{
                    fontSize: '0.82rem',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    color: '#374151',
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    py: 0.9,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    {row.component_name}
                    {row.is_taxable && (
                      <Tooltip title="Taxable component" placement="top">
                        <InfoIcon sx={{ fontSize: 12, color: '#9CA3AF', cursor: 'default' }} />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    color: '#111827',
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    py: 0.9,
                  }}
                >
                  {formatINR(row.amount)}
                </TableCell>
              </TableRow>
            ))
          )}

          {/* Subtotal row */}
          <TableRow sx={{ background: `${accentColor}08` }}>
            <TableCell
              sx={{
                fontWeight: 800,
                fontSize: '0.82rem',
                color: accentColor,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                borderBottom: 'none',
                borderTop: `2px solid ${accentColor}30`,
                py: 1,
              }}
            >
              Total {title}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                fontWeight: 800,
                fontSize: '0.88rem',
                color: accentColor,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                borderBottom: 'none',
                borderTop: `2px solid ${accentColor}30`,
                py: 1,
              }}
            >
              {formatINR(total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayslipDocument({ data = {} }) {
  injectPrintStyles();
  const printRef = useRef(null);

  const {
    // Employee
    first_name = '',
    last_name = '',
    employee_code = '',
    designation_title = '',
    department_name = '',
    joining_date = '',
    pan_number = '',

    // Payroll period
    cycle_month,
    cycle_year,
    period_start = '',
    period_end = '',
    working_days = 0,
    present_days = 0,
    paid_leave_days = 0,
    unpaid_leave_days = 0,

    // Financials
    gross_salary = 0,
    net_salary = 0,
    total_deductions = 0,
    incentive_total = 0,
    ctc = 0,

    // Snapshots
    earnings_snapshot = [],
    deductions_snapshot = [],
    adjustments = [],

    // Company
    company_name = 'Company Name',
    address = '',
    phone = '',
    company_email = '',
    logo_url = '',
    gst_number = '',
    pan_number: company_pan = '',
    payslip_footer = '',

    // Bank
    emp_bank_account = '',
    emp_bank_ifsc = '',
    emp_bank_name = '',
    payment_type = '',
  } = data;

  const employeeName = [first_name, last_name].filter(Boolean).join(' ') || 'Employee';
  const monthLabel = cycle_month ? MONTH_NAMES[parseInt(cycle_month, 10)] : '';
  const periodLabel = `${monthLabel} ${cycle_year || ''}`.trim();

  // Mask bank account
  const maskedAccount = emp_bank_account
    ? `${'•'.repeat(Math.max(0, emp_bank_account.length - 4))}${emp_bank_account.slice(-4)}`
    : '—';

  const handlePrint = () => window.print();

  const netIsPositive = parseFloat(net_salary) >= 0;

  return (
    <Box>
      {/* ── Print / Download button (hidden on print) ── */}
      <Box
        className="payslip-no-print"
        sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}
      >
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          sx={{
            background: `linear-gradient(135deg, ${PRIMARY} 0%, #8B5CF6 100%)`,
            borderRadius: '10px',
            px: 3,
            py: 1,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: '0.85rem',
            boxShadow: `0 4px 14px rgba(99,102,241,0.4)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${PRIMARY_DARK} 0%, #7C3AED 100%)`,
              boxShadow: `0 6px 20px rgba(99,102,241,0.5)`,
              transform: 'translateY(-1px)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          Print / Download PDF
        </Button>
      </Box>

      {/* ══════════════════════════════════════════════
          PAYSLIP DOCUMENT (printable root)
      ══════════════════════════════════════════════ */}
      <Paper
        id="payslip-printable-root"
        ref={printRef}
        elevation={0}
        sx={{
          background: '#FFFFFF',
          border: `1px solid ${BORDER_COLOR}`,
          borderRadius: '16px',
          overflow: 'hidden',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          maxWidth: 900,
          mx: 'auto',
        }}
      >
        {/* ── COMPANY HEADER ── */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${PRIMARY} 0%, #4F46E5 50%, #7C3AED 100%)`,
            px: { xs: 3, sm: 4 },
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Logo + Company info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            {logo_url ? (
              <Box
                component="img"
                src={logo_url}
                alt={company_name}
                sx={{
                  height: 56,
                  width: 56,
                  objectFit: 'contain',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.15)',
                  p: 0.5,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BusinessIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 30 }} />
              </Box>
            )}

            <Box>
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: { xs: '1.1rem', sm: '1.35rem' },
                  lineHeight: 1.2,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  letterSpacing: -0.3,
                }}
              >
                {company_name}
              </Typography>

              {address && (
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.74rem',
                    mt: 0.4,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    maxWidth: 340,
                    lineHeight: 1.4,
                  }}
                >
                  {address}
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.8 }}>
                {phone && (
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem' }}>
                    📞 {phone}
                  </Typography>
                )}
                {company_email && (
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem' }}>
                    ✉ {company_email}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          {/* GST / PAN badges */}
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            {gst_number && (
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', letterSpacing: 0.8 }}>
                  GSTIN
                </Typography>
                <Typography sx={{ color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 0.5 }}>
                  {gst_number}
                </Typography>
              </Box>
            )}
            {company_pan && (
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', letterSpacing: 0.8 }}>
                  PAN
                </Typography>
                <Typography sx={{ color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 0.5 }}>
                  {company_pan}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* ── SALARY SLIP DIVIDER ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 4,
            py: 1.2,
            background: '#F8F7FF',
            borderBottom: `2px solid ${PRIMARY}20`,
            borderTop: `1px solid ${BORDER_COLOR}`,
          }}
        >
          <Box sx={{ flex: 1, height: '1px', background: `${PRIMARY}30` }} />
          <Box
            sx={{
              px: 3,
              py: 0.5,
              borderRadius: '20px',
              background: `linear-gradient(90deg, ${PRIMARY}15, ${PRIMARY}25)`,
              border: `1px solid ${PRIMARY}30`,
              mx: 2,
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '0.78rem',
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                color: PRIMARY_DARK,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Salary Slip
            </Typography>
          </Box>
          <Box sx={{ flex: 1, height: '1px', background: `${PRIMARY}30` }} />

          {/* Period chip (right-aligned) */}
          <Chip
            label={periodLabel || 'Current Period'}
            size="small"
            sx={{
              ml: 2,
              background: `linear-gradient(90deg, ${PRIMARY} 0%, #8B5CF6 100%)`,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.72rem',
              letterSpacing: 0.5,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              height: 26,
            }}
          />
        </Box>

        {/* ── BODY ── */}
        <Box sx={{ px: { xs: 2.5, sm: 4 }, py: 3 }}>

          {/* ── EMPLOYEE INFO + PAYROLL PERIOD ── */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Left: Employee Info */}
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionHeader icon={BadgeIcon}>Employee Information</SectionHeader>
              <Box
                sx={{
                  mt: 0,
                  p: 2,
                  border: `1px solid ${BORDER_COLOR}`,
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                }}
              >
                <InfoRow label="Employee Name" value={employeeName} highlight />
                <InfoRow label="Employee ID" value={employee_code} />
                <InfoRow label="Designation" value={designation_title} />
                <InfoRow label="Department" value={department_name} />
                <InfoRow label="Date of Joining" value={fmtDate(joining_date)} />
                <InfoRow label="PAN Number" value={pan_number} />
                {ctc > 0 && <InfoRow label="Annual CTC" value={formatINR(ctc)} />}
              </Box>
            </Grid>

            {/* Right: Payroll Period */}
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionHeader icon={CalendarIcon}>Payroll Period &amp; Attendance</SectionHeader>
              <Box
                sx={{
                  mt: 0,
                  p: 2,
                  border: `1px solid ${BORDER_COLOR}`,
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                }}
              >
                <InfoRow label="Pay Period" value={periodLabel} highlight />
                <InfoRow label="Period Start" value={fmtDate(period_start)} />
                <InfoRow label="Period End" value={fmtDate(period_end)} />
                <InfoRow label="Working Days" value={working_days} />
                <InfoRow label="Days Present" value={present_days} />
                <InfoRow label="Paid Leave Days" value={paid_leave_days} />
                <InfoRow label="Unpaid Leave Days" value={unpaid_leave_days} />
              </Box>
            </Grid>
          </Grid>

          {/* ── EARNINGS TABLE ── */}
          <AmountTable
            title="Earnings"
            rows={earnings_snapshot}
            icon={null}
            accentColor="#10B981"
          />

          {/* ── DEDUCTIONS TABLE ── */}
          <AmountTable
            title="Deductions"
            rows={deductions_snapshot}
            icon={null}
            accentColor="#EF4444"
          />

          {/* ── ADJUSTMENTS TABLE (conditional) ── */}
          {adjustments && adjustments.length > 0 && (
            <Box sx={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: '10px', overflow: 'hidden', mb: 2.5 }}>
              <Box
                sx={{
                  px: 2,
                  py: 1.1,
                  background: 'linear-gradient(90deg, #F59E0B18 0%, transparent 100%)',
                  borderBottom: `1px solid ${BORDER_COLOR}`,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: '#D97706',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Adjustments
                </Typography>
              </Box>
              <Table size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ background: '#FAFAFA' }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase', width: '50%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Label
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase', width: '25%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Type
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Amount
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {adjustments.map((adj, idx) => (
                    <TableRow key={idx} sx={{ background: idx % 2 === 0 ? '#FFFFFF' : ROW_ALT }}>
                      <TableCell sx={{ fontSize: '0.82rem', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#374151', py: 0.9 }}>
                        {adj.label}
                      </TableCell>
                      <TableCell sx={{ py: 0.9 }}>
                        <Chip
                          label={adj.adjustment_type || 'N/A'}
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            height: 20,
                            background: adj.adjustment_type === 'addition' ? '#D1FAE5' : '#FEE2E2',
                            color: adj.adjustment_type === 'addition' ? '#065F46' : '#991B1B',
                            borderRadius: '6px',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: adj.adjustment_type === 'deduction' ? '#DC2626' : '#059669', py: 0.9 }}>
                        {adj.adjustment_type === 'deduction' ? '−' : '+'}{formatINR(Math.abs(parseFloat(adj.amount || 0)))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* ── SALARY SUMMARY ROW ── */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Gross Salary */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: `1px solid #BBF7D0`,
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803D', letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Gross Salary
                </Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#166534', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {formatINR(gross_salary)}
                </Typography>
              </Box>
            </Grid>

            {/* Total Deductions */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: `1px solid #FECACA`,
                  background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#B91C1C', letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Total Deductions
                </Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#991B1B', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {formatINR(total_deductions)}
                </Typography>
              </Box>
            </Grid>

            {/* Incentives */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: `1px solid #FDE68A`,
                  background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#B45309', letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Incentives
                </Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#92400E', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {formatINR(incentive_total)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* ── NET SALARY HERO BOX ── */}
          <Box
            sx={{
              borderRadius: '16px',
              background: `linear-gradient(135deg, ${PRIMARY} 0%, #4F46E5 40%, #7C3AED 100%)`,
              p: { xs: 2.5, sm: 3.5 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
              mb: 3,
              boxShadow: `0 12px 32px ${PRIMARY}45`,
            }}
          >
            <Box>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  mb: 0.5,
                }}
              >
                Net Salary Payable
              </Typography>
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: { xs: '1.6rem', sm: '2.1rem' },
                  fontWeight: 900,
                  letterSpacing: -0.5,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  lineHeight: 1,
                }}
              >
                {formatINR(net_salary)}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '0.72rem',
                  mt: 0.8,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {periodLabel} · {`${present_days || 0} / ${working_days || 0} days`}
              </Typography>
            </Box>

            {/* Status badge */}
            <Box
              sx={{
                px: 3,
                py: 1.5,
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(4px)',
                textAlign: 'center',
              }}
            >
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mb: 0.3 }}>
                Status
              </Typography>
              <Typography sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.9rem' }}>
                {netIsPositive ? '✓ Credited' : '⚠ Review'}
              </Typography>
            </Box>
          </Box>

          {/* ── BANK / PAYMENT DETAILS ── */}
          {(emp_bank_account || payment_type) && (
            <Box sx={{ mb: 3 }}>
              <SectionHeader icon={BankIcon}>Payment Details</SectionHeader>
              <Box
                sx={{
                  p: 2,
                  border: `1px solid ${BORDER_COLOR}`,
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                }}
              >
                <Grid container spacing={0}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <InfoRow label="Payment Mode" value={payment_type} />
                    <InfoRow label="Bank Name" value={emp_bank_name} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <InfoRow label="Account No." value={maskedAccount} />
                    <InfoRow label="IFSC Code" value={emp_bank_ifsc} />
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}

          {/* ── FOOTER ── */}
          <Divider sx={{ borderColor: BORDER_COLOR, mb: 2 }} />

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'flex-end' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            {/* Footer text */}
            <Box>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: '#9CA3AF',
                  fontStyle: 'italic',
                  mb: 0.5,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                This is a computer-generated payslip and does not require a signature.
              </Typography>
              {payslip_footer && (
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: '#9CA3AF',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    maxWidth: 500,
                    lineHeight: 1.5,
                  }}
                >
                  {payslip_footer}
                </Typography>
              )}
            </Box>

            {/* Stamp / Seal placeholder */}
            <Box
              sx={{
                flexShrink: 0,
                width: 100,
                height: 60,
                border: `2px dashed ${BORDER_COLOR}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontSize: '0.6rem', color: '#D1D5DB', textAlign: 'center', lineHeight: 1.4 }}>
                Authorised<br />Signatory
              </Typography>
            </Box>
          </Box>

          {/* Powered by strip */}
          <Box
            sx={{
              mt: 2.5,
              pt: 1.5,
              borderTop: `1px solid ${BORDER_COLOR}`,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.62rem',
                color: '#D1D5DB',
                letterSpacing: 0.5,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Generated by Attendify HRMS · {new Date().toLocaleString('en-IN')}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
