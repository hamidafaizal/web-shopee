const express = require('express');
const multer = require('multer');
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
const upload = multer({ storage });

router.post('/komreg/process', upload.array('images', 10), KomregController.processKomregImages);
router.post('/api/komreg/process', upload.array('images', 10), KomregController.processKomregImages);

module.exports = router;