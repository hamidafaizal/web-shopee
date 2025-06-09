#!/bin/bash

echo "🚀 Starting update to Web Viewer..."

# Create backup folder
echo "📦 Creating backup..."
mkdir -p backup_$(date +%Y%m%d_%H%M%S)
cp -r src backup_$(date +%Y%m%d_%H%M%S)/
cp server.js backup_$(date +%Y%m%d_%H%M%S)/

# 1. Update src/controllers/komisiController.js
echo "✏️  Updating komisiController.js..."
cat > src/controllers/komisiController.js << 'EOF'
// src/controllers/komisiController.js
const KomisiLink = require('../models/komisiLink');
const KomisiConfig = require('../models/komisiConfig');
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
    
    // Update dengan HP label yang benar
    await KomisiLink.markAsSentWithLabel(linkIds, batchId, hpLabel);

    res.json({
      success: true,
      message: `Batch berhasil dikirim untuk ${hpLabel}`,
      linkCount: links.length,
      hpLabel: hpLabel
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
}

module.exports = KomisiController;
EOF

# 2. Update src/models/komisiLink.js
echo "✏️  Updating komisiLink.js..."
cat > src/models/komisiLink.js << 'EOF'
// src/models/komisiLink.js
const { getConnection } = require('../database/connection');

class KomisiLink {
  static async create(data) {
    const connection = getConnection();
    const [result] = await connection.execute(
      'INSERT INTO komisi_links (link_produk, komisi_flag, hp_label, batch_number) VALUES (?, ?, ?, ?)',
      [data.link_produk, data.komisi_flag || true, data.hp_label || null, data.batch_number || 1]
    );
    return result;
  }
  
  static async findUnsent() {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM komisi_links WHERE sent_at IS NULL ORDER BY created_at ASC'
    );
    return rows;
  }
  
  static async countUnsent() {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as count FROM komisi_links WHERE sent_at IS NULL'
    );
    return rows[0].count;
  }
  
  static async existsUnsent(link) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT id FROM komisi_links WHERE link_produk = ? AND sent_at IS NULL LIMIT 1',
      [link]
    );
    return rows.length > 0;
  }
  
  static async markAsSent(ids, batchId) {
    const connection = getConnection();
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE komisi_links 
      SET sent_at = NOW(), batch_id = ? 
      WHERE id IN (${placeholders})
    `;
    const params = [batchId, ...ids];
    const [result] = await connection.execute(query, params);
    return result;
  }
  
  static async markAsSentWithLabel(ids, batchId, hpLabel) {
    const connection = getConnection();
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE komisi_links 
      SET sent_at = NOW(), batch_id = ?, hp_label = ? 
      WHERE id IN (${placeholders})
    `;
    const params = [batchId, hpLabel, ...ids];
    const [result] = await connection.execute(query, params);
    return result;
  }
  
  static async getUnsentLimited(limit = 100) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM komisi_links WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT ?',
      [limit]
    );
    return rows;
  }
  
  static async getUnsentDetailed(limit = 100) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT id, link_produk, hp_label, created_at FROM komisi_links WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT ?',
      [limit]
    );
    return rows;
  }
  
  static async deleteAllUnsent() {
    const connection = getConnection();
    const [result] = await connection.execute(
      'DELETE FROM komisi_links WHERE sent_at IS NULL'
    );
    return result;
  }
  
  static async setHPLabelForNext(limit, label) {
    const connection = getConnection();
    const [result] = await connection.execute(
      `UPDATE komisi_links 
       SET hp_label = ? 
       WHERE sent_at IS NULL 
       AND hp_label IS NULL
       ORDER BY created_at ASC 
       LIMIT ?`,
      [label, limit]
    );
    return result;
  }
  
  static async updateBatchLabel(batchNumber, label) {
    const connection = getConnection();
    
    // MariaDB compatible - gunakan subquery
    const [result] = await connection.execute(
      `UPDATE komisi_links 
       SET hp_label = ? 
       WHERE sent_at IS NULL 
       AND id IN (
         SELECT id FROM (
           SELECT id FROM komisi_links 
           WHERE sent_at IS NULL 
           ORDER BY created_at ASC 
           LIMIT 100
         ) tmp
       )`,
      [label]
    );
    return result;
  }

  static async getByHPLabel(label) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM komisi_links WHERE hp_label = ? AND sent_at IS NOT NULL ORDER BY created_at DESC',
      [label]
    );
    return rows;
  }

  static async markBatchCopied(batchId) {
    const connection = getConnection();
    await connection.execute(
      'UPDATE komisi_links SET copied_at = CURRENT_TIMESTAMP WHERE batch_id = ?',
      [batchId]
    );
  }

  static async deleteBatch(batchId) {
    const connection = getConnection();
    await connection.execute(
      'DELETE FROM komisi_links WHERE batch_id = ?',
      [batchId]
    );
  }
}

