import React, { useState } from 'react';

function OTPVerifyForm({ email }) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('http://localhost:5000/users/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div style={{
      maxWidth: 400,
      margin: '40px auto',
      padding: 24,
      borderRadius: 12,
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      background: '#fff'
    }}>
      <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:16}}>
        <h2 style={{textAlign:'center'}}>Verify Your Account</h2>
        <label>
          Enter OTP
          <input
            placeholder="OTP"
            value={otp}
            onChange={e => setOtp(e.target.value)}
            required
            style={{width:'100%', padding:8, marginTop:4}}
          />
        </label>
        <button type="submit" style={{
          background:'#1565c0', color:'#fff', padding:12, border:'none', borderRadius:6, fontWeight:'bold', cursor:'pointer'
        }}>
          Verify
        </button>
        {error && <div style={{color:'red', textAlign:'center'}}>{error}</div>}
        {success && <div style={{color:'green', textAlign:'center'}}>{success}</div>}
      </form>
    </div>
  );
}
 // in RegistrationForm.jsx
export default OTPVerifyForm;    // in OTPVerifyForm.jsx