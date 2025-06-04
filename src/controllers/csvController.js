// src/controllers/csvController.js
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const KomisiController = require('./komisiController');

class CSVController {
  static async uploadAndFilterMultipleCSV(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const kategori = req.body.kategori || 'HASIL_FILTER';
      const rankFrom = parseInt(req.body.rankFrom) || 1;
      const rankTo = parseInt(req.body.rankTo) || 100;

      const allFilteredData = [];
      const processedLinks = new Set();
      let totalAdCount = 0;
      let totalSalesCount = 0;

      // Process each file
      for (const file of req.files) {
        const csvContent = file.buffer.toString('utf-8');
        const lines = csvContent.split('\n');
        
        // Get headers
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Find column indices
        const trenIndex = headers.findIndex(h => h.toLowerCase().includes('tren'));
        const isAdIndex = headers.findIndex(h => h.toLowerCase().includes('isad'));
        const penjualanIndex = headers.findIndex(h => h.toLowerCase().includes('penjualan'));
        const linkIndex = headers.findIndex(h => h.toLowerCase().includes('link') || h.toLowerCase().includes('productlink'));

        if (linkIndex === -1) continue;

        // Step 1: Filter Tren = "NAIK"
        const naikProducts = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const columns = parseCSVLine(line);
          const tren = trenIndex !== -1 ? columns[trenIndex]?.trim() : '';
          
          if (tren && tren.toUpperCase().includes('NAIK')) {
            naikProducts.push(columns);
          }
        }

        // Step 2: Separate by isAd
        const adProducts = [];
        const nonAdProducts = [];

        naikProducts.forEach(columns => {
          const isAd = isAdIndex !== -1 ? columns[isAdIndex]?.trim() : '';
          const link = columns[linkIndex]?.trim();
          const penjualan = penjualanIndex !== -1 ? parseInt(columns[penjualanIndex]) || 0 : 0;

          if (!link) return;

          if (isAd && isAd.toLowerCase() === 'yes') {
            adProducts.push({ link, penjualan, type: 'Iklan', source: file.originalname });
          } else {
            nonAdProducts.push({ link, penjualan, type: 'Top Sales', source: file.originalname });
          }
        });

        // Step 3: Sort non-ad products by sales and take ranking
        nonAdProducts.sort((a, b) => b.penjualan - a.penjualan);
        const rankedNonAd = nonAdProducts.slice(rankFrom - 1, Math.min(rankTo, nonAdProducts.length));

        // Step 4: Combine results from this file
        allFilteredData.push(...adProducts);
        allFilteredData.push(...rankedNonAd);
        
        totalAdCount += adProducts.length;
        totalSalesCount += rankedNonAd.length;
      }

      // Remove duplicates across all files
      const uniqueResults = [];
      allFilteredData.forEach(item => {
        if (!processedLinks.has(item.link)) {
          processedLinks.add(item.link);
          uniqueResults.push({
            link: item.link,
            type: item.type,
            source: item.source,
            checked: false
          });
        }
      });

      res.json({
        success: true,
        message: `Berhasil memfilter ${uniqueResults.length} link dari ${req.files.length} file.`,
        results: uniqueResults,
        adCount: totalAdCount,
        salesCount: totalSalesCount,
        totalCount: uniqueResults.length,
        kategori: kategori.toUpperCase()
      });

    } catch (error) {
      console.error('Error processing CSV:', error);
      res.status(500).json({ error: 'Error processing CSV files: ' + error.message });
    }
  }

  static async generateExcel(req, res) {
    try {
      const { results, kategori } = req.body;
      
      if (!results || results.length === 0) {
        return res.status(400).json({ error: 'No data to generate Excel' });
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare data with checkbox column
      const excelData = results.map(item => ({
        'Link Produk': item.link,
        'Komisi ✅': ''
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Add checkbox formatting (Excel checkbox requires special handling)
      // For simplicity, we'll use empty cells that users can manually check
      
      XLSX.utils.book_append_sheet(wb, ws, 'Filtered Links');
      
      // Generate file
      const fileName = `${kategori}_${Date.now()}.xlsx`;
      const filePath = path.join(__dirname, '../../public/temp', fileName);
      
      // Ensure temp directory exists
      await fs.mkdir(path.join(__dirname, '../../public/temp'), { recursive: true });
      
      // Write file
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      await fs.writeFile(filePath, buffer);
      
      const downloadUrl = `/temp/${fileName}`;
      
      // Delete file after 5 minutes
      setTimeout(async () => {
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error('Error deleting temp file:', err);
        }
      }, 5 * 60 * 1000);

      res.json({
        success: true,
        downloadUrl: downloadUrl,
        kategori: kategori.toUpperCase()
      });

    } catch (error) {
      console.error('Error generating Excel:', error);
      res.status(500).json({ error: 'Error generating Excel file' });
    }
  }

  static async sendToProject1(req, res) {
    try {
      const { links } = req.body;
      
      console.log('Received request to send to Project 1:', links);
      
      if (!links || links.length === 0) {
        return res.status(400).json({ error: 'No links to send' });
      }

      // Send to Project 1
      const result = await KomisiController.receiveFromProject2(links);
      
      res.json({
        success: true,
        message: `${result.added} link berhasil ditambahkan ke Proyek 1, ${result.skipped} link sudah ada.`,
        added: result.added,
        skipped: result.skipped
      });

    } catch (error) {
      console.error('Error sending to Project 1:', error);
      res.status(500).json({ error: 'Error sending to Project 1: ' + error.message });
    }
  }
}

// Helper function to parse CSV line with comma in quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

module.exports = CSVController;