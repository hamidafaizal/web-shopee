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
      
      // Get current config
      const config = await KomisiConfig.get();
      
      // Check current count
      const currentCount = await KomisiLink.countUnsent();
      
      // Check if already at limit
      if (currentCount >= config.max_links) {
        return res.json({
          success: false,
          error: `Sudah mencapai limit ${config.max_links} link. Hapus link existing atau kirim ke HP terlebih dahulu.`
        });
      }
      
      // Check if link already exists
      const exists = await KomisiLink.existsUnsent(link);
      
      if (!exists && komisi) {
        // Calculate batch number
        const batchNumber = Math.floor(currentCount / 100) + 1;
        
        await KomisiLink.create({
          link_produk: link,
          komisi_flag: true,
          batch_number: batchNumber
        });
      }
      
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
      
      // Get current config
      const config = await KomisiConfig.get();
      
      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log('Excel data sample:', data[0]); // Debug log
      
      // Get current count
      const currentCount = await KomisiLink.countUnsent();
      const availableSlots = config.max_links - currentCount;
      
      if (availableSlots <= 0) {
        return res.json({
          success: false,
          error: `Sudah mencapai limit ${config.max_links} link. Hapus link existing atau kirim ke HP terlebih dahulu.`
        });
      }
      
      let added = 0;
      let skipped = 0;
      
      for (const row of data) {
        // Stop if we reach the limit
        if (added >= availableSlots) {
          break;
        }
        
        // Try different possible column names
        const link = row['Link Produk'] || row['link produk'] || row['Link'] || row['link'];
        const komisi = row['Komisi ✅'] || row['Komisi'] || row['komisi'] || row['Komisi ✓'];
        
        if (link) {
          const exists = await KomisiLink.existsUnsent(link);
          
          if (!exists) {
            // Calculate batch number
            const batchNumber = Math.floor((currentCount + added) / 100) + 1;
            
            await KomisiLink.create({
              link_produk: link,
              komisi_flag: true,
              batch_number: batchNumber
            });
            added++;
          } else {
            skipped++;
          }
        }
      }
      
      const totalInFile = data.filter(row => row['Link Produk'] || row['link produk'] || row['Link'] || row['link']).length;
      const notAdded = totalInFile - added - skipped;
      
      let message = `${added} link ditambahkan, ${skipped} link sudah ada`;
      if (notAdded > 0) {
        message += `, ${notAdded} link tidak ditambahkan karena melebihi limit`;
      }
      
      const count = await KomisiLink.countUnsent();
      
      res.json({
        success: true,
        message: message,
        count: count
      });
    } catch (error) {
      console.error('Error uploading Excel:', error);
      res.status(500).json({ error: 'Error processing Excel file: ' + error.message });
    }
  }
  
  static async getBatches(req, res) {
    try {
      const links = await KomisiLink.findUnsent();
      const config = await KomisiConfig.get();
      
      // Group links into batches of 100
      const batches = [];
      const batchSize = 100;
      
      for (let i = 0; i < links.length; i += batchSize) {
        const batchLinks = links.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        // Get HP label for this batch (use first link's label or default)
        const label = batchLinks[0]?.hp_label || `HP ${batchNumber}`;
        
        batches.push({
          batchNumber: batchNumber,
          label: label,
          links: batchLinks,
          startIndex: i + 1,
          endIndex: Math.min(i + batchSize, links.length),
          expanded: false // For UI state
        });
      }
      
      res.json({
        batches: batches,
        totalCount: links.length,
        maxLinks: config.max_links
      });
    } catch (error) {
      console.error('Error getting batches:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async updateBatchLabel(req, res) {
    try {
      const { batchNumber } = req.params;
      const { label } = req.body;
      
      if (!label) {
        return res.status(400).json({ error: 'Label is required' });
      }
      
      // Update all links in this batch
      await KomisiLink.updateBatchLabel(batchNumber, label);
      
      res.json({
        success: true,
        message: `Label batch ${batchNumber} berhasil diupdate`
      });
    } catch (error) {
      console.error('Error updating batch label:', error);
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
      // Get current config
      const config = await KomisiConfig.get();
      
      // Get current count
      const currentCount = await KomisiLink.countUnsent();
      const availableSlots = config.max_links - currentCount;
      
      if (availableSlots <= 0) {
        return {
          success: false,
          error: `Sudah mencapai limit ${config.max_links} link. Hapus link existing atau kirim ke HP terlebih dahulu.`
        };
      }
      
      let added = 0;
      let skipped = 0;
      
      console.log('Receiving links from Project 2:', links.length);
      
      for (const item of links) {
        // Stop if we reach the limit
        if (added >= availableSlots) {
          break;
        }
        
        const exists = await KomisiLink.existsUnsent(item.link);
        
        if (!exists) {
          // Calculate batch number
          const batchNumber = Math.floor((currentCount + added) / 100) + 1;
          
          await KomisiLink.create({
            link_produk: item.link,
            komisi_flag: true,
            batch_number: batchNumber
          });
          added++;
        } else {
          skipped++;
        }
      }
      
      const notAdded = links.length - added - skipped;
      
      console.log(`Added: ${added}, Skipped: ${skipped}, Not added (limit): ${notAdded}`);
      
      return {
        success: true,
        added,
        skipped,
        notAdded
      };
    } catch (error) {
      console.error('Error receiving from Project 2:', error);
      throw error;
    }
  }
  static async sendLinks(req, res) {
  try {
    const { hpLabel } = req.body;
    
    if (!hpLabel) {
      return res.status(400).json({ 
        success: false, 
        error: 'HP Label harus dipilih' 
      });
    }
    
    // Get unsent links (pakai model yang sudah ada)
    const links = await KomisiLink.getUnsentLimited(100);
    
    if (links.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Tidak ada link yang belum dikirim' 
      });
    }
    
    // Mark as sent dengan batch info
    const linkIds = links.map(link => link.id);
    const batchId = Date.now();
    
    await KomisiLink.markAsSent(linkIds, batchId);
    
    // Send FCM to all devices
    // const fcmResult = await FCMService.sendBatchToAll(batchId, links, hpLabel);

    res.json({
      success: true,
      message: `Batch berhasil dikirim untuk ${hpLabel}`,
      linkCount: links.length,
      hpLabel: hpLabel
      // fcmResult: fcmResult
    });
  } catch (error) {
    console.error('Error sending links:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

static async getLatestBatches(req, res) {
  try {
    const { getConnection } = require('../database/connection');
    const connection = getConnection();
    
    // Simple query - ambil batch 30 menit terakhir
    const [batches] = await connection.execute(
      `SELECT id, batch_id, hp_label, link_produk, sent_at
       FROM komisi_links 
       WHERE sent_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
       AND batch_id IS NOT NULL
       ORDER BY sent_at DESC
       LIMIT 100`,
      []
    );
    
    // Group by batch_id manually
    const groupedBatches = {};
    
    batches.forEach(row => {
      const batchKey = row.batch_id;
      if (!groupedBatches[batchKey]) {
        groupedBatches[batchKey] = {
          id: batchKey,
          hp_label: row.hp_label,
          links: [],
          created_at: row.sent_at
        };
      }
      groupedBatches[batchKey].links.push(row.link_produk);
    });
    
    const formattedBatches = Object.values(groupedBatches);
    
    console.log(`API /latest-batches returning ${formattedBatches.length} batches`);
    
    res.json({
      success: true,
      batches: formattedBatches
    });
  } catch (error) {
    console.error('Error getting latest batches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
}

module.exports = KomisiController;