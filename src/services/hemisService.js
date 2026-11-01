const { db } = require('../database/db');

// University teachers mock catalog for quick autofill when live API is not yet loaded
const MOCK_HEMIS_TEACHERS_CATALOG = [
  { hemis_id: 'T-10291', full_name: 'Abdunazarov Abdurashid Saidorifovich', department: 'Dasturiy injiniring', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998901234567' },
  { hemis_id: 'T-10292', full_name: 'Karimov Bobur Mansurovich', department: 'Axborot xavfsizligi', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998912345678' },
  { hemis_id: 'T-10293', full_name: 'Rahimova Nargiza Omonovna', department: 'Sun’iy intellekt', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998933456789' },
  { hemis_id: 'T-10294', full_name: 'Saidov Dilshod Rustamovich', department: 'Kompyuter tizimlari', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998944567890' },
  { hemis_id: 'T-10295', full_name: 'Toshmatov Jamshid Ergashovich', department: 'Dasturiy injiniring', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998975678901' },
  { hemis_id: 'T-10296', full_name: 'Xoliqova Feruza Baxtiyorovna', department: 'Ijtimoiy gumanitar fanlar', faculty: 'Gumanitar fakulteti', phone: '+998996789012' },
  { hemis_id: 'T-10297', full_name: 'Aliyev Jasur Mirzayevich', department: 'Dasturiy injiniring', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998905551122' },
  { hemis_id: 'T-10298', full_name: 'Normatov Sherzod Otabekovich', department: 'Axborot xavfsizligi', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998916662233' },
  { hemis_id: 'T-10299', full_name: 'Yusupova Malika Ikromovna', department: 'Sun’iy intellekt', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998937773344' },
  { hemis_id: 'T-10300', full_name: 'Mirzayev Farhod Qodirovich', department: 'Kompyuter tizimlari', faculty: 'Axborot texnologiyalari fakulteti', phone: '+998948884455' },
  { hemis_id: 'T-10301', full_name: 'Qosimova Shahnoza Anvarovna', department: 'Xorijiy tillar', faculty: 'Gumanitar fakulteti', phone: '+998999995566' },
  { hemis_id: 'T-10302', full_name: 'Beknazarov Otabek Shuxratovich', department: 'Oliy matematika', faculty: 'Tabiiy fanlar fakulteti', phone: '+998901117788' }
];

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

  // Search teachers by name from HEMIS API or Mock Catalog
  async searchTeachers(query) {
    const term = (query || '').trim().toLowerCase();
    if (!term) return [];

    const isLive = !this.isMockMode();
    const apiUrl = this.getSetting('hemis_api_url');
    const apiToken = this.getSetting('hemis_api_token');

    if (isLive && apiUrl && apiToken) {
      try {
        const cleanUrl = apiUrl.replace(/\/+$/, '');
        const response = await fetch(`${cleanUrl}/data/teacher-list?search=${encodeURIComponent(term)}&limit=15`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
          const json = await response.json();
          const items = Array.isArray(json.data?.items) ? json.data.items : (Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []));
          return items.map(item => ({
            hemis_id: item.employee_id_number || item.code || `T-${item.id}`,
            full_name: item.short_name || item.full_name || `${item.second_name || ''} ${item.first_name || ''} ${item.third_name || ''}`.trim(),
            department: item.department?.name || item.department_name || 'Kafedra',
            faculty: item.faculty?.name || item.faculty_name || 'Fakultet',
            phone: item.phone || ''
          }));
        }
      } catch (err) {
        console.warn('HEMIS API search error, falling back to catalog:', err.message);
      }
    }

    // Filter from Mock Catalog + Local Database
    const matched = MOCK_HEMIS_TEACHERS_CATALOG.filter(t => 
      t.full_name.toLowerCase().includes(term) ||
      t.department.toLowerCase().includes(term) ||
      t.hemis_id.toLowerCase().includes(term)
    );

    return matched;
  }

  // Sync today's schedule from HEMIS
  async syncSchedule() {
    if (this.isMockMode()) {
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

  // LOGIK TO'G'RILANDI: Davomat holati va belgilangan talabalar soni hisobi
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
      // Clamp marked between 0 and total_students
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

    // Agar COMPLETED bo'lsa -> ogohlantirishlarni resolved = 1 qilamiz
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
      // LOGIK TO'G'RILANDI: Agar davomat qaytadan NOT_TAKEN yoki PARTIAL qilinsa, ogohlantirish yana kutilmoqda (resolved = 0) bo'lishi kerak!
      db.prepare(`
        UPDATE notifications 
        SET resolved = 0, resolved_at = NULL
        WHERE lesson_id = ?
      `).run(lessonId);

      db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
        'ATTENDANCE_CHANGED',
        `Dars #${lessonId} davomati bekor qilindi yoki o'zgartirildi: ${finalStatus} (${marked}/${lesson.total_students}).`
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
