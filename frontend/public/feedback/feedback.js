document.getElementById('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    transactionId: document.getElementById('transactionId').value,
    raterId: document.getElementById('raterId').value,
    rating: parseInt(document.getElementById('rating').value, 10),
    feedback: document.getElementById('feedback').value
  };

  try {
    const res = await fetch('/submitRating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    document.getElementById('result').textContent = data.message || JSON.stringify(data);
  } catch (err) {
    document.getElementById('result').textContent = err.message;
  }
});
