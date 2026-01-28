require('dotenv').config();

const { scrapeGoldPrice } = require('./scraper');
const { loadLastPrice, saveLastPrice, comparePrices } = require('./compare');
const { sendToWebhook, formatPayload } = require('./webhook');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('='.repeat(60));
  console.log(`[${new Date().toISOString()}] Gold Price Monitor - Starting...`);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - Webhook tidak akan dikirim');
  }

  try {
    // Step 1: Scrape harga terbaru
    console.log('\n📊 Step 1: Scraping harga emas...');
    const newPriceData = await scrapeGoldPrice();
    
    if (!newPriceData.antam || newPriceData.antam.length === 0) {
      console.warn('⚠️  Tidak ada data harga yang ditemukan. Mungkin struktur website berubah.');
      console.log('Raw data sample:', JSON.stringify(newPriceData.rawData?.slice(0, 3), null, 2));
    } else {
      console.log(`✅ Ditemukan ${newPriceData.antam.length} data harga`);
    }

    // Step 2: Load harga terakhir
    console.log('\n📂 Step 2: Loading harga sebelumnya...');
    const lastPriceData = loadLastPrice();
    
    if (lastPriceData) {
      console.log(`✅ Data sebelumnya ditemukan (${lastPriceData.scrapedAt})`);
    } else {
      console.log('ℹ️  Tidak ada data sebelumnya (first run)');
    }

    // Step 3: Bandingkan harga
    console.log('\n🔍 Step 3: Membandingkan harga...');
    const comparison = comparePrices(newPriceData, lastPriceData);
    console.log(`📋 Hasil: ${comparison.message}`);

    if (comparison.changes && comparison.changes.length > 0) {
      console.log('\n📝 Detail perubahan:');
      comparison.changes.forEach((change, i) => {
        if (change.type === 'PRICE_CHANGE') {
          const arrow = change.direction === 'UP' ? '↑' : '↓';
          console.log(`   ${i + 1}. ${change.item} (${change.priceType}): ` +
            `Rp ${change.oldPrice?.toLocaleString('id-ID')} → Rp ${change.newPrice?.toLocaleString('id-ID')} ` +
            `${arrow} ${change.differencePercent}%`);
        } else {
          console.log(`   ${i + 1}. [NEW] ${change.item}`);
        }
      });
    }

    // Step 4: Kirim webhook jika ada perubahan
    console.log('\n📤 Step 4: Mengirim webhook...');
    
    if (comparison.hasChanged) {
      const payload = formatPayload(newPriceData, comparison);
      
      if (DRY_RUN) {
        console.log('🔍 [DRY RUN] Payload yang akan dikirim:');
        console.log(JSON.stringify(payload, null, 2));
      } else {
        const webhookResult = await sendToWebhook(N8N_WEBHOOK_URL, payload);
        
        if (webhookResult.success) {
          console.log('✅ Webhook berhasil dikirim!');
        } else {
          console.error('❌ Webhook gagal:', webhookResult.error || webhookResult.reason);
        }
      }
    } else {
      console.log('⏭️  Skip webhook - tidak ada perubahan harga');
    }

    // Step 5: Simpan harga terbaru
    console.log('\n💾 Step 5: Menyimpan data terbaru...');
    saveLastPrice(newPriceData);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Gold Price Monitor - Selesai!');
    console.log('='.repeat(60));

    // Exit dengan kode sukses
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
main();
