const axios = require('axios');
const cheerio = require('cheerio');

const HARGA_EMAS_URL = 'https://harga-emas.org';

/**
 * Scrape harga emas dari harga-emas.org
 * @returns {Promise<Object>} Data harga emas
 */
async function scrapeGoldPrice() {
  try {
    console.log(`[${new Date().toISOString()}] Scraping ${HARGA_EMAS_URL}...`);

    const response = await axios.get(HARGA_EMAS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    const html = response.data;

    // Extract harga Antam per gram dari tabel
    const antamPrices = extractAntamTablePrices(html);
    
    // Extract harga buyback
    const buybackPrice = extractBuybackPrice(html);

    // Extract update time
    const updateTime = extractUpdateTime(html);

    const result = {
      source: 'harga-emas.org',
      url: HARGA_EMAS_URL,
      scrapedAt: new Date().toISOString(),
      updateTime: updateTime,
      buybackPrice: buybackPrice,
      antam: antamPrices
    };

    console.log(`[${new Date().toISOString()}] Scraping selesai. Ditemukan ${antamPrices.length} data harga Antam.`);
    
    return result;

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error scraping:`, error.message);
    throw error;
  }
}

/**
 * Extract harga Antam dari tabel per gram
 * Mencari pattern: 1000 gram = Rp 2.943.600.000, dll
 */
function extractAntamTablePrices(html) {
  const prices = [];

  // Pattern untuk mencari harga per satuan gram
  // Format: "1000" diikuti dengan harga seperti "2.943.600.000"
  const weightPatterns = [
    { weight: 1000, regex: /1000[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 500, regex: /500[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 250, regex: /250[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 100, regex: /100[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 50, regex: /\b50[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 25, regex: /\b25[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 10, regex: /\b10[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 5, regex: /\b5[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 2, regex: /\b2[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 1, regex: /\b1[^0-9]*?([\d.,]+\.000\.000)/i },
    { weight: 0.5, regex: /0[.,]5[^0-9]*?([\d.,]+\.500)/i },
  ];

  // Cari semua angka yang terlihat seperti harga emas (format: X.XXX.XXX.XXX atau X.XXX.XXX)
  // Harga Antam biasanya dalam jutaan sampai miliaran
  
  // Pattern lebih spesifik untuk tabel Antam
  // Mencari: angka gram diikuti harga dalam format Indonesia
  
  const tableDataRegex = /(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)?\s*[^\d]*?([\d]{1,3}(?:\.[\d]{3})+)/gi;
  
  let match;
  const foundPrices = new Map();
  
  while ((match = tableDataRegex.exec(html)) !== null) {
    const weight = parseFloat(match[1].replace(',', '.'));
    const priceStr = match[2];
    const price = parseInt(priceStr.replace(/\./g, ''));
    
    // Validasi: harga harus masuk akal untuk emas
    // 1 gram emas ~3 juta, jadi 1000 gram ~3 miliar
    const pricePerGram = price / weight;
    
    if (pricePerGram >= 2000000 && pricePerGram <= 5000000) {
      // Hanya simpan jika belum ada atau harga lebih tinggi (harga jual)
      if (!foundPrices.has(weight) || foundPrices.get(weight).price < price) {
        foundPrices.set(weight, { weight, price });
      }
    }
  }

  // Alternatif: cari langsung dari pattern harga yang diketahui
  const knownWeights = [1000, 500, 250, 100, 50, 25, 10, 5, 2, 1, 0.5];
  
  for (const w of knownWeights) {
    // Cari pattern seperti: 2.943.600.000 (untuk 1000g), 1.471.820.000 (untuk 500g), dll
    let searchWeight = w === 0.5 ? '0[.,]5' : w.toString();
    
    // Pattern: weight diikuti oleh harga (dengan beberapa karakter di antaranya)
    const regex = new RegExp(searchWeight + '[^\\d]{0,50}?([\\d]{1,3}(?:\\.[\\d]{3}){2,3})', 'g');
    
    let priceMatch;
    while ((priceMatch = regex.exec(html)) !== null) {
      const priceStr = priceMatch[1];
      const price = parseInt(priceStr.replace(/\./g, ''));
      
      // Validasi harga per gram
      const pricePerGram = price / w;
      
      if (pricePerGram >= 2500000 && pricePerGram <= 4000000) {
        if (!foundPrices.has(w) || foundPrices.get(w).price < price) {
          foundPrices.set(w, { weight: w, price });
        }
      }
    }
  }

  // Convert Map ke Array dan format
  foundPrices.forEach((data, weight) => {
    prices.push({
      weight: weight,
      weightUnit: 'gram',
      type: `Antam ${weight}g`,
      sellPrice: data.price,
      sellPriceFormatted: `Rp ${data.price.toLocaleString('id-ID')}`,
      pricePerGram: Math.round(data.price / weight),
      pricePerGramFormatted: `Rp ${Math.round(data.price / weight).toLocaleString('id-ID')}/gram`
    });
  });

  // Sort by weight descending
  prices.sort((a, b) => b.weight - a.weight);

  return prices;
}

/**
 * Extract harga buyback (pembelian kembali)
 */
function extractBuybackPrice(html) {
  // Pattern: "Harga pembelian kembali: RpX.XXX.XXX"
  const buybackMatch = html.match(/(?:pembelian kembali|buyback)[^R]*Rp\s*([\d.,]+)/i);
  
  if (buybackMatch) {
    const priceStr = buybackMatch[1].replace(/[.,]/g, '');
    const price = parseInt(priceStr);
    
    if (price >= 2000000 && price <= 5000000) {
      return {
        price: price,
        priceFormatted: `Rp ${price.toLocaleString('id-ID')}`,
        type: 'Buyback per gram'
      };
    }
  }

  // Alternatif pattern
  const altMatch = html.match(/Rp\s*(2\.8[\d]{2}\.[\d]{3})/);
  if (altMatch) {
    const price = parseInt(altMatch[1].replace(/\./g, ''));
    return {
      price: price,
      priceFormatted: `Rp ${price.toLocaleString('id-ID')}`,
      type: 'Buyback per gram'
    };
  }

  return null;
}

/**
 * Extract waktu update
 */
function extractUpdateTime(html) {
  // Pattern: "Update harga LM Antam: 28 Januari 2026 pukul 12.30"
  const timeMatch = html.match(/Update[^:]*:\s*(\d{1,2}\s+\w+\s+\d{4}[^<]*pukul\s*[\d.:]+)/i);
  
  if (timeMatch) {
    return timeMatch[1].trim();
  }

  // Alternatif pattern
  const altMatch = html.match(/(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4})/i);
  
  if (altMatch) {
    return altMatch[1];
  }

  return null;
}

module.exports = { scrapeGoldPrice };
