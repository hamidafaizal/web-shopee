const express = require('express');
const MobileController = require('../controllers/mobileController');

const router = express.Router();

router.post('/register', MobileController.register);
router.get('/devices', MobileController.getDevices);
router.get('/links/:deviceName', MobileController.getDeviceLinks);
router.post('/links/copied', MobileController.markAsCopied);
router.delete('/links/:batchId', MobileController.deleteBatch);

module.exports = router;