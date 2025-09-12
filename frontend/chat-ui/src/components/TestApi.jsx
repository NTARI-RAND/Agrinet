import React, { useState } from 'react';
import api from '../api';

export default function TestApi() {
  const [resp, setResp] = useState();
  const [err, setErr] = useState();

  async function hit() {
    try {
      const data = await api.get('/health'); // or whatever route you have
      setResp(JSON.stringify(data, null, 2));
      setErr(null);
    } catch (e) {
      setErr(e.message || 'error');
      setResp(null);
    }
  }

  return (
    <div>
      <button onClick={hit}>Call API</button>
      {err && <pre style={{color:'red'}}>{err}</pre>}
      {resp && <pre>{resp}</pre>}
    </div>
  );
}