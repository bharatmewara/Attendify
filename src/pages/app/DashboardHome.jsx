import { Avatar, Box, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Link } from 'react-router-dom';
import { moduleCatalog, panelCatalog } from '../../config/saas';

const metrics = [
  { title: 'Active Companies', value: '42' },
  { title: 'Employees Managed', value: '18,420' },
  { title: 'Monthly Payroll Volume', value: 'Rs 9.3Cr' },
  { title: 'Auto Approvals Today', value: '128' },
];

const DashboardHome = () => {
  return (
    <Box sx={{ py: 3.5, px: { xs: 1, sm: 0 } }}>
      <Container maxWidth="xl">
        <Paper
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 4,
            mb: 3,
            color: 'white',
            background: 'linear-gradient(120deg, #0F172A 0%, #1E40AF 55%, #0EA5E9 100%)',
          }}
        >
          <Typography variant="h4" fontWeight={800}>
            Workforce Command Dashboard
          </Typography>
          <Typography sx={{ mt: 1, opacity: 0.9, maxWidth: 760 }}>
            Track tenant health, workforce movement, and payroll readiness from one place.
          </Typography>
        </Paper>

        <Grid spacing={2.5} mb={3.5}>
          {metrics.map((metric) => (
            <Grid xs={12} sm={6} lg={3} key={metric.title}>
              <Paper
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {metric.title}
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                  {metric.value}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Typography variant="h5" fontWeight={800} mb={2.2}>
          Core Modules
        </Typography>
        <Grid spacing={2.5} mb={3.5}>
          {moduleCatalog.map((module) => {
            const Icon = module.icon;
            return (
              <Grid xs={12} md={6} key={module.key}>
                <Paper
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(15,23,42,0.08)' },
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" mb={1.8}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                      <Icon />
                    </Avatar>
                    <Typography variant="h6" fontWeight={700}>
                      {module.name}
                    </Typography>
                  </Stack>
                  <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} mb={2.2}>
                    {module.features.slice(0, 4).map((feature) => (
                      <Chip key={feature} size="small" label={feature} sx={{ bgcolor: '#EEF2FF', color: '#3730A3' }} />
                    ))}
                  </Stack>
                  <Chip
                    component={Link}
                    to={`/app/modules/${module.key}`}
                    clickable
                    icon={<ArrowForwardRoundedIcon />}
                    label="Open module workspace"
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  />
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <Typography variant="h5" fontWeight={800} mb={2}>
          Panel Workspaces
        </Typography>
        <Grid spacing={2.5}>
          {panelCatalog.map((panel) => (
            <Grid xs={12} md={4} key={panel.key}>
              <Paper
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" fontWeight={700} mb={0.5}>
                  {panel.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {panel.subtitle}
                </Typography>
                <Chip
                  component={Link}
                  to={`/app/panels/${panel.key}`}
                  clickable
                  icon={<ArrowForwardRoundedIcon />}
                  label="Open panel"
                  sx={{ fontWeight: 700 }}
                />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default DashboardHome;
