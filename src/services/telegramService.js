const { db } = require('../database/db');

class TelegramService {
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  // Dars vaqtini tahlil qilish (Dars boshlanganmi, tugaganmi?)
  getLessonTiming(pairTime) {
    if (!pairTime || !pairTime.includes('-')) {
      return { started: true, ended: true, label: 'Vaqti noma’lum' };
    }

    try {
      const parts = pairTime.split('-').map(s => s.trim());
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = parts[0].split(':').map(Number);
      const [endH, endM] = parts[1].split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const started = currentMinutes >= startMinutes;
      const ended = currentMinutes >= endMinutes;

      return {
        started,
        ended,
        startMinutes,
        endMinutes,
        currentMinutes,
        minutesSinceStart: currentMinutes - startMinutes,
        minutesSinceEnd: currentMinutes - endMinutes
      };
    } catch {
      return { started: true, ended: true, label: 'Format xato' };
    }
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

    // Chat ID tekshiruvi (LOGIK XATO 3: Chat ID bo'lmasa xabar yuborilmaydi)
    if (!chatId || String(chatId).trim() === '') {
      return {
        success: false,
        mode: 'NO_CHAT_ID',
        error: "O'qituvchining Telegram Chat ID si kiritilmagan yoki botga ulanmagan"
      };
    }

    // Haqiqiy Bot Token bo'lsa va real rejimda bo'lsa
    if (botToken && !mockMode) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: String(chatId).trim(),
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          }),
          signal: AbortSignal.timeout(8000)
        });

        const result = await response.json();
        if (result.ok) {
          return { success: true, mode: 'REAL', result };
        } else {
          return { success: false, mode: 'REAL', error: result.description || 'Telegram xatosi' };
        }
      } catch (err) {
        return { success: false, mode: 'REAL', error: `Ulanish xatosi: ${err.message}` };
      }
    }

    // Mock Simulyatsiya rejimi
    return {
      success: true,
      mode: 'MOCK',
      info: 'Simulyatsiya rejimida muvaffaqiyatli yuborildi'
    };
  }

  formatLessonWarning(lesson, teacher, reminderNumber = 1) {
    const statusText = lesson.attendance_status === 'PARTIAL'
      ? `⚠️ <b>Qisman belgilangan</b> (${lesson.marked_students}/${lesson.total_students} nafar)`
      : `❌ <b>Umuman belgilanmagan</b> (0/${lesson.total_students} nafar)`;

    const reminderHeader = reminderNumber > 1
      ? `🚨 <b>HEMIS DAVOMAT: ${reminderNumber}-OGOHLANTIRISH!</b>`
      : `🔔 <b>HEMIS DAVOMAT OGOHLANTIRISHI</b>`;

    const hemisWebUrl = (this.getSetting('hemis_api_url') || 'http://localhost:4000')
      .replace(/\/api\/?$/, '')
      .replace(/\/rest\/v1\/?$/, '');

    return `${reminderHeader}

Hurmatli <b>${teacher.full_name}</b>!

Sizning quyidagi darsingiz uchun HEMIS tizimida talabalar davomati to'liq olinmaganligi aniqlandi:

📚 <b>Fan:</b> ${lesson.subject_name}
👥 <b>Guruh:</b> ${lesson.group_name} (Jami: ${lesson.total_students} talaba)
🕒 <b>Vaqt:</b> ${lesson.pair_number}-juftlik (${lesson.pair_time})
🏛 <b>Auditoriya:</b> ${lesson.room || 'Biriktirilgan xona'}
📊 <b>Holat:</b> ${statusText}

⚠️ <i>Eslatma: Universitet ichki tartib-qoidalariga muvofiq, dars davomati to'liq va o'z vaqtida kiritilishi shart. Aks holda OTM ma'muriyati tomonidan intizomiy chora (xayfsan) berilishi mumkin!</i>

👉 <b>HEMIS ga kirish:</b> ${hemisWebUrl}`;
  }

  async notifyTeacherForLesson(lessonId, isManual = false) {
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

    // Check existing notification
    const existing = db.prepare(`
      SELECT * FROM notifications 
      WHERE lesson_id = ? AND teacher_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(lesson.id, teacher.id);

    const reminderNumber = existing ? existing.reminder_count + 1 : 1;
    const message = this.formatLessonWarning(lesson, teacher, reminderNumber);
    const sendResult = await this.sendMessage(teacher.telegram_chat_id, message);

    let deliveryStatus = 'FAILED';
    if (sendResult.success) {
      deliveryStatus = (sendResult.mode === 'REAL' ? 'SENT' : 'MOCK_SENT');
    } else if (sendResult.mode === 'NO_CHAT_ID') {
      deliveryStatus = 'NO_CHAT_ID';
    }

    let notificationId;
    if (existing) {
      db.prepare(`
        UPDATE notifications 
        SET sent_at = datetime('now', 'localtime'),
            message = ?,
            status = ?,
            resolved = 0,
            resolved_at = NULL,
            reminder_count = ?
        WHERE id = ?
      `).run(message, deliveryStatus, reminderNumber, existing.id);
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
      isManual ? 'MANUAL_NOTIFY' : 'AUTO_NOTIFY',
      `O'qituvchi ${teacher.full_name} (${teacher.telegram_chat_id || 'Chat ID yo‘q'}) ga #${reminderNumber}-ogohlantirish. Status: ${deliveryStatus}`
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

  // Dars jadvalini va davomatni tekshirish (LOGIK XATOLAR TO'G'RILANDI)
  async checkAndAutoNotify(isManualTrigger = false) {
    const today = new Date().toISOString().split('T')[0];

    const lessons = db.prepare(`
      SELECT l.*, s.name as subject_name, g.name as group_name, t.full_name as teacher_name, t.telegram_chat_id
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      JOIN groups g ON l.group_id = g.id
      JOIN teachers t ON l.teacher_id = t.id
      WHERE l.date = ?
    `).all(today);

    const summary = {
      total: lessons.length,
      completed: 0,
      notTaken: 0,
      partial: 0,
      notified: 0,
      resolvedNow: 0,
      stillPending: 0,
      skippedFutureLessons: 0
    };

    for (const l of lessons) {
      const notif = db.prepare(`
        SELECT * FROM notifications 
        WHERE lesson_id = ? AND teacher_id = ? 
        ORDER BY id DESC LIMIT 1
      `).get(l.id, l.teacher_id);

      // Agar davomat to'liq olingan bo'lsa
      if (l.attendance_status === 'COMPLETED') {
        summary.completed++;

        // Agar avval ogohlantirilgan bo'lsa va hali yopilmagan bo'lsa -> Yopamiz!
        if (notif && notif.resolved === 0) {
          db.prepare(`
            UPDATE notifications 
            SET resolved = 1, resolved_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(notif.id);

          summary.resolvedNow++;
          db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
            'TEACHER_RESOLVED',
            `O'qituvchi ${l.teacher_name} ogohlantirishdan so'ng ${l.group_name} guruhida davomatni to'liq yakunladi!`
          );
        }
        continue;
      }

      // Davomat chala yoki olinmagan bo'lsa
      if (l.attendance_status === 'PARTIAL') summary.partial++;
      if (l.attendance_status === 'NOT_TAKEN') summary.notTaken++;

      // LOGIK TEKSHIRUV 1: Dars boshlanganmi?
      // Agar avtomatik cron bo'lsa va dars hali boshlanmagan bo'lsa -> ERTALABDAN XABAR YUBORILMAYDI!
      const timing = this.getLessonTiming(l.pair_time);
      if (!isManualTrigger && !timing.started) {
        summary.skippedFutureLessons++;
        continue; // Dars boshlanishi kutilmoqda
      }

      // LOGIK TEKSHIRUV 2: Birinchi ogohlantirish yoki Takroriy ogohlantirish (Cooldown)
      if (!notif) {
        // Hali ogohlantirish yuborilmagan -> 1-ogohlantirish yuboriladi
        await this.notifyTeacherForLesson(l.id, isManualTrigger);
        summary.notified++;
      } else if (notif.resolved === 0) {
        summary.stillPending++;

        // Agar oxirgi ogohlantirishdan keyin kamida 30 daqiqa o'tgan bo'lsa va avtomatik rejim bo'lsa -> Qayta eslatamiz!
        const lastSent = new Date(notif.sent_at).getTime();
        const now = Date.now();
        const diffMinutes = Math.floor((now - lastSent) / (1000 * 60));

        if (!isManualTrigger && diffMinutes >= 30 && notif.reminder_count < 3) {
          await this.notifyTeacherForLesson(l.id, false);
          summary.notified++;
        }
      }
    }

    return summary;
  }

  // LOGIK IMKONIYAT 4: Botga /start bosganda o'qituvchini avtomatik ulash (Deep link)
  linkTeacherChat(hemisId, chatId, username = null) {
    if (!hemisId || !chatId) return { success: false, error: 'Parametrlar yetarli emas' };

    const teacher = db.prepare('SELECT * FROM teachers WHERE hemis_id = ?').get(hemisId);
    if (!teacher) {
      return { success: false, error: `Bunday HEMIS ID ga ega o'qituvchi topilmadi: ${hemisId}` };
    }

    db.prepare(`
      UPDATE teachers 
      SET telegram_chat_id = ?, telegram_username = coalesce(?, telegram_username)
      WHERE id = ?
    `).run(String(chatId), username ? `@${username.replace('@','')}` : null, teacher.id);

    db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
      'TELEGRAM_LINKED',
      `O'qituvchi ${teacher.full_name} (${teacher.hemis_id}) Telegram botga muvaffaqiyatli bog'landi. Chat ID: ${chatId}`
    );

    return { success: true, teacher };
  }
}

module.exports = new TelegramService();
