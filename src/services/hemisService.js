const { db } = require('../database/db');

class HemisService {
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  getHemisApiUrl() {
    return this.getSetting('hemis_api_url') || 'http://localhost:4000/api';
  }

  isMockMode() {
    return this.getSetting('mock_mode') === '1';
  }

  /**
   * HEMIS Tizimidan (http://localhost:4000/api yoki real HEMIS API)
   * o'qituvchilar va kunlik darslar ro'yxatini to'liq sinxronizatsiya qilish
   */
  async syncFromHemis() {
    const apiUrl = this.getHemisApiUrl().replace(/\/+$/, '');
    
    try {
      const res = await fetch(`${apiUrl}/admin/overview`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (!res.ok) {
        throw new Error(`HEMIS API javob bermadi: HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error("HEMIS API dan muvaffaqiyatli javob olinmadi");
      }

      // 1. O'qituvchilarni sinxronizatsiya qilish
      if (Array.isArray(data.teachers)) {
        for (const t of data.teachers) {
          const hemisId = String(t.hemisId || `T-${t.id}`);
          const fullName = t.fullName || t.name;
          const dept = t.department || 'Kafedra';
          const phone = t.phone || '';
          const chatId = t.chatId ? String(t.chatId) : '';
          const username = t.telegramUsername ? String(t.telegramUsername) : '';

          db.prepare(`
            INSERT INTO teachers (hemis_id, full_name, department, faculty, phone, telegram_chat_id, telegram_username, is_active)
            VALUES (?, ?, ?, 'Axborot texnologiyalari fakulteti', ?, ?, ?, 1)
            ON CONFLICT(hemis_id) DO UPDATE SET
              full_name = excluded.full_name,
              department = excluded.department,
              phone = excluded.phone,
              telegram_chat_id = CASE WHEN excluded.telegram_chat_id != '' THEN excluded.telegram_chat_id ELSE teachers.telegram_chat_id END,
              telegram_username = CASE WHEN excluded.telegram_username != '' THEN excluded.telegram_username ELSE teachers.telegram_username END,
              is_active = 1
          `).run(hemisId, fullName, dept, phone, chatId, username);
        }
      }

      // 2. Bugungi kungi darslar va davomat holatlarini sinxronizatsiya qilish
      const today = new Date().toISOString().split('T')[0];
      let syncedLessonsCount = 0;

      if (Array.isArray(data.todayLessons) && data.todayLessons.length > 0) {
        for (const l of data.todayLessons) {
          // O'qituvchini topish
          const teacherLastName = (l.teacher || '').split(' ')[0].toUpperCase();
          const teacher = db.prepare(`
            SELECT id, full_name FROM teachers 
            WHERE UPPER(full_name) LIKE ? OR hemis_id = ? 
            LIMIT 1
          `).get(`%${teacherLastName}%`, String(l.teacherUid || l.hemisId || ''));

          if (!teacher) continue;

          // Guruhni topish yoki yaratish
          let group = db.prepare('SELECT id FROM groups WHERE name = ? OR hemis_group_id = ?').get(l.group, l.group);
          if (!group) {
            const insG = db.prepare('INSERT INTO groups (hemis_group_id, name, course, faculty, student_count) VALUES (?, ?, 3, ?, 26)').run(l.group, l.group, 'Axborot texnologiyalari fakulteti');
            group = { id: insG.lastInsertRowid };
          }

          // Fanni topish yoki yaratish
          let subject = db.prepare('SELECT id FROM subjects WHERE name = ?').get(l.subject);
          if (!subject) {
            const insS = db.prepare('INSERT INTO subjects (name, code) VALUES (?, ?)').run(l.subject, 'CS-HEMIS');
            subject = { id: insS.lastInsertRowid };
          }

          // Juftlik raqami va vaqtini tahlil qilish (masalan "1. 08:00-09:20")
          let pairNumber = 1;
          let pairTime = "08:00 - 09:20";
          if (l.pair && l.pair.includes('.')) {
            const parts = l.pair.split('.');
            pairNumber = parseInt(parts[0].trim(), 10) || 1;
            pairTime = (parts[1] || '').trim().replace('-', ' - ');
          } else if (l.pair) {
            pairTime = l.pair.replace('-', ' - ');
          }

          const hemisScheduleId = `HEMIS-OTM-${l.id || l.lessonId}`;
          const isSaved = !!l.isSaved;
          const status = isSaved ? 'COMPLETED' : 'NOT_TAKEN';
          const totalStudents = 26;
          const markedStudents = isSaved ? 26 : 0;

          // Mavjud darsni tekshirish
          const existingLesson = db.prepare(`
            SELECT id, attendance_status FROM lessons 
            WHERE hemis_schedule_id = ? OR (date = ? AND pair_number = ? AND teacher_id = ? AND group_id = ?)
          `).get(hemisScheduleId, today, pairNumber, teacher.id, group.id);

          let lessonId;
          if (existingLesson) {
            lessonId = existingLesson.id;
            db.prepare(`
              UPDATE lessons 
              SET attendance_status = ?, marked_students = ?, pair_time = ?, room = ?, updated_at = datetime('now', 'localtime')
              WHERE id = ?
            `).run(status, markedStudents, pairTime, l.room || 'Xona', lessonId);
          } else {
            const insL = db.prepare(`
              INSERT INTO lessons (
                hemis_schedule_id, date, pair_number, pair_time,
                teacher_id, group_id, subject_id, room,
                attendance_status, total_students, marked_students
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              hemisScheduleId, today, pairNumber, pairTime,
              teacher.id, group.id, subject.id, l.room || 'Xona',
              status, totalStudents, markedStudents
            );
            lessonId = insL.lastInsertRowid;
          }

          // Agar HEMIS da davomat saqlangan bo'lsa -> barcha faol ogohlantirishlarni resolved = 1 qilamiz
          if (isSaved) {
            db.prepare(`
              UPDATE notifications 
              SET resolved = 1, resolved_at = datetime('now', 'localtime')
              WHERE lesson_id = ? AND resolved = 0
            `).run(lessonId);
          }

          syncedLessonsCount++;
        }
      }

      return {
        success: true,
        source: apiUrl,
        superAdmin: data.superAdmin,
        teachersCount: (data.teachers || []).length,
        lessonsCount: syncedLessonsCount,
        message: `HEMIS tizimi (${apiUrl}) dan ${syncedLessonsCount} ta dars va ${data.teachers ? data.teachers.length : 0} ta o'qituvchi muvaffaqiyatli sinxronizatsiya qilindi.`
      };
    } catch (err) {
      console.warn(`[HemisService] Sync xatosi (${apiUrl}):`, err.message);
      return {
        success: false,
        source: apiUrl,
        error: err.message
      };
    }
  }

