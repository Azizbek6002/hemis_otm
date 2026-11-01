const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const telegramService = require('../services/telegramService');
const hemisService = require('../services/hemisService');
const schedulerService = require('../services/schedulerService');

// 1. STATS OVERVIEW (LOGIK TO'G'RILANDI)
router.get('/stats', (req, res) => {
  try {
    const today = req.query.date || new Date().toISOString().split('T')[0];

    const totalLessons = db.prepare('SELECT COUNT(*) as c FROM lessons WHERE date = ?').get(today)?.c || 0;
    const completedLessons = db.prepare("SELECT COUNT(*) as c FROM lessons WHERE date = ? AND attendance_status = 'COMPLETED'").get(today)?.c || 0;
    const notTakenLessons = db.prepare("SELECT COUNT(*) as c FROM lessons WHERE date = ? AND attendance_status = 'NOT_TAKEN'").get(today)?.c || 0;
    const partialLessons = db.prepare("SELECT COUNT(*) as c FROM lessons WHERE date = ? AND attendance_status = 'PARTIAL'").get(today)?.c || 0;
    const totalTeachers = db.prepare('SELECT COUNT(*) as c FROM teachers WHERE is_active = 1').get()?.c || 0;

    // Notifications stats (Aniq darslar kesimida)
    const totalNotified = db.prepare(`
      SELECT COUNT(DISTINCT l.id) as c 
      FROM notifications n
      JOIN lessons l ON n.lesson_id = l.id
      WHERE l.date = ?
    `).get(today)?.c || 0;

    // Ogohlantirishdan so'ng davomati haqiqatan COMPLETED bo'lgan darslar
    const resolvedAfterWarning = db.prepare(`
      SELECT COUNT(DISTINCT l.id) as c 
      FROM notifications n
      JOIN lessons l ON n.lesson_id = l.id
      WHERE l.date = ? AND n.resolved = 1 AND l.attendance_status = 'COMPLETED'
    `).get(today)?.c || 0;

    // Ogohlantirilgan, lekin hali ham davomati qilinmagan darslar
    const stillPending = db.prepare(`
      SELECT COUNT(DISTINCT l.id) as c 
      FROM notifications n
      JOIN lessons l ON n.lesson_id = l.id
      WHERE l.date = ? AND n.resolved = 0 AND l.attendance_status != 'COMPLETED'
    `).get(today)?.c || 0;

    const completionRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    res.json({
      today,
      totalLessons,
      completedLessons,
      incompleteLessons: notTakenLessons + partialLessons,
      notTakenLessons,
      partialLessons,
      totalTeachers,
      totalNotified,
      resolvedAfterWarning,
      stillPending,
      completionRate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. LESSONS LIST (LOGIK FILTERLAR TO'G'RILANDI)
router.get('/lessons', (req, res) => {
  try {
    const today = req.query.date || new Date().toISOString().split('T')[0];
    const status = req.query.status;
    const department = req.query.department;
    const search = req.query.search;

    let query = `
      SELECT 
        l.id, l.hemis_schedule_id, l.date, l.pair_number, l.pair_time, l.room,
        l.attendance_status, l.total_students, l.marked_students, l.updated_at,
        t.id as teacher_id, t.full_name as teacher_name, t.department, t.phone, t.telegram_chat_id, t.telegram_username,
        g.name as group_name, g.course,
        s.name as subject_name, s.code as subject_code,
        n.id as notification_id, n.sent_at as notified_at, n.status as notification_status,
        n.resolved as is_resolved, n.resolved_at, n.reminder_count
      FROM lessons l
      JOIN teachers t ON l.teacher_id = t.id
      JOIN groups g ON l.group_id = g.id
      JOIN subjects s ON l.subject_id = s.id
      LEFT JOIN notifications n ON n.id = (
        SELECT id FROM notifications 
        WHERE lesson_id = l.id 
        ORDER BY id DESC LIMIT 1
      )
      WHERE l.date = ?
    `;

    const params = [today];

    if (status) {
      if (status === 'INCOMPLETE') {
        query += " AND l.attendance_status != 'COMPLETED'";
      } else if (status === 'RESOLVED') {
        query += " AND n.resolved = 1 AND l.attendance_status = 'COMPLETED'";
      } else if (status === 'PENDING_WARNING') {
        query += " AND n.resolved = 0 AND n.id IS NOT NULL AND l.attendance_status != 'COMPLETED'";
      } else {
        query += " AND l.attendance_status = ?";
        params.push(status);
      }
    }

    if (department && department !== 'ALL') {
      query += " AND t.department = ?";
      params.push(department);
    }

    if (search) {
      query += " AND (t.full_name LIKE ? OR g.name LIKE ? OR s.name LIKE ?)";
      const sTerm = `%${search}%`;
      params.push(sTerm, sTerm, sTerm);
    }

    query += " ORDER BY l.pair_number ASC, l.id ASC";

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. NOTIFICATIONS LOGS
router.get('/notifications', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        n.id, n.sent_at, n.message, n.status, n.resolved, n.resolved_at, n.reminder_count,
        t.full_name as teacher_name, t.telegram_username, t.phone,
        g.name as group_name,
        s.name as subject_name,
        l.pair_number, l.pair_time, l.attendance_status
      FROM notifications n
      JOIN teachers t ON n.teacher_id = t.id
      JOIN lessons l ON n.lesson_id = l.id
      JOIN groups g ON l.group_id = g.id
      JOIN subjects s ON l.subject_id = s.id
      ORDER BY n.id DESC
      LIMIT 100
    `).all();

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. TEACHERS LIST
router.get('/teachers', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM lessons l WHERE l.teacher_id = t.id AND l.date = date('now', 'localtime')) as today_lessons_count,
        (SELECT COUNT(*) FROM notifications n WHERE n.teacher_id = t.id) as total_notifications_count
      FROM teachers t
      WHERE t.is_active = 1
      ORDER BY t.full_name ASC
    `).all();

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4.1 SEARCH TEACHERS FROM HEMIS (For fast autofill)
router.get('/hemis/search-teachers', async (req, res) => {
  try {
    const query = req.query.q || '';
    const results = await hemisService.searchTeachers(query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. ADD / UPDATE TEACHER (LOGIK XATO 5: UNIQUE constraint hal qilindi)
router.post('/teachers', (req, res) => {
  try {
    const { id, hemis_id, full_name, department, faculty, phone, telegram_chat_id, telegram_username } = req.body;

    if (!hemis_id || !full_name) {
      return res.status(400).json({ error: "HEMIS ID va Ism-sharif kiritilishi shart!" });
    }

    if (id) {
      // Update by primary key
      db.prepare(`
        UPDATE teachers 
        SET hemis_id = ?, full_name = ?, department = ?, faculty = ?, phone = ?, telegram_chat_id = ?, telegram_username = ?, is_active = 1
        WHERE id = ?
      `).run(hemis_id.trim(), full_name.trim(), department || '', faculty || '', phone || '', telegram_chat_id || '', telegram_username || '', id);

      db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
        'TEACHER_UPDATE',
        `O'qituvchi ${full_name} ma'lumotlari yangilandi.`
      );
    } else {
      // Insert or Update on HEMIS ID conflict
      const existing = db.prepare('SELECT id FROM teachers WHERE hemis_id = ?').get(hemis_id.trim());
      if (existing) {
        db.prepare(`
          UPDATE teachers 
          SET full_name = ?, department = ?, faculty = ?, phone = ?, 
              telegram_chat_id = coalesce(nullif(?, ''), telegram_chat_id),
              telegram_username = coalesce(nullif(?, ''), telegram_username),
              is_active = 1
          WHERE id = ?
        `).run(full_name.trim(), department || '', faculty || '', phone || '', telegram_chat_id || '', telegram_username || '', existing.id);

        db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
          'TEACHER_UPDATE',
          `Mavjud o'qituvchi ${full_name} (${hemis_id}) ma'lumotlari yangilandi.`
        );
      } else {
        db.prepare(`
          INSERT INTO teachers (hemis_id, full_name, department, faculty, phone, telegram_chat_id, telegram_username, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).run(hemis_id.trim(), full_name.trim(), department || '', faculty || '', phone || '', telegram_chat_id || '', telegram_username || '');

        db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
          'TEACHER_CREATE',
          `Yangi o'qituvchi qo'shildi: ${full_name} (${hemis_id})`
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. DELETE TEACHER (LOGIK XATO 6: Foreign key xatosi hal qilindi - Soft delete)
router.delete('/teachers/:id', (req, res) => {
  try {
    const teacherId = req.params.id;
    const hasLessons = db.prepare('SELECT COUNT(*) as c FROM lessons WHERE teacher_id = ?').get(teacherId)?.c || 0;
    const hasNotifs = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE teacher_id = ?').get(teacherId)?.c || 0;

    if (hasLessons > 0 || hasNotifs > 0) {
      db.prepare('UPDATE teachers SET is_active = 0 WHERE id = ?').run(teacherId);
      db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
        'TEACHER_DEACTIVATED',
        `O'qituvchi #${teacherId} nofaol qilindi (Darslar va xabarnomalar tarixi saqlandi).`
      );
      return res.json({ success: true, message: "O'qituvchi nofaol qilindi (tarix saqlab qolindi)." });
    }

    db.prepare('DELETE FROM teachers WHERE id = ?').run(teacherId);
    res.json({ success: true, message: "O'qituvchi butunlay o'chirildi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. RUN MANUAL CHECK & AUTO NOTIFY NOW (Manual = true)
router.post('/check-now', async (req, res) => {
  try {
    const summary = await telegramService.checkAndAutoNotify(true);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. NOTIFY SINGLE LESSON TEACHER
router.post('/notify-single/:lessonId', async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const result = await telegramService.notifyTeacherForLesson(lessonId, true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. SIMULATE ATTENDANCE (Live tester for Super Admin)
router.post('/simulate-attendance', (req, res) => {
  try {
    const { lessonId, status, markedCount } = req.body;
    if (!lessonId || !status) {
      return res.status(400).json({ error: "lessonId va status talab qilinadi" });
    }

    const result = hemisService.setLessonAttendance(lessonId, status, markedCount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. GET SETTINGS
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    settings.scheduler_running = schedulerService.isRunning;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. SAVE SETTINGS
router.post('/settings', (req, res) => {
  try {
    const allowedKeys = [
      'hemis_api_url',
      'hemis_api_token',
      'telegram_bot_token',
      'telegram_bot_username',
      'auto_check_enabled',
      'auto_check_interval_mins',
      'mock_mode'
    ];

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        stmt.run(key, String(req.body[key]));
      }
    }

    if (req.body.auto_check_enabled !== undefined) {
      if (req.body.auto_check_enabled === '1' || req.body.auto_check_enabled === true) {
        schedulerService.restart();
      } else {
        schedulerService.stop();
      }
    }

    db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
      'SETTINGS_UPDATED',
      'Tizim sozlamalari yangilandi.'
    );

    res.json({ success: true, message: "Sozlamalar muvaffaqiyatli saqlandi!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. TEST TELEGRAM BOT CONNECTION
router.post('/test-telegram', async (req, res) => {
  try {
    const { token, chatId, message } = req.body;
    const testResult = await telegramService.testBotToken(token);
    if (!testResult.success) {
      return res.json({ success: false, step: 'TOKEN_VALIDATION', error: testResult.error });
    }

    if (chatId) {
      const sendResult = await telegramService.sendMessage(
        chatId,
        message || "✅ <b>HEMIS Davomat Tizimi:</b> Test xabarnomasi muvaffaqiyatli yetib bordi!",
        token
      );
      return res.json({ success: sendResult.success, bot: testResult.bot, sendResult });
    }

    res.json({ success: true, bot: testResult.bot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. TEST HEMIS API CONNECTION
router.post('/test-hemis', async (req, res) => {
  try {
    const { apiUrl, apiToken } = req.body;
    const result = await hemisService.testConnection(apiUrl, apiToken);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. TELEGRAM DEEP LINK CONNECT
router.post('/telegram/link-teacher', (req, res) => {
  try {
    const { hemisId, chatId, username } = req.body;
    const result = telegramService.linkTeacherChat(hemisId, chatId, username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. AUDIT LOGS
router.get('/audit-logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50').all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
