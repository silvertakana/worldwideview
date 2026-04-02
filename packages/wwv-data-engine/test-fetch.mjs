fetch('http://localhost:5050/data/iranwarlive/history')
  .then(res => Promise.all([res.status, res.text()]))
  .then(([status, body]) => console.log('Status:', status, '\nBody:', body))
  .catch(console.error);
