const express = require('express');
const path = require('node:path');
const api = require('./api');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '8mb' }));
app.use('/api', api);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get(['/style.css', '/script.js'], (req, res) => {
  res.sendFile(path.join(__dirname, req.path.slice(1)));
});
app.use('/image', express.static(path.join(__dirname, 'image')));

app.listen(port, () => {
  console.log(`Frontend server listening at http://localhost:${port}`);
});