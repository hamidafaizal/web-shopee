const MobileDevice = require('../models/mobileDevice');
const KomisiLink = require('../models/komisiLink');
const FCMService = require('../services/fcmService');

class MobileController {
  static async register(req, res) {
    try {
      const { deviceId, deviceName, fcmToken } = req.body;
      
      await MobileDevice.register({
        deviceId,
        deviceName,
        fcmToken
      });
      
      res.json({
        success: true,
        message: 'Device registered successfully'
      });
    } catch (error) {
      console.error('Error registering device:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
  
  static async getDeviceLinks(req, res) {
    try {
      const { deviceName } = req.params;
      
      // Get links assigned to this device
      const links = await KomisiLink.getByHPLabel(deviceName);
      
      // Group by batch
      const batches = {};
      links.forEach(link => {
        const batchKey = link.batch_id || 'pending';
        if (!batches[batchKey]) {
          batches[batchKey] = {
            id: batchKey,
            links: [],
            createdAt: link.created_at
          };
        }
        batches[batchKey].links.push(link.link_produk);
      });
      
      res.json({
        success: true,
        batches: Object.values(batches)
      });
    } catch (error) {
      console.error('Error getting device links:', error);
      res.status(500).json({ error: 'Failed to get links' });
    }
  }
  
  static async markAsCopied(req, res) {
    try {
      const { batchId } = req.body;
      
      // Update copied timestamp
      await KomisiLink.markBatchCopied(batchId);
      
      res.json({
        success: true,
        message: 'Marked as copied'
      });
    } catch (error) {
      console.error('Error marking as copied:', error);
      res.status(500).json({ error: 'Failed to update' });
    }
  }
  
  static async deleteBatch(req, res) {
    try {
      const { batchId } = req.params;
      
      // Delete batch
      await KomisiLink.deleteBatch(batchId);
      
      res.json({
        success: true,
        message: 'Batch deleted'
      });
    } catch (error) {
      console.error('Error deleting batch:', error);
      res.status(500).json({ error: 'Failed to delete' });
    }
  }
  
  static async getDevices(req, res) {
    try {
      const devices = await MobileDevice.getAllDevices();
      
      res.json({
        success: true,
        devices: devices
      });
    } catch (error) {
      console.error('Error getting devices:', error);
      res.status(500).json({ error: 'Failed to get devices' });
    }
  }
}

module.exports = MobileController;