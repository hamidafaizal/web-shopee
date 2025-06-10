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
    const match = line.match(/Produk\s*\d+\s*:\s*(.+)/i);
    if (match) {
      let commission = match[1].trim();
      if (commission.toLowerCase().includes('tidak ada')) {
        commission = 'Tidak ada';
      } else {
        const percentMatch = commission.match(/(\d+)\s*%/);
        if (percentMatch) {
          commission = percentMatch[1] + '%';
        } else if (commission.match(/^\d+$/)) {
          commission = commission + '%';
        }
      }
      results.push(commission);
    }
  });
  if (results.length === 0) {
    results.push('Tidak ada');
  }
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
        const prompt = `Analisa screenshot Shopee ini dan identifikasi SEMUA produk beserta nilai komisinya.

Instruksi:
1. Cari nilai komisi (biasanya "Komisi hingga X%" atau simbol 💰 diikuti persentase)
2. Hitung SEMUA produk dari atas ke bawah
3. Jika tidak ada komisi untuk suatu produk, tulis "Tidak ada"
4. Perhatikan badge orange/merah yang mungkin berisi info komisi

Format jawaban HARUS seperti ini:
Produk 1: [nilai]%
Produk 2: [nilai]%
Produk 3: [nilai]%
(lanjutkan untuk semua produk)

Contoh:
Produk 1: 15%
Produk 2: Tidak ada
Produk 3: 8%`;

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();
        const products = parseGeminiResponse(text);

        products.forEach(commission => {
          results.push({
            productNumber: productNumber++,
            komisi: commission
          });
        });

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