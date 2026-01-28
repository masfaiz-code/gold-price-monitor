const axios = require('axios');

/**
 * Kirim data ke n8n webhook
 * @param {string} webhookUrl - URL webhook n8n
 * @param {Object} payload - Data yang akan dikirim
 * @returns {Promise<Object>} Response dari webhook
 */
async function sendToWebhook(webhookUrl, payload) {
  if (!webhookUrl) {
    console.warn('[Webhook] N8N_WEBHOOK_URL tidak diset. Skip pengiriman webhook.');
    return { success: false, reason: 'No webhook URL configured' };
  }

  try {
    console.log(`[Webhook] Mengirim ke ${webhookUrl}...`);

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GoldPriceMonitor/1.0'
      },
      timeout: 30000
    });

    console.log(`[Webhook] Berhasil! Status: ${response.status}`);
    
    return {
      success: true,
      status: response.status,
      data: response.data
    };

  } catch (error) {
    console.error('[Webhook] Error:', error.message);
    
    return {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }
}

/**
 * Format payload untuk n8n
 * @param {Object} priceData - Data harga
 * @param {Object} comparison - Hasil perbandingan
 * @returns {Object} Payload terformat
 */
function formatPayload(priceData, comparison) {
  return {
    event: 'GOLD_PRICE_UPDATE',
    timestamp: new Date().toISOString(),
    source: priceData.source,
    url: priceData.url,
    updateTime: priceData.updateTime,
    
    // Info perubahan
    hasChanged: comparison.hasChanged,
    isFirstRun: comparison.isFirstRun,
    changeCount: comparison.changeCount || 0,
    message: comparison.message,
    
    // Detail perubahan
    changes: comparison.changes || [],
    
    // Harga buyback (per gram)
    buybackPrice: priceData.buybackPrice,
    
    // Data harga Antam per satuan gram
    antamPrices: priceData.antam || [],
    
    // Summary untuk notifikasi
    summary: generateSummary(priceData, comparison)
  };
}

/**
 * Generate summary text untuk notifikasi
 * @param {Object} priceData - Data harga
 * @param {Object} comparison - Hasil perbandingan
 * @returns {string} Summary text
 */
function generateSummary(priceData, comparison) {
  const lines = [];
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  if (comparison.isFirstRun) {
    lines.push(`🥇 Gold Price Monitor aktif!`);
    lines.push(`📅 ${now}`);
    lines.push(`📍 Sumber: ${priceData.source}`);
    
    if (priceData.buybackPrice) {
      lines.push(`💰 Buyback: ${priceData.buybackPrice.priceFormatted}/gram`);
    }
    
    if (priceData.antam && priceData.antam.length > 0) {
      lines.push(`\n📊 Harga Antam:`);
      priceData.antam.slice(0, 5).forEach(item => {
        lines.push(`  • ${item.weight}g: ${item.sellPriceFormatted}`);
      });
    }
    
    return lines.join('\n');
  }

  if (!comparison.hasChanged) {
    return `✅ Tidak ada perubahan harga emas (${now})`;
  }

  lines.push(`🔔 Update Harga Emas Antam`);
  lines.push(`📅 ${now}`);
  
  if (priceData.updateTime) {
    lines.push(`🕐 Update: ${priceData.updateTime}`);
  }
  
  lines.push('');

  comparison.changes.forEach(change => {
    if (change.type === 'PRICE_CHANGE' || change.type === 'BUYBACK_CHANGE') {
      const emoji = change.direction === 'UP' ? '📈' : '📉';
      const sign = change.direction === 'UP' ? '+' : '';
      lines.push(
        `${emoji} ${change.item}: ${change.newPriceFormatted} (${sign}${change.differencePercent}%)`
      );
    } else if (change.type === 'NEW') {
      lines.push(`🆕 ${change.item}: ${change.newPriceFormatted}`);
    }
  });

  if (priceData.buybackPrice) {
    lines.push('');
    lines.push(`💰 Buyback: ${priceData.buybackPrice.priceFormatted}/gram`);
  }

  return lines.join('\n');
}

module.exports = { sendToWebhook, formatPayload };
