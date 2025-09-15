import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, MenuItem, FormControlLabel, Checkbox, Select, InputLabel, FormControl, Divider
} from '@mui/material';

const activityTypes = [
  { value: 'farm_visit', label: 'Farm Visit' },
  { value: 'educational_tour', label: 'Educational Tour' },
  { value: 'agrotourism_activity', label: 'Agrotourism Activity' }
];

const pricingOptions = [
  { value: 'standard', label: 'Standard', price: 20 },
  { value: 'premium', label: 'Premium', price: 35 },
  { value: 'family_group', label: 'Family/Group', price: 15 },
  { value: 'student_educational', label: 'Student/Educational', price: 10 },
  { value: 'special_event', label: 'Special Event', price: 30 },
  { value: 'weekend_holiday', label: 'Weekend/Holiday', price: 25 }
];

const cancellationPolicyInfo = "24 hours before event for full refund";

function BookingForm({ onBooked }) {
  const [activityType, setActivityType] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState(1);
  const [location, setLocation] = useState('');
  const [pricingTier, setPricingTier] = useState('');
  const [price, setPrice] = useState('');
  const [groupBooking, setGroupBooking] = useState(false);
  const [specialEvent, setSpecialEvent] = useState(false);
  // Payment fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handlePricingChange = (e) => {
    const selected = pricingOptions.find(opt => opt.value === e.target.value);
    setPricingTier(selected.value);
    setPrice(selected.price);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    // Simulate payment processing
    await new Promise(res => setTimeout(res, 1200));
    // Send booking info to backend
    await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType,
        title,
        date,
        guests,
        location,
        pricingTier,
        price,
        groupBooking,
        specialEvent,
        payment: {
          cardNumber,
          cardName,
          expiry,
          cvc
        },
        cancellationPolicy: cancellationPolicyInfo
      })
    });
    setLoading(false);
    setSuccess('Booking & Payment successful!');
    if (onBooked) onBooked();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3, maxWidth: 500, mx: 'auto', p: 2, border: '1px solid #eee', borderRadius: 2, boxShadow: 1 }}>
      <Typography variant="h6" align="center" gutterBottom>
        Create Booking
      </Typography>
      <FormControl fullWidth sx={{ my: 1 }}>
        <InputLabel>Activity Type</InputLabel>
        <Select
          value={activityType}
          label="Activity Type"
          onChange={e => setActivityType(e.target.value)}
          required
        >
          {activityTypes.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        required
      />
      <TextField
        label="Date"
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        InputLabelProps={{ shrink: true }}
        required
      />
      <TextField
        label="Guests"
        type="number"
        value={guests}
        onChange={e => setGuests(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        inputProps={{ min: 1 }}
        required
      />
      <TextField
        label="Location"
        value={location}
        onChange={e => setLocation(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        required
      />
      <FormControl fullWidth sx={{ my: 1 }}>
        <InputLabel>Pricing Tier</InputLabel>
        <Select
          value={pricingTier}
          label="Pricing Tier"
          onChange={handlePricingChange}
          required
        >
          {pricingOptions.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label} ({opt.price} USD)
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {price && (
        <Typography variant="body2" color="primary" sx={{ mb: 1 }}>
          <strong>Selected Price:</strong> ${price} per guest
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
        <strong>Cancellation Policy:</strong> {cancellationPolicyInfo}
      </Typography>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" gutterBottom>
        Payment Information
      </Typography>
      <TextField
        label="Card Number"
        value={cardNumber}
        onChange={e => setCardNumber(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        required
        inputProps={{ maxLength: 16 }}
      />
      <TextField
        label="Name on Card"
        value={cardName}
        onChange={e => setCardName(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        required
      />
      <TextField
        label="Expiry"
        value={expiry}
        onChange={e => setExpiry(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        required
        placeholder="MM/YY"
      />
      <TextField
        label="CVC"
        value={cvc}
        onChange={e => setCvc(e.target.value)}
        fullWidth
        sx={{ my: 1 }}
        required
        inputProps={{ maxLength: 4 }}
      />
      <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mt: 2 }}>
        {loading ? 'Processing...' : 'Book & Pay'}
      </Button>
      {success && <Typography color="success.main" sx={{ mt: 2 }}>{success}</Typography>}
    </Box>
  );
}

export default BookingForm;