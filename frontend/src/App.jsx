import React from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import AgrotourismBookingDashboard from './AgrotourismBookingDashboard';

function App() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h3" align="center" gutterBottom>
        Agrotourism Booking Platform
      </Typography>
      <AgrotourismBookingDashboard />
    </Container>
  );
}

export default App;