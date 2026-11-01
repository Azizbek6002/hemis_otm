const express = require('express');
const path = require('node:path');
const cors = require('cors');
const { initDatabase } = require('./src/database/db');
const apiRoutes = require('./src/routes/api');
const schedulerService = require('./src/services/schedulerService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database & Seeds
initDatabase();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (HEMIS Admin Dashboard UI)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🎓 HEMIS Davomat Monitoring & Ogohlantirish Tizimi`);
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
  console.log(`📅 Bugungi sana: ${new Date().toLocaleDateString('uz-UZ')}`);
  console.log('========================================================');

  // Start background cron scheduler
  schedulerService.start();
});
