import { useMemo, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { moduleCatalog, panelCatalog } from '../config/saas';

const titleMap = {
  '/app/dashboard': {
    title: 'SaaS Command Dashboard',
    subtitle: 'Cross-module visibility for attendance, payroll, and HR operations',
  },
};

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const pageMeta = useMemo(() => {
    if (titleMap[location.pathname]) {
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

    return { title: 'Attendify Pro', subtitle: 'Workforce operations platform' };
  }, [location.pathname]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ position: 'relative' }}>
          <Topbar title={pageMeta.title} subtitle={pageMeta.subtitle} />
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{ position: 'absolute', top: 16, right: 16, display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Box>
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;
