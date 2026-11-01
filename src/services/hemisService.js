const { db } = require('../database/db');

class HemisService {
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  isMockMode() {
    return this.getSetting('mock_mode') === '1';
  }

  async testConnection(apiUrl, apiToken) {
    if (!apiUrl) {
      return { success: false, error: 'HEMIS API manzili kiritilmadi' };
    }
    if (!apiToken) {
      return { success: false, error: 'HEMIS API token kiritilmadi' };
    }

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/data/teacher-list?limit=1`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: "HEMIS API bilan muvaffaqiyatli bog'lanildi!",
          data
        };
      } else {
        return {
          success: false,
          status: response.status,
          error: `HEMIS server xatosi: HTTP ${response.status} ${response.statusText}`
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `HEMIS API ga ulanishda xatolik: ${err.message}`
      };
    }
  }

  // Sync today's schedule from HEMIS
  async syncSchedule() {
    if (this.isMockMode()) {
      // In mock mode, ensure today's schedule exists in DB
      return {
        success: true,
        mode: 'MOCK',
        message: "Bugungi dars jadvali sinxronizatsiya qilindi (Lokal rejim)",
        syncedCount: db.prepare('SELECT COUNT(*) as count FROM lessons WHERE date = date(\'now\', \'localtime\')').get().count
      };
    }

    const apiUrl = this.getSetting('hemis_api_url');
    const apiToken = this.getSetting('hemis_api_token');

    if (!apiUrl || !apiToken) {
      throw new Error("HEMIS API manzili yoki token sozlanmagan");
    }

    // Call real HEMIS endpoints
    const today = new Date().toISOString().split('T')[0];
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    
    const response = await fetch(`${cleanUrl}/education/schedule?date=${today}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HEMIS API javob bermadi: HTTP ${response.status}`);
    }

    const json = await response.json();
    return {
      success: true,
      mode: 'LIVE',
      raw: json
    };
  }

  // Helper for admin dashboard to test real-world scenarios:
  // e.g. "O'qituvchi davomatni to'ldirdi" -> triggers resolution check!
  setLessonAttendance(lessonId, status, markedCount = null) {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
    if (!lesson) {
      throw new Error(`Dars topilmadi: ${lessonId}`);
    }

    let marked = markedCount;
    if (marked === null) {
      if (status === 'COMPLETED') marked = lesson.total_students;
      else if (status === 'NOT_TAKEN') marked = 0;
      else marked = Math.floor(lesson.total_students / 2);
    }

    db.prepare(`
      UPDATE lessons 
      SET attendance_status = ?, marked_students = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(status, marked, lessonId);

    // If marked as COMPLETED, auto-resolve any pending notifications for this lesson
    if (status === 'COMPLETED') {
      db.prepare(`
        UPDATE notifications 
        SET resolved = 1, resolved_at = datetime('now', 'localtime')
        WHERE lesson_id = ? AND resolved = 0
      `).run(lessonId);

      db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
        'ATTENDANCE_COMPLETED',
        `Dars #${lessonId} davomati to'liq yakunlandi (${marked}/${lesson.total_students}). Barcha faol ogohlantirishlar yopildi.`
      );
    } else {
      db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
        'ATTENDANCE_CHANGED',
        `Dars #${lessonId} davomati o'zgartirildi: ${status} (${marked}/${lesson.total_students}).`
      );
    }

    return {
      success: true,
      lessonId,
      status,
      marked,
      total: lesson.total_students
    };
  }
}

module.exports = new HemisService();
