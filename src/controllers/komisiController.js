// src/controllers/komisiController.js
const KomisiLink = require('../models/komisiLink');
const KomisiConfig = require('../models/komisiConfig');
const HPNumber = require('../models/hpNumber');
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
        
        // Ensure links are properly formatted
        const formattedLinks = batchLinks.map(link => {
          // If link is an object with link_produk property
          if (typeof link === 'object' && link.link_produk) {
            return link.link_produk;
          }
          // If link is already a string
          return link;
        });
        
        batches.push({
          batchNumber: batchNumber,
          label: label,
          links: formattedLinks,
          startIndex: i + 1,
          endIndex: Math.min(i + batchSize, links.length),
          expanded: false
        });
      }
      
      res.json({
        batches: batches,
        totalCount: links.length,
        maxLinks: config.max_links
      });
    } catch (error) {
      console.error('Error getting batches:', error);
      res.status(500).json({ error: 'Internal server error: ' + error.message });
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
    
    console.log('=== SEND LINKS DEBUG ===');
    console.log('Received hpLabel:', hpLabel);
    
    if (!hpLabel) {
      return res.status(400).json({ 
        success: false, 
        error: 'HP Label harus dipilih' 
      });
    }
    
    // Get unsent links
    const links = await KomisiLink.getUnsentLimited(100);
    console.log('Found unsent links:', links.length);
    
    if (links.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Tidak ada link yang belum dikirim' 
      });
    }
    
    // Debug: show first few links
    console.log('First 3 links:', links.slice(0, 3).map(l => ({
      id: l.id,
      link: l.link_produk?.substring(0, 50) + '...',
      current_label: l.hp_label
    })));
    
    // Mark as sent dengan batch info
    const linkIds = links.map(link => link.id);
    const batchId = Date.now();
    
    console.log('Updating with:');
    console.log('- Batch ID:', batchId);
    console.log('- HP Label:', hpLabel);
    console.log('- Link IDs:', linkIds.slice(0, 5), '...');
    
    // Update dengan HP label yang benar
    await KomisiLink.markAsSentWithLabel(linkIds, batchId, hpLabel);
    
    // Verify update
    const { getConnection } = require('../database/connection');
    const connection = getConnection();
    const [updated] = await connection.execute(
      'SELECT COUNT(*) as count FROM komisi_links WHERE batch_id = ? AND hp_label = ?',
      [batchId, hpLabel]
    );
    
    console.log('Verified updated:', updated[0].count, 'rows');

    res.json({
      success: true,
      message: `Batch berhasil dikirim untuk ${hpLabel}`,
      linkCount: links.length,
      hpLabel: hpLabel,
      batchId: batchId
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

// New method for web viewer - get active batch for specific HP
static async getActiveBatchForHP(req, res) {
  try {
    const { hpName } = req.params;
    const { getConnection } = require('../database/connection');
    const connection = getConnection();
    
    // Get latest batch for this HP that hasn't been copied
    const [batches] = await connection.execute(
      `SELECT id, batch_id, hp_label, link_produk, sent_at
       FROM komisi_links 
       WHERE hp_label = ?
       AND batch_id IS NOT NULL
       AND copied_at IS NULL
       ORDER BY sent_at DESC
       LIMIT 100`,
      [hpName.toUpperCase()]
    );
    
    if (batches.length === 0) {
      return res.json({
        success: true,
        batch: null,
        message: 'Tidak ada batch aktif'
      });
    }
    
    // Group by batch_id
    const batchId = batches[0].batch_id;
    const links = batches.map(row => row.link_produk);
    
    res.json({
      success: true,
      batch: {
        id: batchId,
        hp_label: batches[0].hp_label,
        links: links,
        created_at: batches[0].sent_at,
        count: links.length
      }
    });
  } catch (error) {
    console.error('Error getting active batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Mark batch as copied
static async markBatchAsCopied(req, res) {
  try {
    const { batchId } = req.body;
    const { getConnection } = require('../database/connection');
    const connection = getConnection();
    
    await connection.execute(
      'UPDATE komisi_links SET copied_at = NOW() WHERE batch_id = ?',
      [batchId]
    );
    
    res.json({
      success: true,
      message: 'Batch marked as copied'
    });
  } catch (error) {
    console.error('Error marking batch as copied:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

static async sendToWhatsApp(req, res) {
  try {
    const { hpLabel } = req.body;
    
    if (!hpLabel) {
      return res.status(400).json({ 
        success: false, 
        error: 'HP Label harus dipilih' 
      });
    }
    
    // Get phone number
    const hpData = await HPNumber.getByLabel(hpLabel);
    if (!hpData) {
      return res.status(404).json({
        success: false,
        error: `Nomor telepon untuk ${hpLabel} tidak ditemukan`
      });
    }
    
    // Get unsent links
    const links = await KomisiLink.getUnsentLimited(100);
    
    if (links.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Tidak ada link yang belum dikirim' 
      });
    }
    
    // Format links for WhatsApp
    const message = links.map(link => link.link_produk).join('\n');
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Create WhatsApp URL
    const whatsappUrl = `https://web.whatsapp.com/send?phone=${hpData.phone_number}&text=${encodedMessage}`;
    
    // Mark links as sent
    const linkIds = links.map(link => link.id);
    const batchId = Date.now();
    await KomisiLink.markAsSentWithLabel(linkIds, batchId, hpLabel);
    
    res.json({
      success: true,
      message: `WhatsApp siap dikirim untuk ${hpLabel}`,
      whatsappUrl: whatsappUrl,
      linkCount: links.length,
      phoneNumber: hpData.phone_number.substring(0, 6) + '****' // Hide partial number
    });
    
  } catch (error) {
    console.error('Error sending to WhatsApp:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

static async getHPNumbers(req, res) {
  try {
    const numbers = await HPNumber.getAll();
    res.json({
      success: true,
      numbers: numbers
    });
  } catch (error) {
    console.error('Error getting HP numbers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

static async updateHPNumber(req, res) {
  try {
    const { label, phoneNumber, name } = req.body;
    
    if (!label || !phoneNumber) {
      return res.status(400).json({ 
        error: 'Label dan nomor telepon harus diisi' 
      });
    }
    
    // Validate phone number format
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (!cleanNumber.startsWith('62') || cleanNumber.length < 11) {
      return res.status(400).json({ 
        error: 'Format nomor harus 62xxx (contoh: 6281234567890)' 
      });
    }
    
    await HPNumber.update(label, cleanNumber, name);
    
    res.json({
      success: true,
      message: `Nomor ${label} berhasil diupdate`
    });
  } catch (error) {
    console.error('Error updating HP number:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
}

module.exports = KomisiController;
