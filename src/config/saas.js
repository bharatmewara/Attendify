import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';

export const moduleCatalog = [
  {
    key: 'attendance',
    name: 'Attendance Management',
    icon: AccessTimeRoundedIcon,
    features: [
      'Online Punch System',
      'Biometric Machine Integration',
      'Present / Absent Tracking',
      'Late Minutes Calculation',
      'Early Leave Tracking',
      'Relaxation Time Rules',
      'Missing Time Adjustment with Approval',
      'Attendance Reports',
    ],
  },
  {
    key: 'leave',
    name: 'Leave Management',
    icon: CalendarMonthRoundedIcon,
    features: [
      'Leave Entitlement Setup',
      'Leave Application by Employees',
      'Multi-Level Leave Approval',
      'Leave Balance Tracking',
      'Leave History',
      'Email Notifications',
      'Automatic Leave Balance Update',
    ],
  },
  {
    key: 'shift',
    name: 'Shift Management',
    icon: BadgeRoundedIcon,
    features: [
      'Multiple Shift Configuration',
      'Working Days Setup',
      'Late Arrival Relaxation Rules',
      'Early Leave Relaxation',
      'Late Penalties',
      'Early Leaving Penalties',
      'Missing Time Penalties',
    ],
  },
  {
    key: 'payroll',
    name: 'Payroll Management',
    icon: CurrencyRupeeRoundedIcon,
    features: [
      'Attendance Integration with Payroll',
      'Leave Integration with Salary Calculation',
      'Salary Structure Management',
      'Allowances',
      'Deductions',
      'Tax Calculation',
      'PF / EOBI Management',
      'Overtime & Late Sitting Calculation',
      'Advance Salary Management',
      'Incentive Management',
      'Automatic Pay Slip Generation',
      'Email Pay Slip to Employees',
    ],
  },
  {
    key: 'employees',
    name: 'Employee Management',
    icon: GroupRoundedIcon,
    features: [
      'Employee Personal Information',
      'Contact Information',
      'Employment Details',
      'Document Upload & Storage',
      'Security Settings',
      'Asset Management',
    ],
  },
  {
    key: 'documents',
    name: 'HR Letters & Documentation',
    icon: DescriptionRoundedIcon,
    features: [
      'Appointment Letter Generation',
      'Offer Letter Generation',
      'Agreement Letter Creation',
      'Downloadable Documents',
      'Document History Logs',
    ],
  },
];

export const panelCatalog = [
  {
    key: 'super-admin',
    title: 'Super Admin Panel',
    subtitle: 'System owner control panel',
    icon: AdminPanelSettingsRoundedIcon,
    features: [
      'Manage Companies',
      'System Configuration',
      'Subscription Management',
      'User Monitoring',
      'Platform Analytics',
    ],
  },
  {
    key: 'company-admin',
    title: 'Company Admin Panel',
    subtitle: 'HR management dashboard',
    icon: ApartmentRoundedIcon,
    features: [
      'Employee Management',
      'Attendance Monitoring',
      'Leave Approval',
      'Payroll Management',
      'Reports & Analytics',
    ],
  },
  {
    key: 'employee',
    title: 'Employee Panel',
    subtitle: 'Employee self-service portal',
    icon: PersonRoundedIcon,
    features: [
      'View Attendance',
      'Apply Leave',
      'Download Payslips',
      'View Shift Details',
      'View HR Documents',
    ],
  },
];

export const appNav = [
  { label: 'Dashboard', to: '/app/dashboard' },
  ...moduleCatalog.map((module) => ({
    label: module.name.replace(' Management', ''),
    to: `/app/modules/${module.key}`,
  })),
  { label: 'Panels', to: '/app/panels/super-admin' },
];
