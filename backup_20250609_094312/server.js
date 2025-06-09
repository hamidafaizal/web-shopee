// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const komisiRoutes = require('./src/routes/komisi');
const mobileRoutes = require('./src/routes/mobile');
const { connectDB } = require('./src/database/connection');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve PWA files
app.use('/pwa', express.static(path.join(__dirname, 'public/pwa')));

// Serve temp files
app.use('/temp', express.static(path.join(__dirname, 'public/temp')));

// File upload configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Routes
app.use('/api', komisiRoutes);
app.use('/api/mobile', mobileRoutes);

// PWA specific routes
app.get('/pwa/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/pwa/index.html'));
});

app.get('/pwa/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/pwa/login.html'));
});

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
  console.log(`PWA available at http://localhost:${PORT}/pwa/`);
});