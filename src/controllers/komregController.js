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
    // Cari pattern "Produk X: Y%" atau variasi lainnya
    const match = line.match(/Produk\s*(\d+)\s*:\s*(\d+)%/i) || 
                  line.match(/Produk\s*(\d+)\s*:\s*(\d+)\s*%/i) ||
                  line.match(/Produk\s*(\d+)\s*:\s*Tidak ada/i);
    
    if (match) {
      if (match[0].toLowerCase().includes('tidak ada')) {
        results.push('Tidak ada');
      } else if (match[2]) {
        results.push(match[2] + '%');
      }
    }
  });
  
  // Jika parsing gagal, coba cari angka dengan %
  if (results.length === 0) {
    const percentMatches = text.matchAll(/(\d+)%/g);
    for (const match of percentMatches) {
      results.push(match[1] + '%');
    }
  }
  
  console.log('Parsed results:', results); // Untuk debugging
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
        const prompt = `Analisa screenshot produk Shopee ini.

PERHATIKAN:
1. Setiap produk memiliki gambar produk di sebelah kiri
2. Informasi komisi terletak di bawah nama produk, dengan format:
   - "Komisi hingga X%" (teks oranye)
   - Badge "KOMISIXTRA" biasanya muncul bersamaan
3. Format harga dalam Rupiah (Rp)
4. Ada informasi terjual di sebelah kanan

INSTRUKSI:
- Identifikasi SEMUA produk dalam screenshot
- Baca nilai komisi yang tertulis "Komisi hingga X%"
- Jika tidak ada teks "Komisi hingga", berarti produk tersebut tidak ada komisi
- Hitung produk dari ATAS ke BAWAH

Format jawaban WAJIB:
Produk 1: [nilai]%
Produk 2: [nilai]%
Produk 3: [nilai]%
(dan seterusnya untuk semua produk yang terlihat)

Contoh berdasarkan yang terlihat:
Produk 1: 17%
Produk 2: 3%
Produk 3: 8%
Produk 4: 1%

Sekarang analisa screenshot ini:`;

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