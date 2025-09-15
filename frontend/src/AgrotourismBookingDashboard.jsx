import React, { useState } from 'react';
import ActivitiesList from './ActivitiesList';
import BookingForm from './BookingForm';
import ManageBookings from './ManageBookings';

function AgrotourismBookingDashboard() {
  // const [selectedActivity, setSelectedActivity] = useState(null);

  // Remove selectedActivity logic
  return (
    <div>
      <ActivitiesList />
      <BookingForm />
      <ManageBookings />
    </div>
  );
}

export default AgrotourismBookingDashboard;