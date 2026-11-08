/**
 * HEMIS OTM Web Platform Server
 * O'zbekiston Respublikasi Oliy Ta'lim Axborot Tizimi (HEMIS) 1:1 Kloni
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRoutes = require('./src/routes/api');
const { initBot } = require('./src/services/botService');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik fayllar (Frontend UI)
app.use(express.static(path.join(__dirname, 'public')));

// API router
app.use('/api', apiRoutes);

// Admin Web Dashboard sahifasi
app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Barcha sahifalar uchun index.html qaytarish
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`🎓 HEMIS OTM O'qituvchi Kabineti (1:1 Haqiqiy Klon)`);
  console.log(`🌐 Local URL:   http://localhost:${PORT}`);
  console.log(`🌐 Network URL: http://10.58.91.229:${PORT}`);
  console.log(`📡 Bot API:     http://localhost:${PORT}/api/bot/daily-notification`);
  console.log(`🤖 Telegram Bot: @fstu_davomat_bot`);
  console.log(`📅 Tizim vaqti: ${new Date().toLocaleString('uz-UZ')}`);
  console.log('================================================================');

  // Telegram botni ishga tushirish
  initBot();
});
