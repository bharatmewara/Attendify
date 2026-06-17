import React from 'react';
import { Chip } from '@mui/material';
import {
  AccessTime as DraftIcon,
  Autorenew as ProcessingIcon,
  CheckCircle as ApprovedIcon,
  Paid as PaidIcon,
  Cancel as CancelledIcon,
} from '@mui/icons-material';

/**
 * PayrollStatusBadge
 * Displays a styled MUI Chip for a payroll cycle / run status.
 *
 * Props:
 *   status  – 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled'
 *   size    – 'small' (default) | 'medium'
 */

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    color: 'default',
    icon: <DraftIcon />,
    sx: {
      backgroundColor: '#F3F4F6',
      color: '#6B7280',
      borderColor: '#E5E7EB',
      '& .MuiChip-icon': { color: '#9CA3AF' },
    },
  },
  processing: {
    label: 'Processing',
    color: 'info',
    icon: <ProcessingIcon sx={{ animation: 'spin 1.4s linear infinite' }} />,
    sx: {
      backgroundColor: '#EFF6FF',
      color: '#2563EB',
      borderColor: '#BFDBFE',
      '& .MuiChip-icon': { color: '#3B82F6' },
    },
  },
  approved: {
    label: 'Approved',
    color: 'success',
    icon: <ApprovedIcon />,
    sx: {
      backgroundColor: '#F0FDF4',
      color: '#16A34A',
      borderColor: '#BBF7D0',
      '& .MuiChip-icon': { color: '#22C55E' },
    },
  },
  paid: {
    label: 'Paid',
    color: 'success',
    icon: <PaidIcon />,
    sx: {
      backgroundColor: '#F0FDFA',
      color: '#0D9488',
      borderColor: '#99F6E4',
      '& .MuiChip-icon': { color: '#14B8A6' },
    },
  },
  cancelled: {
    label: 'Cancelled',
    color: 'error',
    icon: <CancelledIcon />,
    sx: {
      backgroundColor: '#FEF2F2',
      color: '#DC2626',
      borderColor: '#FECACA',
      '& .MuiChip-icon': { color: '#EF4444' },
    },
  },
};

// Spin keyframes injected once via a style tag
const SPIN_STYLE_ID = '__payroll_spin_style__';
if (typeof document !== 'undefined' && !document.getElementById(SPIN_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = SPIN_STYLE_ID;
  style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

export default function PayrollStatusBadge({ status = 'draft', size = 'small' }) {
  const normalised = (status || 'draft').toLowerCase();
  const config = STATUS_CONFIG[normalised] ?? {
    label: status,
    icon: <DraftIcon />,
    sx: {
      backgroundColor: '#F3F4F6',
      color: '#6B7280',
      borderColor: '#E5E7EB',
    },
  };

  return (
    <Chip
      size={size}
      variant="outlined"
      icon={config.icon}
      label={config.label}
      sx={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 600,
        letterSpacing: 0.3,
        borderRadius: '8px',
        border: '1.5px solid',
        ...config.sx,
      }}
    />
  );
}
