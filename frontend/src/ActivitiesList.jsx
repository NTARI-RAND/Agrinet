import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, CardActions, Button, Typography } from '@mui/material';

function ActivitiesList({ onSelect }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agrotourism/all')
      .then(res => res.json())
      .then(data => {
        setActivities(data);
        setLoading(false);
      });
  }, []);

  //if (loading) return <Typography>Loading activities...</Typography>;

  return (
    <Grid container spacing={3}>
      {activities.map(activity => (
        <Grid item xs={12} sm={6} md={4} key={activity.id}>
          <Card>
            <CardContent>
              <Typography variant="h5">{activity.title}</Typography>
              <Typography>{activity.description}</Typography>
              <Typography variant="body2"><strong>Location:</strong> {activity.location}</Typography>
              <Typography variant="body2"><strong>Date:</strong> {activity.date}</Typography>
              <Typography variant="body2"><strong>Capacity:</strong> {activity.maxGuests}</Typography>
              <Typography variant="body2"><strong>Pricing:</strong> {activity.pricingTiers}</Typography>
            </CardContent>
            <CardActions>
              <Button variant="contained" onClick={() => onSelect(activity)}>Book</Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default ActivitiesList;