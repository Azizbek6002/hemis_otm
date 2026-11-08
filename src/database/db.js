const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, '../../data.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode
db.exec('PRAGMA foreign_keys = ON;');

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hemis_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT NOT NULL,
      faculty TEXT NOT NULL,
      phone TEXT,
      telegram_chat_id TEXT,
      telegram_username TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hemis_group_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      faculty TEXT NOT NULL,
      course INTEGER DEFAULT 3,
      student_count INTEGER NOT NULL DEFAULT 25
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      student_id_number TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      gender TEXT DEFAULT 'M',
      FOREIGN KEY(group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hemis_schedule_id TEXT,
      date TEXT NOT NULL,
      pair_number INTEGER NOT NULL,
      pair_time TEXT NOT NULL,
      teacher_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      room TEXT,
      attendance_status TEXT DEFAULT 'NOT_TAKEN', -- 'NOT_TAKEN', 'PARTIAL', 'COMPLETED'
      total_students INTEGER DEFAULT 0,
      marked_students INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(teacher_id) REFERENCES teachers(id),
      FOREIGN KEY(group_id) REFERENCES groups(id),
      FOREIGN KEY(subject_id) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS lesson_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PRESENT', -- 'PRESENT', 'ABSENT', 'EXCUSED'
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(lesson_id) REFERENCES lessons(id),
      FOREIGN KEY(student_id) REFERENCES students(id),
      UNIQUE(lesson_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      sent_at TEXT DEFAULT (datetime('now', 'localtime')),
      message TEXT NOT NULL,
      status TEXT NOT NULL, -- 'SENT', 'FAILED', 'MOCK_SENT', 'NO_CHAT_ID'
      resolved INTEGER DEFAULT 0, -- 0: still pending, 1: resolved after warning
      resolved_at TEXT,
      reminder_count INTEGER DEFAULT 1,
      FOREIGN KEY(lesson_id) REFERENCES lessons(id),
      FOREIGN KEY(teacher_id) REFERENCES teachers(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      action TEXT NOT NULL,
      details TEXT
    );
  `);

  seedBaseData();
  seedStudents();
  ensureTodaySchedule();
}

function seedBaseData() {
  const teacherCount = db.prepare('SELECT COUNT(*) as count FROM teachers').get()?.count || 0;
  if (teacherCount > 0) return;

  // Insert default settings
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('hemis_api_url', 'https://student.fstu.uz/rest/v1');
  insertSetting.run('hemis_api_token', '');
  insertSetting.run('telegram_bot_token', '');
  insertSetting.run('telegram_bot_username', 'hemis_davomat_bot');
  insertSetting.run('auto_check_enabled', '1');
  insertSetting.run('auto_check_interval_mins', '15');
  insertSetting.run('mock_mode', '1');

  // Insert Teachers
  const insertTeacher = db.prepare(`
    INSERT INTO teachers (hemis_id, full_name, department, faculty, phone, telegram_chat_id, telegram_username)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const teachersData = [
    ['T-10291', 'Abdunazarov A. S.', 'Dasturiy injiniring', 'Axborot texnologiyalari fakulteti', '+998901234567', '71928374', '@abdunazarov_as'],
    ['T-10292', 'Karimov Bobur Mansurovich', 'Axborot xavfsizligi', 'Axborot texnologiyalari fakulteti', '+998912345678', '82910384', '@bobur_karimov'],
    ['T-10293', 'Rahimova Nargiza Omonovna', 'Sun’iy intellekt', 'Axborot texnologiyalari fakulteti', '+998933456789', '93817264', '@nargiza_rahimova'],
    ['T-10294', 'Saidov Dilshod Rustamovich', 'Kompyuter tizimlari', 'Axborot texnologiyalari fakulteti', '+998944567890', '10928374', '@dilshod_saidov'],
    ['T-10295', 'Toshmatov Jamshid Ergashovich', 'Dasturiy injiniring', 'Axborot texnologiyalari fakulteti', '+998975678901', '20192837', '@jamshid_toshmatov'],
    ['T-10296', 'Xoliqova Feruza Baxtiyorovna', 'Ijtimoiy gumanitar fanlar', 'Gumanitar fakulteti', '+998996789012', '31029384', '@feruza_xoliqova']
  ];

  for (const t of teachersData) {
    insertTeacher.run(...t);
  }

  // Insert Groups
  const insertGroup = db.prepare(`
    INSERT INTO groups (hemis_group_id, name, faculty, course, student_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  const groupsData = [
    ['G-657', '657-24 DIr', 'Axborot texnologiyalari fakulteti', 3, 26],
    ['G-650', '650-22 DIr', 'Axborot texnologiyalari fakulteti', 4, 24],
    ['G-612', '612-23 AT', 'Axborot texnologiyalari fakulteti', 2, 28],
    ['G-601', '601-21 DIr', 'Axborot texnologiyalari fakulteti', 4, 30],
    ['G-645', '645-24 KI', 'Axborot texnologiyalari fakulteti', 3, 25]
  ];

  for (const g of groupsData) {
    insertGroup.run(...g);
  }

  // Insert Subjects
  const insertSubject = db.prepare(`INSERT INTO subjects (code, name) VALUES (?, ?)`);
  const subjectsData = [
    ['CS-301', 'Operatsion tizimlar'],
    ['CS-302', 'Dasturiy injeneringga kirish'],
    ['CS-303', 'Algoritmlarni loyihalash'],
    ['CS-304', 'FrontEnd da ilovalar yaratish'],
    ['CS-305', 'Kompyuter qurilmalari va tarmoqlariga xizmat ko’rsatish'],
    ['HUM-101', 'Ma’rifat darsi']
  ];

  for (const s of subjectsData) {
    insertSubject.run(...s);
  }
}

// Seed realistic students for each group
function seedStudents() {
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get()?.count || 0;
  if (studentCount > 0) return;

  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students (group_id, student_id_number, full_name, gender)
    VALUES (?, ?, ?, ?)
  `);

  // 26 Students for Group 1 (657-24 DIr)
  const students657 = [
    'Abdullayev Shohruh Baxtiyor o‘g‘li',
    'Akromov Diyorbek Jamshid o‘g‘li',
    'Aliyeva Mohinur Otabek qizi',
    'Bozorov Sanjar Ulug‘bek o‘g‘li',
    'Dadaxonov Asadbek Ilhom o‘g‘li',
    'Ergashev Javohir Farhod o‘g‘li',
    'G‘aniyev Bobur Sherzod o‘g‘li',
    'Hamidova Sevinch Rustam qizi',
    'Ismoilov Doniyor Akmal o‘g‘li',
    'Jalolov Mirjalol Mansur o‘g‘li',
    'Karimov Azizbek Shavkat o‘g‘li',
    'Mamasharipov Temurbek Alisher o‘g‘li',
    'Norqobilov Elbek Muzaffar o‘g‘li',
    'Olimova Diyora Shuhrat qizi',
    'Po‘latov Behruzbek Zafar o‘g‘li',
    'Qodirov Sarvar Sobir o‘g‘li',
    'Rahmonov Umidjon Husan o‘g‘li',
    'Saidova Kamola Nodir qizi',
    'Toshpo‘latov Anvar Ilhom o‘g‘li',
    'Umarov Shahzod Sunnat o‘g‘li',
    'Vohidov Shahriyor Jasur o‘g‘li',
    'Xolmatov Dostonbek Dilshod o‘g‘li',
    'Yoqubova Dilnavoz Baxtiyor qizi',
    'Zokirov Javohirbek Erkin o‘g‘li',
    'Sheraliyev Muhriddin Alisher o‘g‘li',
    'Nasimov Kamoliddin Bahrom o‘g‘li'
  ];

  students657.forEach((name, idx) => {
    const studentNum = `39124110${String(idx + 10).padStart(3, '0')}`;
    insertStudent.run(1, studentNum, name, name.includes('qizi') ? 'F' : 'M');
  });

  // Students for other groups
  const otherGroups = [2, 3, 4, 5];
  for (const gId of otherGroups) {
    for (let i = 1; i <= 24; i++) {
      const num = `3919${gId}${String(i).padStart(4, '0')}`;
      insertStudent.run(gId, num, `Talaba ${i} (Guruh #${gId})`, i % 3 === 0 ? 'F' : 'M');
    }
  }
}

// Har doim bugungi kun uchun dars jadvali bo'lishini ta'minlash
function ensureTodaySchedule() {
  const today = getTodayString();
  const todayCount = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE date = ?').get(today)?.count || 0;
  
  if (todayCount > 0) return;

  const insertLesson = db.prepare(`
    INSERT INTO lessons (hemis_schedule_id, date, pair_number, pair_time, teacher_id, group_id, subject_id, room, attendance_status, total_students, marked_students)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Lesson 1: Abdunazarov A. S. - 657-24 DIr - Operatsion tizimlar - NOT_TAKEN
  insertLesson.run(`SCH-${today}-101`, today, 1, '08:30 - 09:50', 1, 1, 1, '304-xona', 'NOT_TAKEN', 26, 0);

  // Lesson 2: Karimov Bobur - 650-22 DIr - Kompyuter qurilmalari - COMPLETED
  insertLesson.run(`SCH-${today}-102`, today, 1, '08:30 - 09:50', 2, 2, 5, '210-xona', 'COMPLETED', 24, 24);

  // Lesson 3: Rahimova Nargiza - 612-23 AT - Dasturiy injeneringga kirish - PARTIAL (10/28)
  insertLesson.run(`SCH-${today}-103`, today, 2, '10:00 - 11:20', 3, 3, 2, '401-xona', 'PARTIAL', 28, 10);

  // Lesson 4: Saidov Dilshod - 657-24 DIr - Algoritmlarni loyihalash - NOT_TAKEN
  insertLesson.run(`SCH-${today}-104`, today, 2, '10:00 - 11:20', 4, 1, 3, '305-xona', 'NOT_TAKEN', 26, 0);

  // Lesson 5: Toshmatov Jamshid - 601-21 DIr - FrontEnd da ilovalar yaratish - COMPLETED
  insertLesson.run(`SCH-${today}-105`, today, 3, '11:30 - 12:50', 5, 4, 4, '102-lab', 'COMPLETED', 30, 30);

  // Lesson 6: Xoliqova Feruza - 645-24 KI - Ma’rifat darsi - NOT_TAKEN
  insertLesson.run(`SCH-${today}-106`, today, 3, '11:30 - 12:50', 6, 5, 6, 'Faollar zali', 'NOT_TAKEN', 25, 0);

  // Add initial notification record for demonstration
  const firstLesson = db.prepare('SELECT id FROM lessons WHERE date = ? AND teacher_id = 1 LIMIT 1').get(today);
  if (firstLesson) {
    db.prepare(`
      INSERT INTO notifications (lesson_id, teacher_id, message, status, resolved, reminder_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      firstLesson.id,
      1,
      "HEMIS OGOHLANTIRISH: Abdunazarov A. S., 1-juftlik (08:30-09:50) da 657-24 DIr guruhida 'Operatsion tizimlar' fanidan davomat olinmagan (0/26)!",
      'SENT',
      0,
      1
    );
  }

  db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)').run(
    'SCHEDULE_GENERATED',
    `Bugungi sana (${today}) uchun dars jadvali yaratildi.`
  );
}

module.exports = {
  db,
  initDatabase,
  ensureTodaySchedule,
  getTodayString
};