  // Davomat holatini HEMIS OTM tizimida ham almashtirish (agar HEMIS klon ulangan bo'lsa)
  async toggleHemisAttendance(lessonId) {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
    if (!lesson) return;

    if (lesson.hemis_schedule_id && lesson.hemis_schedule_id.startsWith('HEMIS-OTM-')) {
      const otmId = lesson.hemis_schedule_id.replace('HEMIS-OTM-', '');
      try {
        const apiUrl = this.getHemisApiUrl().replace(/\/+$/, '');
        await fetch(`${apiUrl}/attendance/toggle-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: otmId }),
          signal: AbortSignal.timeout(3000)
        });
      } catch (e) {
        console.warn('HEMIS OTM da davomatni toggle qilishda ogohlantirish:', e.message);
      }
    }
  }

  // Test connection to HEMIS
  async testConnection(apiUrl, apiToken) {
    if (!apiUrl) {
      return { success: false, error: 'HEMIS API manzili kiritilmadi' };
    }

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/admin/overview`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
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

  // O'qituvchilarni qidirish
  async searchTeachers(query) {
    const term = (query || '').trim().toLowerCase();
    if (!term) return [];

    const matched = db.prepare(`
      SELECT hemis_id, full_name, department, faculty, phone, telegram_username, telegram_chat_id
      FROM teachers
      WHERE is_active = 1 AND (
        LOWER(full_name) LIKE ? OR
        LOWER(department) LIKE ? OR
        LOWER(hemis_id) LIKE ?
      )
      LIMIT 15
    `).all(`%${term}%`, `%${term}%`, `%${term}%`);

    return matched;
  }

  // Manual or simulation attendance update
  setLessonAttendance(lessonId, requestedStatus, markedCount = null) {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
    if (!lesson) {
      throw new Error(`Dars topilmadi: ${lessonId}`);
    }

    let finalStatus = requestedStatus;
    let marked = markedCount;

    if (marked === null) {
      if (requestedStatus === 'COMPLETED') marked = lesson.total_students;
      else if (requestedStatus === 'NOT_TAKEN') marked = 0;
      else marked = Math.floor(lesson.total_students / 2);
    } else {
      marked = Math.max(0, Math.min(Number(marked), lesson.total_students));
      if (marked >= lesson.total_students) {
        finalStatus = 'COMPLETED';
      } else if (marked === 0) {
        finalStatus = 'NOT_TAKEN';
      } else {
        finalStatus = 'PARTIAL';
      }
    }

    db.prepare(`
      UPDATE lessons 
      SET attendance_status = ?, marked_students = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(finalStatus, marked, lessonId);

    if (finalStatus === 'COMPLETED') {
      db.prepare(`
        UPDATE notifications 
        SET resolved = 1, resolved_at = datetime('now', 'localtime')
        WHERE lesson_id = ? AND resolved = 0
      `).run(lessonId);

      db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
        'ATTENDANCE_COMPLETED',
        `Dars #${lessonId} davomati to'liq yakunlandi (${marked}/${lesson.total_students}). Faol ogohlantirishlar yopildi.`
      );
    } else {
      db.prepare(`
        UPDATE notifications 
        SET resolved = 0, resolved_at = NULL
        WHERE lesson_id = ?
      `).run(lessonId);

      db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
        'ATTENDANCE_CHANGED',
        `Dars #${lessonId} davomati o'zgartirildi: ${finalStatus} (${marked}/${lesson.total_students}).`
      );
    }

    // HEMIS OTM ga ham sinxronizatsiya yuborish
    this.toggleHemisAttendance(lessonId).catch(() => {});

    return {
      success: true,
      lessonId,
      status: finalStatus,
      marked,
      total: lesson.total_students
    };
  }
}

module.exports = new HemisService();
