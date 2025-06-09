// src/routes/komisi.js
const express = require('express');
const multer = require('multer');
const KomisiController = require('../controllers/komisiController');
const CSVController = require('../controllers/csvController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Routes for Project 1 (Input Link Komisi)
router.post('/links', KomisiController.addLink);
router.post('/upload-excel', upload.single('file'), KomisiController.uploadExcel);
router.get('/batches', KomisiController.getBatches);
router.post('/batches/:batchNumber/label', KomisiController.updateBatchLabel);
router.delete('/links/delete-all', KomisiController.deleteAllLinks);
router.get('/config', KomisiController.getConfig);
router.post('/config', KomisiController.updateConfig);

// Routes for Project 2 (Filter CSV)
router.post('/filter-csv-multiple', upload.array('files'), CSVController.uploadAndFilterMultipleCSV);
router.post('/generate-excel', CSVController.generateExcel);
router.post('/send-to-project1', CSVController.sendToProject1);
// Tambahkan line ini di bagian routes
router.post('/send-links', KomisiController.sendLinks);
router.get('/latest-batches', KomisiController.getLatestBatches);

module.exports = router;