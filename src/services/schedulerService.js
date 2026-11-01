const cron = require('node-cron');
const telegramService = require('./telegramService');
const { db } = require('../database/db');

class SchedulerService {
  constructor() {
    this.cronTask = null;
    this.isRunning = false;
  }

  start() {
    const autoCheck = db.prepare("SELECT value FROM settings WHERE key = 'auto_check_enabled'").get();
    const isEnabled = autoCheck ? autoCheck.value === '1' : true;

    if (!isEnabled) {
      console.log('Avtomatik monitoring o‘chirilgan.');
      return;
    }

    // Run every 15 minutes by default
    this.cronTask = cron.schedule('*/15 * * * *', async () => {
      console.log('⏰ [Cron] Avtomatik davomat tekshiruvi boshlandi...');
      try {
        const result = await telegramService.checkAndAutoNotify();
        console.log('✅ [Cron] Tekshiruv natijasi:', result);
      } catch (err) {
        console.error('❌ [Cron] Tekshiruvda xatolik:', err);
      }
    });

    this.isRunning = true;
    console.log('🚀 Avtomatik monitoring rejalashtiruvchisi ishga tushdi (har 15 daqiqada).');
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.isRunning = false;
      console.log('🛑 Avtomatik monitoring to‘xtatildi.');
    }
  }

  restart() {
    this.stop();
    this.start();
  }
}

module.exports = new SchedulerService();
