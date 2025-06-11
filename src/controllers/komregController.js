const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Convert file to Gemini format
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType
    },
  };
}

// Parse Gemini response
function parseGeminiResponse(text) {
  const results = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    // Pattern untuk menangkap berbagai format
    const patterns = [
      /Produk\s*(\d+)\s*:\s*(\d+(?:\.\d+)?)\s*%/i,  // Produk X: Y%
      /Produk\s*(\d+)\s*:\s*(\d+(?:\.\d+)?)\%/i,     // Produk X: Y%
      /Produk\s*(\d+)\s*:\s*0\s*%/i,                 // Produk X: 0%
      /Produk\s*(\d+)\s*:\s*Tidak ada/i,             // Produk X: Tidak ada
      /Produk\s*(\d+)\s*:\s*-/i                      // Produk X: -
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        if (match[0].toLowerCase().includes('tidak ada') || match[0].includes('-')) {
          results.push('0%');
        } else if (match[2] !== undefined) {
          results.push(match[2] + '%');
        } else {
          results.push('0%');
        }
        break;
      }
    }
  });
  
  return results;
}

exports.processKomregImages = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key belum diset. Silakan set GEMINI_API_KEY di file .env' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Tidak ada gambar yang diupload' });
    }

    const results = [];
    let productNumber = 1;
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    for (const file of req.files) {
      const imagePath = file.path;
      try {
        const imagePart = fileToGenerativePart(imagePath, file.mimetype);

        // Ganti prompt dengan instruksi baru:
        const prompt = `Analisa screenshot produk Shopee ini.

CARA MEMBACA KOMISI:
1. Temukan CHECKLIST ORANYE (✓) di sebelah KIRI setiap produk
2. Dari checklist, lihat SEJAJAR KE KANAN untuk menemukan area informasi produk
3. Di area informasi produk, cari:
   - Teks "Komisi hingga X%" (warna oranye, posisi DI ATAS harga)
   - Harga "RpXXX" (warna oranye, posisi DI BAWAH komisi)
4. Jika tidak ada teks "Komisi hingga X%" = komisi 0%

PENTING:
- Abaikan nama produk dan deskripsi
- Fokus pada: checklist → sejajar kanan → cari komisi di atas harga
- SETIAP produk dengan checklist oranye HARUS dihitung
- Produk terpotong tetap hitung (komisi 0% jika info tidak terlihat)

Format jawaban WAJIB:
Produk 1: [nilai]%
Produk 2: [nilai]%
Produk 3: [nilai]%
(dan seterusnya untuk semua produk yang terlihat)

Jika produk tidak memiliki komisi, tulis:
Produk X: 0%

Sekarang analisa screenshot ini:`;

        // Retry logic jika parsing gagal
        let attempts = 0;
        let products = [];
        while (attempts < 2 && products.length === 0) {
          const result = await model.generateContent([prompt, imagePart]);
          const response = await result.response;
          const text = response.text();
          products = parseGeminiResponse(text);
          attempts++;
        }

        // Validasi minimal 1 produk
        if (products.length === 0) {
          results.push({
            productNumber: productNumber++,
            komisi: '0%'
          });
        } else {
          products.forEach(commission => {
            results.push({
              productNumber: productNumber++,
              komisi: commission || '0%'  // Default 0% jika undefined
            });
          });
        }

      } catch (error) {
        results.push({
          productNumber: productNumber++,
          komisi: 'Error membaca'
        });
      } finally {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses gambar', details: error.message });
  }
};