module.exports = KomisiLink;
EOF

# 3. Update src/routes/komisi.js
echo "✏️  Updating routes/komisi.js..."
cat > src/routes/komisi.js << 'EOF'
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

// Routes for Web Viewer
router.get('/viewer/:hpName', KomisiController.getActiveBatchForHP);
router.post('/viewer/mark-copied', KomisiController.markBatchAsCopied);

module.exports = router;
EOF

# 4. Update server.js
echo "✏️  Updating server.js..."
cat > server.js << 'EOF'
// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const komisiRoutes = require('./src/routes/komisi');
const { connectDB } = require('./src/database/connection');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve temp files
app.use('/temp', express.static(path.join(__dirname, 'public/temp')));

// Routes
app.use('/api', komisiRoutes);

// Web Viewer Routes
app.get('/view/:hpName', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/viewer.html'));
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
  console.log(`Web viewer available at http://localhost:${PORT}/view/hp1`);
});
EOF

# 5. Create new viewer files
echo "📄 Creating viewer.html..."
cat > public/viewer.html << 'EOF'
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Komisi Viewer</title>
    <link rel="manifest" href="/viewer-manifest.json">
    <meta name="theme-color" content="#21cbf3">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a1a;
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
        }
        
        .header {
            background: linear-gradient(45deg, #21cbf3, #2196f3);
            padding: 1rem;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .header h1 {
            font-size: 1.5rem;
            margin-bottom: 0.3rem;
        }
        
        .header .device-name {
            font-size: 2rem;
            font-weight: bold;
            color: #fff;
            background: rgba(0,0,0,0.2);
            padding: 0.3rem 1rem;
            border-radius: 20px;
            display: inline-block;
            margin-top: 0.5rem;
        }
        
        .main {
            flex: 1;
            padding: 1rem;
            display: flex;
            flex-direction: column;
        }
        
        .status {
            text-align: center;
            padding: 2rem;
            opacity: 0.7;
        }
        
        .status.loading {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            50% { opacity: 0.5; }
        }
        
        .batch-container {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1rem;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .batch-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .batch-info {
            font-size: 1.1rem;
        }
        
        .batch-count {
            background: #21cbf3;
            color: #000;
            padding: 0.3rem 0.8rem;
            border-radius: 20px;
            font-weight: bold;
        }
        
        .links-box {
            background: rgba(0,0,0,0.3);
            border-radius: 8px;
            padding: 1rem;
            max-height: 50vh;
            overflow-y: auto;
            margin-bottom: 1rem;
            font-family: monospace;
            font-size: 0.85rem;
            line-height: 1.5;
        }
        
        .links-box::-webkit-scrollbar {
            width: 6px;
        }
        
        .links-box::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.3);
            border-radius: 3px;
        }
        
        .link-item {
            padding: 0.3rem 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            word-break: break-all;
        }
        
        .link-item:last-child {
            border-bottom: none;
        }
        
        .copy-btn {
            width: 100%;
            padding: 1.2rem;
            font-size: 1.2rem;
            font-weight: bold;
            background: linear-gradient(45deg, #4caf50, #66bb6a);
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        
        .copy-btn:active {
            transform: scale(0.95);
        }
        
        .copy-btn.copied {
            background: linear-gradient(45deg, #2196f3, #21cbf3);
        }
        
        .footer {
            padding: 1rem;
            text-align: center;
            opacity: 0.6;
            font-size: 0.9rem;
        }
        
        .alert {
            position: fixed;
            top: 1rem;
            left: 1rem;
            right: 1rem;
            padding: 1rem;
            background: #4caf50;
            color: white;
            border-radius: 8px;
            text-align: center;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateY(-100px);
            transition: transform 0.3s ease;
            z-index: 1000;
        }
        
        .alert.show {
            transform: translateY(0);
        }
        
        .refresh-indicator {
            position: fixed;
            top: 80px;
            right: 1rem;
            background: rgba(255,255,255,0.1);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.8rem;
            opacity: 0.5;
        }
        
        @media (max-width: 480px) {
            .header h1 {
                font-size: 1.2rem;
            }
            .copy-btn {
                font-size: 1.1rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📱 Komisi Viewer</h1>
        <div class="device-name" id="deviceName">Loading...</div>
    </div>
    
    <div class="refresh-indicator" id="refreshIndicator">
        🔄 Auto refresh: <span id="countdown">5</span>s
    </div>
    
    <div class="main">
        <div id="content">
            <div class="status loading">
                <h2>⏳ Menunggu batch baru...</h2>
                <p>Sistem akan cek otomatis setiap 5 detik</p>
            </div>
        </div>
    </div>
    
    <div class="footer">
        <div id="lastUpdate">Last check: -</div>
    </div>
    
    <div class="alert" id="alert"></div>
    
    <script>
        // Get HP name from URL
        const pathParts = window.location.pathname.split('/');
        const hpName = pathParts[pathParts.length - 1].toUpperCase();
        let currentBatch = null;
        let refreshTimer = 5;
        
        // Initialize
        document.getElementById('deviceName').textContent = hpName;
        
        // Check for active batch
        async function checkBatch() {
            try {
                const response = await fetch(`/api/viewer/${hpName}`);
                const data = await response.json();
                
                if (data.success && data.batch) {
                    if (!currentBatch || currentBatch.id !== data.batch.id) {
                        currentBatch = data.batch;
                        renderBatch(data.batch);
                        showAlert('✅ Batch baru diterima!');
                    }
                } else if (currentBatch) {
                    // Batch sudah dicopy/hilang
                    currentBatch = null;
                    renderEmpty();
                }
                
                updateLastCheck();
            } catch (error) {
                console.error('Error checking batch:', error);
            }
        }
        
        function renderBatch(batch) {
            const content = document.getElementById('content');
            content.innerHTML = `
                <div class="batch-container">
                    <div class="batch-header">
                        <div class="batch-info">Batch Aktif</div>
                        <div class="batch-count">${batch.count} Links</div>
                    </div>
                    
                    <div class="links-box">
                        ${batch.links.map((link, i) => `
                            <div class="link-item">${link}</div>
                        `).join('')}
                    </div>
                    
                    <button class="copy-btn" onclick="copyLinks()">
                        📋 COPY SEMUA LINK
                    </button>
                </div>
            `;
        }
        
        function renderEmpty() {
            const content = document.getElementById('content');
            content.innerHTML = `
                <div class="status">
                    <h2>✅ Tidak ada batch aktif</h2>
                    <p>Menunggu batch baru dari admin...</p>
                </div>
            `;
        }
        
        async function copyLinks() {
            if (!currentBatch) return;
            
            const linksText = currentBatch.links.join('\n');
            
            try {
                await navigator.clipboard.writeText(linksText);
                
                // Update button
                const btn = document.querySelector('.copy-btn');
                btn.innerHTML = '✅ BERHASIL DICOPY!';
                btn.classList.add('copied');
                
                // Mark as copied after 2 seconds
                setTimeout(async () => {
                    await markAsCopied(currentBatch.id);
                    currentBatch = null;
                    renderEmpty();
                    showAlert('✅ Batch berhasil dicopy dan dihapus');
                }, 2000);
                
            } catch (err) {
                // Fallback untuk browser lama
                const textarea = document.createElement('textarea');
                textarea.value = linksText;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                
                // Same flow as above
                const btn = document.querySelector('.copy-btn');
                btn.innerHTML = '✅ BERHASIL DICOPY!';
                btn.classList.add('copied');
                
                setTimeout(async () => {
                    await markAsCopied(currentBatch.id);
                    currentBatch = null;
                    renderEmpty();
                    showAlert('✅ Batch berhasil dicopy dan dihapus');
                }, 2000);
            }
        }
        
        async function markAsCopied(batchId) {
            try {
                await fetch('/api/viewer/mark-copied', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ batchId })
                });
            } catch (error) {
                console.error('Error marking as copied:', error);
            }
        }
        
        function showAlert(message) {
            const alert = document.getElementById('alert');
            alert.textContent = message;
            alert.classList.add('show');
            
            setTimeout(() => {
                alert.classList.remove('show');
            }, 3000);
        }
        
        function updateLastCheck() {
            const now = new Date().toLocaleTimeString('id-ID');
            document.getElementById('lastUpdate').textContent = `Last check: ${now}`;
        }
        
        // Countdown timer
        function updateCountdown() {
            refreshTimer--;
            document.getElementById('countdown').textContent = refreshTimer;
            
            if (refreshTimer <= 0) {
                refreshTimer = 5;
                checkBatch();
            }
        }
        
        // Start checking
        checkBatch();
        setInterval(updateCountdown, 1000);
        
        // PWA install prompt
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/viewer-sw.js')
                .catch(err => console.log('SW registration failed'));
        }
    </script>
</body>
</html>
EOF

echo "📄 Creating viewer-manifest.json..."
cat > public/viewer-manifest.json << 'EOF'
{
  "name": "Komisi Viewer",
  "short_name": "Komisi",
  "description": "Simple viewer untuk copy link komisi",
  "start_url": "/view/hp1",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#21cbf3",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
EOF

echo "📄 Creating viewer-sw.js..."
cat > public/viewer-sw.js << 'EOF'
// Simple Service Worker - Cache only
const CACHE_NAME = 'komisi-viewer-v1';
const urlsToCache = [
  '/viewer.html',
  '/viewer-manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install - cache basic files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip API calls - always go to network
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone response for cache
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseToCache));
        
        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request);
      })
  );
});
EOF

