// src/controllers/komisiController.js
const KomisiLink = require('../models/komisiLink');
const KomisiConfig = require('../models/komisiConfig');
const FCMService = require('../services/fcmService');
const XLSX = require('xlsx');

class KomisiController {
  static async addLink(req, res) {
    try {
      const { link, komisi } = req.body;
      
      if (!link) {
        return res.status(400).json({ error: 'Link is required' });
      }
      
      // Check if link already exists
      const exists = await KomisiLink.existsUnsent(link);
      
      if (!exists && komisi) {
        await KomisiLink.create({
          link_produk: link,
          komisi_flag: true
        });
      }
      
      // Check threshold and process
      await KomisiController.checkAndProcess();
      
      const count = await KomisiLink.countUnsent();
      
      res.json({
        success: true,
        message: exists ? 'Link sudah ada' : 'Link berhasil ditambahkan',
        count: count
      });
    } catch (error) {
      console.error('Error adding link:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async uploadExcel(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      let added = 0;
      let skipped = 0;
      
      for (const row of data) {
        const link = row['Link Produk'];
        const komisi = row['Komisi ✅'];
        
        if (link && komisi) {
          const exists = await KomisiLink.existsUnsent(link);
          
          if (!exists) {
            await KomisiLink.create({
              link_produk: link,
              komisi_flag: true
            });
            added++;
          } else {
            skipped++;
          }
        }
      }
      
      // Check threshold and process
      await KomisiController.checkAndProcess();
      
      const count = await KomisiLink.countUnsent();
      
      res.json({
        success: true,
        message: `${added} link ditambahkan, ${skipped} link sudah ada`,
        count: count
      });
    } catch (error) {
      console.error('Error uploading Excel:', error);
      res.status(500).json({ error: 'Error processing Excel file' });
    }
  }
  
  static async getStatus(req, res) {
    try {
      const links = await KomisiLink.getUnsentDetailed(100);
      const count = await KomisiLink.countUnsent();
      const config = await KomisiConfig.get();
      
      res.json({
        count: count,
        links: links,
        threshold: config.max_links,
        ready: count >= config.max_links
      });
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async deleteAllLinks(req, res) {
    try {
      await KomisiLink.deleteAllUnsent();
      
      res.json({
        success: true,
        message: 'Semua link berhasil dihapus'
      });
    } catch (error) {
      console.error('Error deleting links:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async setHPLabel(req, res) {
    try {
      const { label } = req.body;
      
      if (!label) {
        return res.status(400).json({ error: 'Label is required' });
      }
      
      // Get config for max links
      const config = await KomisiConfig.get();
      
      // Update HP label for next batch
      await KomisiLink.setHPLabelForNext(config.max_links, label);
      
      res.json({
        success: true,
        message: `Label ${label} berhasil diterapkan untuk batch berikutnya`
      });
    } catch (error) {
      console.error('Error setting HP label:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async getConfig(req, res) {
    try {
      const config = await KomisiConfig.get();
      
      res.json({
        maxLinks: config.max_links
      });
    } catch (error) {
      console.error('Error getting config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async updateConfig(req, res) {
    try {
      const { maxLinks } = req.body;
      
      if (!maxLinks || maxLinks < 10) {
        return res.status(400).json({ error: 'Max links minimum adalah 10' });
      }
      
      await KomisiConfig.update({ max_links: maxLinks });
      
      res.json({
        success: true,
        message: 'Konfigurasi berhasil diupdate'
      });
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async checkAndProcess() {
    try {
      const config = await KomisiConfig.get();
      const count = await KomisiLink.countUnsent();
      
      if (count >= config.max_links) {
        // Get links grouped by HP label
        const links = await KomisiLink.getUnsentByLabel(config.max_links);
        
        // Group links by HP label
        const linksByLabel = {};
        links.forEach(link => {
          const label = link.hp_label || 'DEFAULT';
          if (!linksByLabel[label]) {
            linksByLabel[label] = [];
          }
          linksByLabel[label].push(link);
        });
        
        // Send notification for each HP label group
        for (const [label, labelLinks] of Object.entries(linksByLabel)) {
          if (labelLinks.length >= config.max_links) {
            const linkText = labelLinks.slice(0, config.max_links).map(l => l.link_produk).join('\n');
            
            await FCMService.sendNotification({
              title: `Link Komisi Baru - ${label}!`,
              body: `${config.max_links} link komisi siap diproses untuk ${label}`,
              data: {
                links: linkText,
                count: config.max_links.toString(),
                type: 'komisi_batch',
                hp_label: label
              }
            });
            
            // Mark as sent
            const batchId = Date.now();
            const ids = labelLinks.slice(0, config.max_links).map(l => l.id);
            await KomisiLink.markAsSent(ids, batchId);
            
            console.log(`Batch ${batchId} sent for ${label} with ${config.max_links} links`);
          }
        }
      }
    } catch (error) {
      console.error('Error in checkAndProcess:', error);
    }
  }
  
  // Receive from Project 2
  static async receiveFromProject2(links) {
    try {
      let added = 0;
      let skipped = 0;
      
      console.log('Receiving links from Project 2:', links.length);
      
      for (const item of links) {
        const exists = await KomisiLink.existsUnsent(item.link);
        
        if (!exists) {
          await KomisiLink.create({
            link_produk: item.link,
            komisi_flag: true
          });
          added++;
        } else {
          skipped++;
        }
      }
      
      // Check threshold and process
      await KomisiController.checkAndProcess();
      
      console.log(`Added: ${added}, Skipped: ${skipped}`);
      
      return {
        success: true,
        added,
        skipped
      };
    } catch (error) {
      console.error('Error receiving from Project 2:', error);
      throw error;
    }
  }
}

module.exports = KomisiController;