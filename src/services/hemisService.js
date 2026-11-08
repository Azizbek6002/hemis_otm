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

  getHemisApiToken() {
    return this.getSetting('hemis_api_token') || '';
  }

  isMockMode() {
    return this.getSetting('mock_mode') === '1';
  }

  isLocalHemis() {
    const url = this.getHemisApiUrl().toLowerCase();
    return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('10.58.91.');
  }

  /**
   * UNIVERSAL SYNC:
   * 1. Agar localhost/klon bo'lsa -> klon API (/admin/overview) orqali oladi.
   * 2. Agar Real OTM HEMIS API bo'lsa -> Rasmiy REST API (/data/employee-list, /education/schedule) orqali oladi.
   * 3. Maydonlar bir oz farq qilsa ham "Defensive Mapping" orqali xatoliksiz ishlaydi.
   */
  async syncFromHemis() {
    const apiUrl = this.getHemisApiUrl().replace(/\/+$/, '');
    const apiToken = this.getHemisApiToken();

    if (this.isLocalHemis()) {
      return await this._syncFromLocalKlon(apiUrl);
    } else {
      return await this._syncFromRealHemis(apiUrl, apiToken);
    }
  }

  /**
   * 1. Lokal Simulyator / Klon (http://localhost:4000) dan sinxronlash
   */
  async _syncFromLocalKlon(apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/admin/overview`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (!res.ok) {
        throw new Error(`Klon HEMIS server xatosi: HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error("Klon HEMIS javobida success=false");
      }

      // O'qituvchilarni sinxronlash
      if (Array.isArray(data.teachers)) {
        for (const t of data.teachers) {
          const hemisId = String(t.hemisId || `T-${t.id}`);
          const fullName = t.fullName || t.name || 'O‘qituvchi';
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

      // Darslarni sinxronlash
      let syncedLessonsCount = 0;
      const today = new Date().toISOString().split('T')[0];

      if (Array.isArray(data.todayLessons) && data.todayLessons.length > 0) {
        for (const l of data.todayLessons) {
          const teacherLastName = (l.teacher || '').split(' ')[0].toUpperCase();
          const teacher = db.prepare(`
            SELECT id, full_name FROM teachers 
            WHERE UPPER(full_name) LIKE ? OR hemis_id = ? 
            LIMIT 1
          `).get(`%${teacherLastName}%`, String(l.teacherUid || l.hemisId || ''));

          if (!teacher) continue;

          // Guruh
          let group = db.prepare('SELECT id FROM groups WHERE name = ? OR hemis_group_id = ?').get(l.group, l.group);
          if (!group) {
            const insG = db.prepare('INSERT INTO groups (hemis_group_id, name, course, faculty, student_count) VALUES (?, ?, 3, ?, 26)').run(l.group, l.group, 'Axborot texnologiyalari fakulteti');
            group = { id: insG.lastInsertRowid };
          }

          // Fan
          let subject = db.prepare('SELECT id FROM subjects WHERE name = ?').get(l.subject);
          if (!subject) {
            const insS = db.prepare('INSERT INTO subjects (name, code) VALUES (?, ?)').run(l.subject, 'CS-HEMIS');
            subject = { id: insS.lastInsertRowid };
          }

          // Juftlik
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

          const existingLesson = db.prepare(`
            SELECT id FROM lessons 
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
        mode: 'SIMULATED_KLON',
        source: apiUrl,
        superAdmin: data.superAdmin,
        teachersCount: (data.teachers || []).length,
        lessonsCount: syncedLessonsCount
      };
    } catch (err) {
      console.warn(`[HemisService] Klon sync xatosi (${apiUrl}):`, err.message);
      return {
        success: false,
        error: err.message,
        source: apiUrl
      };
    }
  }

  /**
   * 2. Haqiqiy OTM HEMIS REST API tizimidan sinxronlash (Yii2 REST API)
   * Moslashuvchan va xavfsiz (Defensive Mapping)
   */
  async _syncFromRealHemis(apiUrl, apiToken) {
    if (!apiToken) {
      return {
        success: false,
        error: "Haqiqiy HEMIS API uchun Token kiritilmagan. Sozlamalardan tokenni kiriting."
      };
    }

    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json'
    };

    try {
      // 1. O'qituvchilar ro'yxatini olish (/data/employee-list yoki /data/teacher-list)
      let teachersRaw = [];
      try {
        const empRes = await fetch(`${apiUrl}/data/employee-list?limit=300`, { headers, signal: AbortSignal.timeout(8000) });
        if (empRes.ok) {
          const empJson = await empRes.json();
          teachersRaw = this._extractItems(empJson);
        } else if (empRes.status === 404) {
          const tRes = await fetch(`${apiUrl}/data/teacher-list?limit=300`, { headers, signal: AbortSignal.timeout(8000) });
          if (tRes.ok) {
            const tJson = await tRes.json();
            teachersRaw = this._extractItems(tJson);
          }
        } else if (empRes.status === 401) {
          throw new Error("HEMIS API Token muddati tugagan yoki noto'g'ri (401 Unauthorized)");
        }
      } catch (e) {
        console.warn('Real HEMIS teacher fetch error:', e.message);
      }

      // O'qituvchilarni bazaga saqlash
      for (const raw of teachersRaw) {
        const hemisId = String(raw.employee_id_number || raw.code || raw.id || '');
        if (!hemisId) continue;

        const fullName = raw.full_name || raw.name || raw.short_name || 
          `${raw.second_name || ''} ${raw.first_name || ''} ${raw.third_name || ''}`.trim() || 'O‘qituvchi';
        
        const dept = (raw.department && raw.department.name) || raw.department_name || raw.department || 'Kafedra';
        const faculty = (raw.faculty && raw.faculty.name) || raw.faculty_name || 'Fakultet';
        const phone = raw.phone || raw.telephone || '';

        db.prepare(`
          INSERT INTO teachers (hemis_id, full_name, department, faculty, phone, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
          ON CONFLICT(hemis_id) DO UPDATE SET
            full_name = excluded.full_name,
            department = excluded.department,
            faculty = excluded.faculty,
            phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE teachers.phone END,
            is_active = 1
        `).run(hemisId, fullName, dept, faculty, phone);
      }

      // 2. Bugungi dars jadvalini olish (/education/schedule?date=YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      let lessonsRaw = [];
      try {
        const schedRes = await fetch(`${apiUrl}/education/schedule?date=${today}`, { headers, signal: AbortSignal.timeout(8000) });
        if (schedRes.ok) {
          const schedJson = await schedRes.json();
          lessonsRaw = this._extractItems(schedJson);
        }
      } catch (e) {
        console.warn('Real HEMIS schedule fetch error:', e.message);
      }

      let syncedLessonsCount = 0;
      for (const raw of lessonsRaw) {
        // O'qituvchini aniqlash
        const teacherCode = String(raw.employee?.code || raw.employee_id_number || raw.employee_id || raw.teacher_id || '');
        const teacherName = raw.employee?.name || raw.teacher_name || raw.employee_name || '';
        
        let teacher = null;
        if (teacherCode) {
          teacher = db.prepare('SELECT id FROM teachers WHERE hemis_id = ?').get(teacherCode);
        }
        if (!teacher && teacherName) {
          const lName = teacherName.split(' ')[0].toUpperCase();
          teacher = db.prepare('SELECT id FROM teachers WHERE UPPER(full_name) LIKE ? LIMIT 1').get(`%${lName}%`);
        }
        if (!teacher) continue;

        // Guruhni aniqlash
        const groupName = raw.group?.name || raw.group_name || 'Guruh';
        const groupCode = raw.group?.id || groupName;
        let group = db.prepare('SELECT id FROM groups WHERE name = ? OR hemis_group_id = ?').get(groupName, String(groupCode));
        if (!group) {
          const insG = db.prepare('INSERT INTO groups (hemis_group_id, name, course, faculty, student_count) VALUES (?, ?, 3, ?, 25)')
            .run(String(groupCode), groupName, raw.faculty?.name || 'Fakultet');
          group = { id: insG.lastInsertRowid };
        }

        // Fanni aniqlash
        const subjectName = raw.subject?.name || raw.subject_name || 'Fan';
        let subject = db.prepare('SELECT id FROM subjects WHERE name = ?').get(subjectName);
        if (!subject) {
          const insS = db.prepare('INSERT INTO subjects (name, code) VALUES (?, ?)').run(subjectName, raw.subject?.code || 'CS');
          subject = { id: insS.lastInsertRowid };
        }

        // Juftlik raqami va vaqti
        const pairNumber = parseInt(raw.lesson_pair?.code || raw.pair_number || raw.pair || 1, 10) || 1;
        const pairTime = raw.lesson_pair?.name || raw.pair_time || raw.lesson_pair?.time || "08:30 - 09:50";
        const room = raw.auditorium?.name || raw.room_name || raw.room || 'Auditoriya';
        const hemisScheduleId = String(raw.id || `REAL-SCH-${today}-${pairNumber}-${teacher.id}`);

        // Davomat holati
        // Real HEMIS da agar davomat olingan bo'lsa: attendance_status yoki absent_count mavjud bo'ladi
        const isCompleted = raw.attendance_status === 'COMPLETED' || raw.is_saved === true || raw.marked === true;
        const status = isCompleted ? 'COMPLETED' : 'NOT_TAKEN';
        const totalStudents = raw.group?.student_count || 25;
        const markedStudents = isCompleted ? totalStudents : 0;

        const existingLesson = db.prepare(`
          SELECT id FROM lessons WHERE hemis_schedule_id = ? OR (date = ? AND pair_number = ? AND teacher_id = ? AND group_id = ?)
        `).get(hemisScheduleId, today, pairNumber, teacher.id, group.id);

        let lessonId;
        if (existingLesson) {
          lessonId = existingLesson.id;
          db.prepare(`
            UPDATE lessons 
            SET attendance_status = ?, marked_students = ?, pair_time = ?, room = ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(status, markedStudents, pairTime, room, lessonId);
        } else {
          const insL = db.prepare(`
            INSERT INTO lessons (
              hemis_schedule_id, date, pair_number, pair_time,
              teacher_id, group_id, subject_id, room,
              attendance_status, total_students, marked_students
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            hemisScheduleId, today, pairNumber, pairTime,
            teacher.id, group.id, subject.id, room,
            status, totalStudents, markedStudents
          );
          lessonId = insL.lastInsertRowid;
        }

        if (isCompleted) {
          db.prepare(`
            UPDATE notifications 
            SET resolved = 1, resolved_at = datetime('now', 'localtime')
            WHERE lesson_id = ? AND resolved = 0
          `).run(lessonId);
        }

        syncedLessonsCount++;
      }

      return {
        success: true,
        mode: 'REAL_HEMIS',
        source: apiUrl,
        teachersCount: teachersRaw.length,
        lessonsCount: syncedLessonsCount,
        message: `Haqiqiy HEMIS tizimidan ${syncedLessonsCount} ta dars sinxronlashtirildi.`
      };

    } catch (err) {
      console.error('[HemisService] Real HEMIS sync error:', err.message);
      return {
        success: false,
        error: `Haqiqiy HEMIS bilan aloqa xatosi: ${err.message}`,
        source: apiUrl
      };
    }
  }

  // Response ma'lumotlarini massiv ko'rinishida xavfsiz ajratib olish (Yii2 pagination envelope)
  _extractItems(json) {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.data?.items)) return json.data.items;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
    if (Array.isArray(json.result)) return json.result;
    return [];
  }

  // Test connection to HEMIS
  async testConnection(apiUrl, apiToken) {
    if (!apiUrl) {
      return { success: false, error: 'HEMIS API manzili kiritilmadi' };
    }

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const isLocal = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1');

      if (isLocal) {
        const response = await fetch(`${cleanUrl}/admin/overview`, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          return { success: true, message: "Lokal HEMIS (Klon) bilan muvaffaqiyatli bog'lanildi!", data };
        }
      } else {
        const response = await fetch(`${cleanUrl}/data/employee-list?limit=1`, {
          headers: { 'Authorization': `Bearer ${apiToken}`, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(6000)
        });
        if (response.ok) {
          return { success: true, message: "Haqiqiy HEMIS API bilan muvaffaqiyatli bog'lanildi!" };
        } else {
          return { success: false, status: response.status, error: `HEMIS server xatosi: HTTP ${response.status}` };
        }
      }
    } catch (err) {
      return { success: false, error: `HEMIS API ga ulanishda xatolik: ${err.message}` };
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

  // Set lesson attendance manually or from test
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
        `Dars #${lessonId} davomati yakunlandi (${marked}/${lesson.total_students}). Faol ogohlantirishlar yopildi.`
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
