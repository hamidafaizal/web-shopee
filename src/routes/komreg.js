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

// Tambahkan route baru untuk incremental processing
router.post('/process-incremental', upload.single('images'), async (req, res) => {
    try {
        const productStart = parseInt(req.body.productStart) || 1;
        // Process only 1 image at a time
        req.files = [req.file];

        // Call existing controller with start index
        const result = await KomregController.processKomregImages(req, res);

        // Ensure we only return 4 products max
        if (result && result.results) {
            result.results = result.results.slice(0, 4);
        }

        return result;
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function displayResults(filteredResults) {
    // ...existing code...

    // Enable KOMREG auto-sync preparation
    komregState.totalSsNeeded = Math.ceil(filteredResults.length / 4);
    komregState.totalBatches = Math.ceil(filteredResults.length / 100);
    document.getElementById('komreg-totalSs').textContent = komregState.totalSsNeeded;

    // Initialize syncedResults dengan struktur yang benar
    syncedResults = filteredResults.map(item => ({...item}));

    // ...existing code...
}

// ...existing code...

// Di checkSyncAvailability(), comment out atau hapus:
// syncBtn.style.display = 'block';

// Ganti dengan auto-check untuk send button
if (komregResults.length === filteredResults.length) {
    document.getElementById('sendBtn').style.backgroundColor = '#4caf50';
    document.getElementById('thresholdContainer').style.display = 'block';
}
// ...existing code...

module.exports = router;