# 6. Create icons directory
echo "📁 Creating icons directory..."
mkdir -p public/icons

# 7. Update index.html HP dropdown
echo "✏️  Updating public/index.html for HP 1-30..."
# Backup index.html
cp public/index.html public/index.html.bak

# Update dengan sed untuk generate HP options
sed -i.bak2 '/<select onchange="updateBatchLabel/,/<\/select>/c\
                                <select onchange="updateBatchLabel(${batch.batchNumber}, this.value)">\
                                    ${generateHPOptions(batch.label)}\
                                </select>' public/index.html

# Add generateHPOptions function jika belum ada
if ! grep -q "generateHPOptions" public/index.html; then
    sed -i.bak3 '/async function loadBatches()/i\
        // Generate HP options 1-30\
        function generateHPOptions(selectedLabel) {\
            let options = "";\
            for (let i = 1; i <= 30; i++) {\
                const label = `HP ${i}`;\
                const selected = label === selectedLabel ? "selected" : "";\
                options += `<option value="${label}" ${selected}>${label}</option>`;\
            }\
            return options;\
        }\
' public/index.html
fi

# 8. Optional: Remove old files
echo "🗑️  Cleaning up old files (optional)..."
if [ -f "src/services/fcmService.js" ]; then
    rm -f src/services/fcmService.js
    echo "   - Removed fcmService.js"
fi

if [ -f "src/controllers/mobileController.js" ]; then
    rm -f src/controllers/mobileController.js
    echo "   - Removed mobileController.js"
fi

if [ -f "src/models/mobileDevice.js" ]; then
    rm -f src/models/mobileDevice.js
    echo "   - Removed mobileDevice.js"
fi

if [ -f "src/routes/mobile.js" ]; then
    rm -f src/routes/mobile.js
    echo "   - Removed mobile.js routes"
fi

echo ""
echo "✅ Update completed successfully!"
echo ""
echo "📌 Next steps:"
echo "1. Create icon files in public/icons/ folder:"
echo "   - icon-192.png (192x192 pixels)"
echo "   - icon-512.png (512x512 pixels)"
echo ""
echo "2. Start server:"
echo "   npm start"
echo ""
echo "3. Start ngrok in new terminal:"
echo "   ngrok http 3000"
echo ""
echo "4. Test viewer at:"
echo "   https://YOUR-NGROK-URL.ngrok.io/view/hp1"
echo ""
echo "📁 Backup created in: backup_$(date +%Y%m%d_%H%M%S)/"