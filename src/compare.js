const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'last-price.json');

/**
 * Load harga terakhir dari file
 * @returns {Object|null} Data harga terakhir atau null jika tidak ada
 */
function loadLastPrice() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Compare] Error loading last price:', error.message);
  }
  return null;
}

/**
 * Simpan harga terbaru ke file
 * @param {Object} priceData - Data harga untuk disimpan
 */
function saveLastPrice(priceData) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(priceData, null, 2));
    console.log('[Compare] Harga tersimpan ke', DATA_FILE);
  } catch (error) {
    console.error('[Compare] Error saving price:', error.message);
  }
}

/**
 * Bandingkan harga baru dengan harga lama
 * @param {Object} newPrice - Data harga baru
 * @param {Object} oldPrice - Data harga lama
 * @returns {Object} Hasil perbandingan
 */
function comparePrices(newPrice, oldPrice) {
  if (!oldPrice) {
    return {
      hasChanged: true,
      isFirstRun: true,
      changes: [],
      message: 'First run - no previous data'
    };
  }

  const changes = [];
  const newAntam = newPrice.antam || [];
  const oldAntam = oldPrice.antam || [];

  // Bandingkan setiap item berdasarkan weight
  newAntam.forEach((newItem) => {
    const oldItem = oldAntam.find(o => o.weight === newItem.weight);

    if (!oldItem) {
      changes.push({
        type: 'NEW',
        item: newItem.type,
        weight: newItem.weight,
        newPrice: newItem.sellPrice,
        newPriceFormatted: newItem.sellPriceFormatted
      });
    } else {
      // Cek perubahan harga jual
      if (oldItem.sellPrice !== newItem.sellPrice) {
        const diff = newItem.sellPrice - oldItem.sellPrice;
        const diffPercent = ((diff / oldItem.sellPrice) * 100).toFixed(2);
        
        changes.push({
          type: 'PRICE_CHANGE',
          item: newItem.type,
          weight: newItem.weight,
          oldPrice: oldItem.sellPrice,
          newPrice: newItem.sellPrice,
          oldPriceFormatted: oldItem.sellPriceFormatted,
          newPriceFormatted: newItem.sellPriceFormatted,
          difference: diff,
          differencePercent: parseFloat(diffPercent),
          direction: diff > 0 ? 'UP' : 'DOWN'
        });
      }
    }
  });

  // Cek perubahan buyback price
  if (newPrice.buybackPrice && oldPrice.buybackPrice) {
    if (newPrice.buybackPrice.price !== oldPrice.buybackPrice.price) {
      const diff = newPrice.buybackPrice.price - oldPrice.buybackPrice.price;
      const diffPercent = ((diff / oldPrice.buybackPrice.price) * 100).toFixed(2);
      
      changes.push({
        type: 'BUYBACK_CHANGE',
        item: 'Harga Buyback',
        oldPrice: oldPrice.buybackPrice.price,
        newPrice: newPrice.buybackPrice.price,
        oldPriceFormatted: oldPrice.buybackPrice.priceFormatted,
        newPriceFormatted: newPrice.buybackPrice.priceFormatted,
        difference: diff,
        differencePercent: parseFloat(diffPercent),
        direction: diff > 0 ? 'UP' : 'DOWN'
      });
    }
  }

  const hasChanged = changes.length > 0;

  return {
    hasChanged,
    isFirstRun: false,
    changeCount: changes.length,
    changes,
    message: hasChanged 
      ? `Ditemukan ${changes.length} perubahan harga`
      : 'Tidak ada perubahan harga'
  };
}

module.exports = { loadLastPrice, saveLastPrice, comparePrices };
