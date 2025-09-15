import React, { useEffect, useState } from 'react';
import { Typography, List, ListItem, ListItemText, Button } from '@mui/material';

function ManageBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bookings/my')
      .then(res => res.json())
      .then(data => {
        setBookings(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  const handleCancel = async id => {
    await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' });
    setBookings(bookings.map(b => b.id === id ? { ...b, status: 'Cancelled' } : b));
  };

  //if (loading) return <Typography>Loading bookings...</Typography>;

  return (
    <div>
      <Typography variant="h6" sx={{ mt: 4 }}>My Bookings</Typography>
      <List>
        {bookings.map(b => (
          <ListItem key={b.id} secondaryAction={
            b.status !== 'Cancelled' && (
              <Button variant="outlined" color="error" onClick={() => handleCancel(b.id)}>
                Cancel
              </Button>
            )
          }>
            <ListItemText
              primary={`${b.title} on ${b.date} (${b.guests} guests)`}
              secondary={`Status: ${b.status || 'Active'}`}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
}

export default ManageBookings;