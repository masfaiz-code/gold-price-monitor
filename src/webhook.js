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
    
    // Info perubahan
    hasChanged: comparison.hasChanged,
    isFirstRun: comparison.isFirstRun,
    changeCount: comparison.changeCount || 0,
    message: comparison.message,
    
    // Detail perubahan
    changes: comparison.changes || [],
    
    // Data harga terbaru
    currentPrices: priceData.antam || [],
    
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
  if (comparison.isFirstRun) {
    return `🥇 Gold Price Monitor aktif! Memantau harga dari ${priceData.source}`;
  }

  if (!comparison.hasChanged) {
    return `✅ Tidak ada perubahan harga emas (${new Date().toLocaleString('id-ID')})`;
  }

  const lines = [`🔔 Update Harga Emas - ${new Date().toLocaleString('id-ID')}`];
  
  comparison.changes.forEach(change => {
    if (change.type === 'PRICE_CHANGE') {
      const emoji = change.direction === 'UP' ? '📈' : '📉';
      const sign = change.direction === 'UP' ? '+' : '';
      lines.push(
        `${emoji} ${change.item}: ${change.priceType === 'BUY' ? 'Beli' : 'Jual'} ` +
        `Rp ${change.newPrice.toLocaleString('id-ID')} ` +
        `(${sign}${change.differencePercent}%)`
      );
    } else if (change.type === 'NEW') {
      lines.push(`🆕 ${change.item}: Beli Rp ${change.newBuyPrice?.toLocaleString('id-ID') || '-'}`);
    }
  });

  return lines.join('\n');
}

module.exports = { sendToWebhook, formatPayload };
