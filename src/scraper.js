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

    // Method 1: Extract from JSON-LD Schema
    let schemaPrice = null;
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json['@type'] === 'Product' && json.offers?.price) {
          schemaPrice = {
            type: 'Emas (Schema)',
            price: json.offers.price,
            currency: json.offers.priceCurrency || 'IDR',
            description: json.description
          };
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Method 2: Extract from Next.js embedded data
    const nextDataPrices = extractNextJsData(html);

    // Method 3: Extract from visible text patterns
    const textPrices = extractFromText($);

    // Combine all extracted prices
    const allPrices = [];

    if (schemaPrice) {
      allPrices.push({
        source: 'schema',
        type: 'Harga Emas (Schema)',
        price: schemaPrice.price,
        priceFormatted: `Rp ${schemaPrice.price.toLocaleString('id-ID')}`,
        currency: schemaPrice.currency
      });
    }

    if (nextDataPrices.length > 0) {
      allPrices.push(...nextDataPrices);
    }

    if (textPrices.length > 0) {
      allPrices.push(...textPrices);
    }

    const result = {
      source: 'harga-emas.org',
      url: HARGA_EMAS_URL,
      scrapedAt: new Date().toISOString(),
      prices: allPrices,
      // Legacy format for compatibility
      antam: allPrices.map(p => ({
        weight: p.weight || 1,
        weightUnit: 'gram',
        type: p.type,
        buyPrice: p.buyPrice || p.price,
        sellPrice: p.sellPrice || p.price,
        buyPriceFormatted: p.buyPriceFormatted || p.priceFormatted,
        sellPriceFormatted: p.sellPriceFormatted || p.priceFormatted
      }))
    };

    console.log(`[${new Date().toISOString()}] Scraping selesai. Ditemukan ${allPrices.length} data harga.`);
    
    return result;

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error scraping:`, error.message);
    throw error;
  }
}

/**
 * Extract price data from Next.js embedded scripts
 * @param {string} html - Raw HTML content
 * @returns {Array} Array of price objects
 */
function extractNextJsData(html) {
  const prices = [];

  try {
    // Pattern 1: Look for goldPriceHistoryData in script
    const goldPriceMatch = html.match(/"goldPriceHistoryData":\s*(\{[^}]+(?:\{[^}]*\}[^}]*)*\})/);
    if (goldPriceMatch) {
      try {
        // Clean and parse
        let jsonStr = goldPriceMatch[1];
        // Fix escaped quotes
        jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        const data = JSON.parse(jsonStr);
        
        if (data.current) {
          prices.push({
            source: 'nextjs',
            type: 'Harga Emas Pluang',
            price: data.current.midPrice,
            buyPrice: data.current.buy,
            sellPrice: data.current.sell,
            priceFormatted: `Rp ${data.current.midPrice?.toLocaleString('id-ID')}`,
            buyPriceFormatted: `Rp ${data.current.buy?.toLocaleString('id-ID')}`,
            sellPriceFormatted: `Rp ${data.current.sell?.toLocaleString('id-ID')}`,
            updatedAt: data.current.updated_at
          });
        }
      } catch (e) {
        console.log('[Scraper] Could not parse goldPriceHistoryData:', e.message);
      }
    }

    // Pattern 2: Look for price patterns like "midPrice":3003845
    const midPriceMatch = html.match(/"midPrice":(\d+)/);
    const sellMatch = html.match(/"sell":(\d+)/);
    const buyMatch = html.match(/"buy":(\d+)/);

    if (midPriceMatch || sellMatch || buyMatch) {
      const midPrice = midPriceMatch ? parseInt(midPriceMatch[1]) : null;
      const sell = sellMatch ? parseInt(sellMatch[1]) : null;
      const buy = buyMatch ? parseInt(buyMatch[1]) : null;

      // Only add if we don't already have this price
      const existingMid = prices.find(p => p.price === midPrice);
      if (!existingMid && (midPrice || sell || buy)) {
        prices.push({
          source: 'regex',
          type: 'Harga Emas (Live)',
          price: midPrice || sell || buy,
          buyPrice: buy,
          sellPrice: sell,
          priceFormatted: `Rp ${(midPrice || sell || buy)?.toLocaleString('id-ID')}`,
          buyPriceFormatted: buy ? `Rp ${buy.toLocaleString('id-ID')}` : null,
          sellPriceFormatted: sell ? `Rp ${sell.toLocaleString('id-ID')}` : null
        });
      }
    }

    // Pattern 3: Look for Antam specific prices
    const antamBuybackMatch = html.match(/Harga pembelian kembali[^R]*Rp([\d.,]+)/i);
    if (antamBuybackMatch) {
      const price = parseInt(antamBuybackMatch[1].replace(/[.,]/g, ''));
      prices.push({
        source: 'text',
        type: 'Antam Buyback',
        price: price,
        sellPrice: price,
        priceFormatted: `Rp ${price.toLocaleString('id-ID')}`,
        sellPriceFormatted: `Rp ${price.toLocaleString('id-ID')}`
      });
    }

  } catch (error) {
    console.log('[Scraper] Error extracting Next.js data:', error.message);
  }

  return prices;
}

/**
 * Extract prices from visible text in the page
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Array} Array of price objects
 */
function extractFromText($) {
  const prices = [];

  try {
    // Look for price patterns in the page
    const bodyText = $('body').text();

    // Pattern: "Rp X.XXX.XXX" or "Rp X,XXX,XXX"
    const priceMatches = bodyText.match(/Rp\s*[\d.,]+/g) || [];
    
    const uniquePrices = new Set();
    priceMatches.forEach(match => {
      const numStr = match.replace(/[Rp\s.,]/g, '');
      const num = parseInt(numStr);
      // Only consider valid gold prices (roughly 500k - 50M per gram range)
      if (num >= 500000 && num <= 50000000) {
        uniquePrices.add(num);
      }
    });

    // Add unique prices found
    let index = 0;
    uniquePrices.forEach(price => {
      if (index < 5) { // Limit to top 5 unique prices
        prices.push({
          source: 'text-scan',
          type: `Harga #${index + 1}`,
          price: price,
          priceFormatted: `Rp ${price.toLocaleString('id-ID')}`
        });
        index++;
      }
    });

  } catch (error) {
    console.log('[Scraper] Error extracting text prices:', error.message);
  }

  return prices;
}

module.exports = { scrapeGoldPrice };
