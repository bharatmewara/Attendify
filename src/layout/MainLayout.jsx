import { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { moduleCatalog, panelCatalog } from '../config/saas';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

const titleMap = {
  '/app/dashboard': {
    title: 'SaaS Command Dashboard',
    subtitle: 'Cross-module visibility for attendance, payroll, and HR operations',
  },
};

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(null);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const loadCompanyProfile = async () => {
      if (!user || !['company_admin', 'employee'].includes(user.role)) {
        setCompanyProfile(null);
        return;
      }
      try {
        const data = await apiRequest('/organization/companies');
        setCompanyProfile(data || null);
      } catch {
        setCompanyProfile(null);
      }
    };
    loadCompanyProfile();
  }, [user]);

  const pageMeta = useMemo(() => {
    if (titleMap[location.pathname]) {
      if (user?.role === 'company_admin' || user?.role === 'employee') {
        return {
          title: `${user.company_name || 'Company'} Workspace`,
          subtitle: user.role === 'company_admin' ? 'Company operations dashboard' : 'Employee self-service dashboard',
        };
      }
      return titleMap[location.pathname];
    }

    const module = moduleCatalog.find((item) => location.pathname.endsWith(`/modules/${item.key}`));
    if (module) {
      return { title: module.name, subtitle: 'Module workspace' };
    }

    const panel = panelCatalog.find((item) => location.pathname.endsWith(`/panels/${item.key}`));
    if (panel) {
      return { title: panel.title, subtitle: panel.subtitle };
    }

    return {
      title: user?.company_name ? `${user.company_name} Workspace` : 'Attendify Pro',
      subtitle: user?.company_name ? 'Company-branded operations workspace' : 'Workforce operations platform',
    };
  }, [location.pathname, user]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} companyProfile={companyProfile} />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ position: 'relative' }}>
          <Topbar title={pageMeta.title} subtitle={pageMeta.subtitle} companyProfile={companyProfile} />
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{ position: 'absolute', top: 16, right: 16, display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Box>
        <Outlet />
        {companyProfile && (user?.role === 'company_admin' || user?.role === 'employee') ? (
          <Box
            component="footer"
            sx={{
              px: { xs: 2, md: 4 },
              py: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(255,255,255,0.8)',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {companyProfile.company_name}
              {companyProfile.address ? ` | ${companyProfile.address}` : ''}
              {companyProfile.phone ? ` | Phone: ${companyProfile.phone}` : ''}
              {companyProfile.tel_no ? ` | Tel: ${companyProfile.tel_no}` : ''}
              {companyProfile.email ? ` | ${companyProfile.email}` : ''}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

export default MainLayout;
