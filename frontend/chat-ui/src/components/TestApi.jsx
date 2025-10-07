import React, { useState } from 'react';
import api from '../api';

export default function TestApi() {
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState(null);

  async function hit() {
    try {
      setErr(null);
      const data = await api.get('/health');
      setResp(JSON.stringify(data, null, 2));
    } catch (e) {
      setResp(null);
      setErr(e.message || String(e));
    }
  }

  return (
    <div className="test-card text-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold">System health</h3>
          <p className="text-xs text-[var(--color-muted)]">Verify your irrigation of APIs before sowing prompts.</p>
        </div>
        <button type="button" onClick={hit} className="farm-button">
          🌱 Check /health
        </button>
      </div>
      {err && <pre className="text-red-600 whitespace-pre-wrap">{err}</pre>}
      {resp && <pre className="whitespace-pre-wrap">{resp}</pre>}
    </div>
  );
}