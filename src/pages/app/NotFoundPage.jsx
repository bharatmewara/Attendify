import { Box, Button, Container, Paper, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <Box sx={{ py: 6 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} mb={1}>
            Page not found
          </Typography>
          <Typography color="text.secondary" mb={3}>
            The workspace route you requested does not exist.
          </Typography>
          <Button component={Link} to="/app/dashboard" variant="contained">
            Go to Dashboard
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default NotFoundPage;
