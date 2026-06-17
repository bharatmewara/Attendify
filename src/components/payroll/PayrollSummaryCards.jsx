import React from 'react';
import { Box, Card, CardContent, Typography, Skeleton, Divider } from '@mui/material';
import {
  PeopleAlt as PeopleIcon,
  AccountBalanceWallet as GrossIcon,
  Payments as NetIcon,
  EmojiEvents as IncentiveIcon,
} from '@mui/icons-material';

/**
 * PayrollSummaryCards
 * A responsive row of 4 KPI cards for payroll overview.
 *
 * Props:
 *   totalEmployees  – number
 *   totalGross      – number  (INR)
 *   totalNet        – number  (INR)
 *   totalIncentives – number  (INR)
 *   loading         – boolean
 */

const formatINR = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const CARDS_META = [
  {
    key: 'employees',
    title: 'Total Employees',
    icon: PeopleIcon,
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    shadowColor: 'rgba(99, 102, 241, 0.35)',
    isCurrency: false,
    valueKey: 'totalEmployees',
  },
  {
    key: 'gross',
    title: 'Total Gross Salary',
    icon: GrossIcon,
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
    shadowColor: 'rgba(59, 130, 246, 0.35)',
    isCurrency: true,
    valueKey: 'totalGross',
  },
  {
    key: 'net',
    title: 'Total Net Pay',
    icon: NetIcon,
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    shadowColor: 'rgba(16, 185, 129, 0.35)',
    isCurrency: true,
    valueKey: 'totalNet',
  },
  {
    key: 'incentives',
    title: 'Total Incentives',
    icon: IncentiveIcon,
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    shadowColor: 'rgba(245, 158, 11, 0.35)',
    isCurrency: true,
    valueKey: 'totalIncentives',
  },
];

function SummaryCard({ meta, value, loading }) {
  const IconComponent = meta.icon;

  return (
    <Card
      elevation={0}
      sx={{
        flex: '1 1 0',
        minWidth: 200,
        borderRadius: '16px',
        border: '1px solid',
        borderColor: 'rgba(0,0,0,0.06)',
        background: '#FFFFFF',
        position: 'relative',
        overflow: 'visible',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 16px 40px ${meta.shadowColor}`,
        },
      }}
    >
      {/* Top accent bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          borderRadius: '16px 16px 0 0',
          background: meta.gradient,
        }}
      />

      <CardContent sx={{ pt: 2.5, pb: '20px !important', px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          {/* Icon bubble */}
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              background: meta.gradient,
              boxShadow: `0 8px 20px ${meta.shadowColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconComponent sx={{ color: '#fff', fontSize: 26 }} />
          </Box>

          {/* Subtle percentage badge placeholder – kept blank for flexibility */}
          <Box />
        </Box>

        {/* Title */}
        <Typography
          variant="caption"
          sx={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 600,
            fontSize: '0.72rem',
            letterSpacing: 0.6,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            display: 'block',
            mb: 0.5,
          }}
        >
          {meta.title}
        </Typography>

        {/* Value */}
        {loading ? (
          <>
            <Skeleton variant="text" width="70%" height={40} />
            <Skeleton variant="text" width="45%" height={20} sx={{ mt: 0.5 }} />
          </>
        ) : (
          <>
            <Typography
              variant="h5"
              sx={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.45rem' },
                color: '#111827',
                lineHeight: 1.2,
              }}
            >
              {meta.isCurrency ? formatINR(value) : (value ?? 0).toLocaleString('en-IN')}
            </Typography>
            <Divider sx={{ mt: 1.5, borderColor: 'rgba(0,0,0,0.05)' }} />
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                display: 'block',
                color: '#9CA3AF',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '0.7rem',
              }}
            >
              Current payroll cycle
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function PayrollSummaryCards({
  totalEmployees = 0,
  totalGross = 0,
  totalNet = 0,
  totalIncentives = 0,
  loading = false,
}) {
  const values = { totalEmployees, totalGross, totalNet, totalIncentives };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2.5,
        flexWrap: 'wrap',
        width: '100%',
      }}
    >
      {CARDS_META.map((meta) => (
        <SummaryCard
          key={meta.key}
          meta={meta}
          value={values[meta.valueKey]}
          loading={loading}
        />
      ))}
    </Box>
  );
}
