const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const KomregController = require('../controllers/komregController');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Maksimal 50 files
  }
});

// Ganti limit upload gambar dari 10 jadi 50
router.post('/process', upload.array('images', 50), KomregController.processKomregImages);

module.exports = router;