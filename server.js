// server.js - Version bersih tanpa PWA/Viewer
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const komisiRoutes = require('./src/routes/komisi');
const komregRoutes = require('./src/routes/komreg');
const { connectDB } = require('./src/database/connection');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Serve temp files
app.use('/temp', express.static(path.join(__dirname, 'public/temp')));

// Routes
app.use('/api', komisiRoutes);
app.use('/api', komregRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Database connection
connectDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/`);
});