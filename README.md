# 🥇 Gold Price Monitor

Monitor harga emas dari [harga-emas.org](https://harga-emas.org) dan kirim notifikasi ke n8n webhook jika ada perubahan harga.

## 🚀 Fitur

- ✅ Scraping otomatis setiap 1 jam via GitHub Actions
- ✅ Deteksi perubahan harga (bandingkan dengan data sebelumnya)
- ✅ Kirim webhook ke n8n **hanya jika ada perubahan**
- ✅ Simpan history harga di repository
- ✅ 100% Gratis (GitHub Actions free tier)

## 📁 Struktur Project

```
gold-price-monitor/
├── .github/
│   └── workflows/
│       └── scrape.yml          # GitHub Actions workflow
├── src/
│   ├── index.js                # Entry point
│   ├── scraper.js              # Logic scraping
│   ├── compare.js              # Bandingkan harga
│   └── webhook.js              # Kirim ke n8n
├── data/
│   └── last-price.json         # Data harga terakhir
├── .env.example                # Template environment
├── .gitignore
├── package.json
└── README.md
```

## 🛠️ Setup

### 1. Fork/Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/gold-price-monitor.git
cd gold-price-monitor
npm install
```

### 2. Setup n8n Webhook

1. Buka n8n
2. Buat workflow baru
3. Tambahkan **Webhook** node sebagai trigger
4. Set method: `POST`
5. Copy webhook URL

### 3. Setup GitHub Secrets

1. Buka repository di GitHub
2. Settings → Secrets and variables → Actions
3. Tambahkan secret baru:
   - Name: `N8N_WEBHOOK_URL`
   - Value: URL webhook dari n8n

### 4. Enable GitHub Actions

1. Buka tab **Actions** di repository
2. Enable workflows jika diminta
3. Workflow akan jalan otomatis setiap jam

## 🧪 Test Lokal

```bash
# Copy .env.example ke .env
cp .env.example .env

# Edit .env dan masukkan webhook URL
nano .env

# Jalankan (dry run - tidak kirim webhook)
npm run test

# Jalankan (kirim webhook)
npm start
```

## 📊 Format Webhook Payload

```json
{
  "event": "GOLD_PRICE_UPDATE",
  "timestamp": "2024-01-15T08:30:00.000Z",
  "source": "harga-emas.org",
  "hasChanged": true,
  "changeCount": 2,
  "changes": [
    {
      "type": "PRICE_CHANGE",
      "priceType": "BUY",
      "item": "1 gram",
      "oldPrice": 1150000,
      "newPrice": 1155000,
      "difference": 5000,
      "differencePercent": 0.43,
      "direction": "UP"
    }
  ],
  "currentPrices": [...],
  "summary": "🔔 Update Harga Emas - 15/1/2024 15:30:00\n📈 1 gram: Beli Rp 1.155.000 (+0.43%)"
}
```

## ⏰ Jadwal Scraping

Default: **Setiap 1 jam** (menit ke-0)

Untuk mengubah jadwal, edit cron di `.github/workflows/scrape.yml`:

```yaml
schedule:
  # Setiap 1 jam
  - cron: '0 * * * *'
  
  # Setiap 30 menit
  # - cron: '*/30 * * * *'
  
  # 3x sehari (08:30, 13:30, 18:00 WIB)
  # - cron: '30 1,6 * * *'
  # - cron: '0 11 * * *'
```

## 📝 Contoh Workflow n8n

```
[Webhook Trigger] → [IF: hasChanged = true] → [Telegram/Discord/Email]
                                            ↓
                                   [Google Sheets: Log harga]
```

## 🔧 Troubleshooting

### Scraper tidak menemukan data
- Website mungkin mengubah struktur HTML
- Cek `rawData` di payload untuk debug
- Update selector di `src/scraper.js`

### Webhook tidak terkirim
- Pastikan `N8N_WEBHOOK_URL` sudah diset di GitHub Secrets
- Cek n8n webhook aktif dan accessible
- Cek logs di GitHub Actions

## 📄 License

MIT
