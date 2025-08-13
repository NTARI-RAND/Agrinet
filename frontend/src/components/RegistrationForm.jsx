import React, { useState } from 'react';

function RegistrationForm({ onRegistered }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    location: '',
    role: 'producer',
    contractAgreement: true,
    certificationDocs: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Only proceed if contractAgreement is checked
  if (!form.contractAgreement) {
    setError('You must agree to the contract terms to register.');
    setLoading(false);
    return;
  }
   // Prepare data to send (remove contractAgreement and certificationDocs)
  const { contractAgreement, certificationDocs, ...userData } = form;

    try {
      const res = await fetch('http://localhost:5000/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        onRegistered(form.email);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
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
      <h2 style={{textAlign:'center'}}>Create Your Account</h2>
      <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:16}}>
        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} required style={{width:'100%', padding:8, marginTop:4}} />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={handleChange} required style={{width:'100%', padding:8, marginTop:4}} />
        </label>
        <label>
          Phone
          <input name="phone" value={form.phone} onChange={handleChange} style={{width:'100%', padding:8, marginTop:4}} />
        </label>
        <label>
          Password
          <input name="password" type="password" value={form.password} onChange={handleChange} required style={{width:'100%', padding:8, marginTop:4}} />
        </label>
        <label>
          Location
          <input name="location" value={form.location} onChange={handleChange} required style={{width:'100%', padding:8, marginTop:4}} />
        </label>
        <label>
          Role
          <select name="role" value={form.role} onChange={handleChange} style={{width:'100%', padding:8, marginTop:4}}>
            <option value="producer">Producer</option>
            <option value="consumer">Consumer</option>
          </select>
        </label>
        <label style={{display:'flex', alignItems:'center', gap:8}}>
          <input name="contractAgreement" type="checkbox" checked={form.contractAgreement} onChange={handleChange} />
          I agree to the contract terms
        </label>
        <button type="submit" disabled={loading} style={{
          background:'#2e7d32', color:'#fff', padding:12, border:'none', borderRadius:6, fontWeight:'bold', cursor:'pointer'
        }}>
          {loading ? 'Registering...' : 'Register'}
        </button>
        {error && <div style={{color:'red', textAlign:'center'}}>{error}</div>}
        {success && <div style={{color:'green', textAlign:'center'}}>{success}</div>}
      </form>
    </div>
  );
}

export default RegistrationForm;