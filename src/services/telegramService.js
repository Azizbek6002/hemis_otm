const { db } = require('../database/db');

class TelegramService {
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  async testBotToken(token) {
    if (!token) return { success: false, error: "Bot token kiritilmadi" };
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        return { success: true, bot: data.result };
      }
      return { success: false, error: data.description || "Token yaroqsiz" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendMessage(chatId, text, botTokenOverride = null) {
    const botToken = botTokenOverride || this.getSetting('telegram_bot_token');
    const mockMode = this.getSetting('mock_mode') === '1';

    // If bot token exists and valid chat id, attempt real Telegram API call
    if (botToken && chatId && !mockMode) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        });

        const result = await response.json();
        if (result.ok) {
          return { success: true, mode: 'REAL', result };
        } else {
          return { success: false, mode: 'REAL', error: result.description };
        }
      } catch (err) {
        return { success: false, mode: 'REAL', error: err.message };
      }
    }

    // Otherwise Mock Delivery (recorded seamlessly in DB for demonstration/dashboard)
    return {
      success: true,
      mode: 'MOCK',
      info: 'Simulyatsiya rejimida muvaffaqiyatli yuborildi (Bot token kiritilganda haqiqiy telegramga boradi)'
    };
  }

  formatLessonWarning(lesson, teacher) {
    const statusText = lesson.attendance_status === 'PARTIAL'
      ? `⚠️ <b>Qisman belgilangan</b> (${lesson.marked_students}/${lesson.total_students} nafar)`
      : `❌ <b>Umuman belgilanmagan</b> (0/${lesson.total_students} nafar)`;

    return `🔔 <b>HEMIS DAVOMAT OGOHLANTIRISHI</b>

Hurmatli <b>${teacher.full_name}</b>!

Sizning quyidagi darsingiz uchun HEMIS tizimida talabalar davomati to'liq olinmaganligi aniqlandi:

📚 <b>Fan:</b> ${lesson.subject_name}
👥 <b>Guruh:</b> ${lesson.group_name} (Jami: ${lesson.total_students} talaba)
🕒 <b>Vaqt:</b> ${lesson.pair_number}-juftlik (${lesson.pair_time})
🏛 <b>Auditoriya:</b> ${lesson.room || 'Biriktirilgan xona'}
📊 <b>Holat:</b> ${statusText}

⚠️ <i>Eslatma: Universitet ichki tartib-qoidalariga muvofiq, dars davomati to'liq va o'z vaqtida kiritilishi shart. Aks holda OTM ma'muriyati tomonidan intizomiy chora (xayfsan) berilishi mumkin!</i>

👉 <b>HEMIS ga kirish:</b> ${this.getSetting('hemis_api_url') || 'https://student.fstu.uz'}`;
  }

  async notifyTeacherForLesson(lessonId, isManualResend = false) {
    const lesson = db.prepare(`
      SELECT l.*, s.name as subject_name, g.name as group_name
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      JOIN groups g ON l.group_id = g.id
      WHERE l.id = ?
    `).get(lessonId);

    if (!lesson) {
      throw new Error(`Dars topilmadi: ID ${lessonId}`);
    }

    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(lesson.teacher_id);
    if (!teacher) {
      throw new Error(`O'qituvchi topilmadi: ID ${lesson.teacher_id}`);
    }

    const message = this.formatLessonWarning(lesson, teacher);
    const sendResult = await this.sendMessage(teacher.telegram_chat_id, message);

    const deliveryStatus = sendResult.success
      ? (sendResult.mode === 'REAL' ? 'SENT' : 'MOCK_SENT')
      : 'FAILED';

    // Check existing notification
    const existing = db.prepare(`
      SELECT * FROM notifications 
      WHERE lesson_id = ? AND teacher_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(lesson.id, teacher.id);

    let notificationId;
    if (existing) {
      const nextCount = existing.reminder_count + 1;
      db.prepare(`
        UPDATE notifications 
        SET sent_at = datetime('now', 'localtime'),
            message = ?,
            status = ?,
            reminder_count = ?
        WHERE id = ?
      `).run(message, deliveryStatus, nextCount, existing.id);
      notificationId = existing.id;
    } else {
      const insert = db.prepare(`
        INSERT INTO notifications (lesson_id, teacher_id, message, status, resolved, reminder_count)
        VALUES (?, ?, ?, ?, 0, 1)
      `);
      const result = insert.run(lesson.id, teacher.id, message, deliveryStatus);
      notificationId = result.lastInsertRowid;
    }

    // Log action
    db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
      isManualResend ? 'MANUAL_NOTIFY' : 'AUTO_NOTIFY',
      `O'qituvchi ${teacher.full_name} (${teacher.telegram_username || teacher.phone}) ga ogohlantirish yuborildi. Status: ${deliveryStatus}`
    );

    return {
      success: sendResult.success,
      notificationId,
      deliveryStatus,
      teacher: teacher.full_name,
      group: lesson.group_name,
      message,
      sendResult
    };
  }

  async checkAndAutoNotify() {
    // 1. Check all lessons today
    const lessons = db.prepare(`
      SELECT l.*, s.name as subject_name, g.name as group_name, t.full_name as teacher_name
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      JOIN groups g ON l.group_id = g.id
      JOIN teachers t ON l.teacher_id = t.id
      WHERE l.date = date('now', 'localtime')
    `).all();

    const summary = {
      total: lessons.length,
      completed: 0,
      notTaken: 0,
      partial: 0,
      notified: 0,
      resolvedNow: 0,
      stillPending: 0
    };

    for (const l of lessons) {
      // Check existing notification
      const notif = db.prepare(`
        SELECT * FROM notifications 
        WHERE lesson_id = ? AND teacher_id = ? 
        ORDER BY id DESC LIMIT 1
      `).get(l.id, l.teacher_id);

      if (l.attendance_status === 'COMPLETED') {
        summary.completed++;
        // If it was notified before and not yet marked resolved, mark it as resolved!
        if (notif && notif.resolved === 0) {
          db.prepare(`
            UPDATE notifications 
            SET resolved = 1, resolved_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(notif.id);

          summary.resolvedNow++;
          db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
            'TEACHER_RESOLVED',
            `O'qituvchi ${l.teacher_name} ogohlantirishdan so'ng ${l.group_name} guruhida davomatni to'liq belgiladi!`
          );
        }
      } else {
        if (l.attendance_status === 'PARTIAL') summary.partial++;
        if (l.attendance_status === 'NOT_TAKEN') summary.notTaken++;

        if (!notif) {
          // Send first alert
          await this.notifyTeacherForLesson(l.id, false);
          summary.notified++;
        } else if (notif.resolved === 0) {
          summary.stillPending++;
        }
      }
    }

    return summary;
  }
}

module.exports = new TelegramService();
