import React, { useState } from 'react'
import api from '../api'

export default function TestApi() {
  const [resp, setResp] = useState(null)
  const [err, setErr] = useState(null)

  async function hit() {
    try {
      setErr(null)
      const data = await api.get('/health')
      setResp(JSON.stringify(data, null, 2))
    } catch (e) {
      setResp(null)
      setErr(e.message || String(e))
    }
  }

  return (
    <div className="p-4 border rounded bg-white text-sm">
      <div className="mb-2">
        <button onClick={hit} className="px-3 py-1 bg-blue-600 text-white rounded">Call /health</button>
      </div>
      {err && <pre className="text-red-600">{err}</pre>}
      {resp && <pre className="whitespace-pre-wrap">{resp}</pre>}
    </div>
  )
}