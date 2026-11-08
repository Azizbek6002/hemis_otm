/**
 * HEMIS OTM REST API Routes
 * 8.2 "Dars o'tish" bo'limi va Telegram Bot uchun to'liq API
 */

const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../data/db');

// Tizim va o'qituvchi profil ma'lumotlari
router.get('/profile', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    teacher: db.teacher,
    systemInfo: db.systemInfo,
    currentDate: db.currentDate,
    academicYear: db.academicYear
  });
});

// To'liq ma'lumotlar bazasi (Frontend SPA uchun barcha bo'limlar)
router.get('/data', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    ...db
  });
});

// 8.1 Dars jadvali
router.get('/schedule', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    weeklySchedule: db.weeklySchedule || []
  });
});

// 8.2 Dars o'tish ro'yxati (1-78 qatorlar)
router.get('/lessons-process', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    lessons: db.lessonsProcess || []
  });
});

// Talabalar ro'yxati
router.get('/students/:group', (req, res) => {
  const db = getDb();
  const group = decodeURIComponent(req.params.group);
  const students = (db.students && db.students[group]) ? db.students[group] : [];
  res.json({
    success: true,
    group,
    students
  });
});

// 8.2 Bo'limidan Davomatni Saqlash:
// O'qituvchi 8.2 jadvalidan darsni tanlab davomatni saqlaganda chaqiriladi
// Darsning isSaved holati true bo'ladi va jadvaldagi sanasi QIZIL dan YASHIL ga o'tadi!
router.post('/attendance/save', (req, res) => {
  const db = getDb();
  const { lessonId, students } = req.body;

  const lesson = db.lessonsProcess.find(l => l.id == lessonId || l.lessonId === lessonId);
  if (!lesson) {
    return res.status(404).json({ success: false, message: "Dars topilmadi!" });
  }

  // Talabalar holatini yangilash
  if (students && Array.isArray(students) && db.students && db.students[lesson.group]) {
    db.students[lesson.group] = students;
  }

  // Dars sanasini YASHIL qilish (Davomat saqlandi)
  lesson.isSaved = true;
  lesson.savedAt = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  saveDb(db);

  res.json({
    success: true,
    message: "Davomat muvaffaqiyatli saqlandi! 8.2 jadvalda dars sanasi YASHIL rangga o'tdi.",
    lesson
  });
});

// Test / Simulyatsiya uchun davomat holatini almashtirish
router.post('/attendance/toggle-status', (req, res) => {
  const db = getDb();
  const { lessonId } = req.body;
  const lesson = db.lessonsProcess.find(l => l.id == lessonId || l.lessonId === lessonId);
  if (!lesson) {
    return res.status(404).json({ success: false, message: "Dars topilmadi" });
  }

  lesson.isSaved = !lesson.isSaved;
  lesson.savedAt = lesson.isSaved ? new Date().toLocaleTimeString('uz-UZ') : null;

  saveDb(db);

  res.json({
    success: true,
    lesson
  });
});

// ==========================================================================
// TELEGRAM BOT UCHUN XUSUSIY API (8.2 BO'LIM ASOSIDA!)
// Har kuni 20:00 da Telegram bot chaqiradigan endpoint:
// 1. 8.2 "Dars o'tish" bo'limidagi BUGUNGI (05.11.2026) darslarning qizil/yashil holatini tekshiradi.
// 2. 8.2 jadvaldan ERTANGI KUN (06.11.2026) darslarini oladi.
// 3. O'qituvchiga yuboriladigan tayyor Telegram xabari va Browser tugmasi URL ni beradi.
// ==========================================================================
router.get('/bot/daily-notification', (req, res) => {
  const db = getDb();
  const todayDate = db.currentDate || "05.11.2026";
  const tomorrowDate = "06.11.2026";
  const teacher = db.teacher;
  const lessons = db.lessonsProcess || [];

  // 1. Bugungi kungi darslar (8.2 bo'lim, 66 va 67-qatorlar)
  const todayLessons = lessons.filter(l => l.date === todayDate);

  const unsavedLessons = todayLessons.filter(l => !l.isSaved);
  const savedLessons = todayLessons.filter(l => l.isSaved);

  // 2. Ertangi kungi darslar (8.2 bo'lim, 68-qator)
  const tomorrowLessons = lessons.filter(l => l.date === tomorrowDate);

  // 3. Telegram Bot uchun chiroyli HTML formatidagi xabar matni
  let message = `🔔 <b>HEMIS KUNLIK AXBOROTNOMASI (20:00)</b>\n`;
  message += `👤 Hurmatli <b>${teacher.shortName}</b> (${teacher.role})!\n\n`;

  message += `📋 <b>BUGUNGI KUN DARSLARI VA DAVOMAT (8.2 Bo'lim, ${todayDate}):</b>\n`;
  if (todayLessons.length === 0) {
    message += `Bugun sizda darslar yo'q.\n`;
  } else {
    todayLessons.forEach((l, idx) => {
      const statusText = l.isSaved 
        ? `🟢 <b>Davomat Saqlangan (Sanasi Yashil)</b>` 
        : `🔴 <b>DAVOMAT SAQLANMAGAN (Sanasi Qizil)!</b>`;

      message += `${idx + 1}. <b>${l.subject}</b> (${l.type})\n`;
      message += `   👥 Guruh: <b>${l.group}</b> | ⏰ ${l.pair}\n`;
      message += `   🏢 Xona: ${l.room}\n`;
      message += `   📌 Holati: ${statusText}\n`;
      if (!l.isSaved) {
        message += `   ⚠️ <i>Iltimos, ushbu dars davomatini HEMIS tizimida saqlang!</i>\n`;
      }
      message += `\n`;
    });
  }

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📅 <b>ERTANGI KUN DARSLARI (${tomorrowDate}, Juma):</b>\n`;
  if (tomorrowLessons.length === 0) {
    message += `Ertaga sizda darslar rejalashtirilmagan.\n`;
  } else {
    tomorrowLessons.forEach((tl, idx) => {
      message += `${idx + 1}. ⏰ <b>${tl.pair}</b> | ${tl.type}\n`;
      message += `   📚 Fan: <b>${tl.subject}</b>\n`;
      message += `   👥 Guruh: <b>${tl.group}</b>\n`;
      message += `   🏢 Auditoriya: <b>${tl.room}</b>\n\n`;
    });
  }

  message += `<i>OTM HEMIS Axborot Tizimi</i>`;

  // Bot pastidagi Browser orqali o'tadigan tugma URL manzili (8.2 dars o'tish bo'limi)
  const browserUrl = process.env.WEB_URL ? `${process.env.WEB_URL}/#lesson_process` : "http://10.58.91.229:4000/#lesson_process";

  res.json({
    success: true,
    teacher: teacher.shortName,
    todayDate: todayDate,
    tomorrowDate: tomorrowDate,
    hasUnsavedAttendance: unsavedLessons.length > 0,
    unsavedCount: unsavedLessons.length,
    savedCount: savedLessons.length,
    todayLessons: todayLessons,
    tomorrowLessons: tomorrowLessons,
    telegramHtmlMessage: message,
    button: {
      text: "🌐 HEMIS Saytiga O'tish (Browser)",
      url: browserUrl
    }
  });
});

// Ro'yxatdan o'tgan o'qituvchilar ro'yxati
router.get('/bot/teachers', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    teachers: db.registeredTeachers || []
  });
});

// HEMIS O'qituvchilar reyestridan tekshirish (HEMIS ID bo'yicha)
router.get('/teachers/verify/:hemisId', (req, res) => {
  const db = getDb();
  const search = req.params.hemisId.trim().toLowerCase();
  const teachers = db.hemisTeachers || [];

  const found = teachers.find(t => 
    String(t.hemisId).toLowerCase() === search || 
    t.fullName.toLowerCase().includes(search)
  );

  if (!found) {
    return res.status(404).json({
      success: false,
      message: "HEMIS tizimida bunday o'qituvchi topilmadi"
    });
  }

  const registered = (db.registeredTeachers || []).find(r => String(r.hemisId) === String(found.hemisId));

  res.json({
    success: true,
    teacher: found,
    isAlreadyConnected: !!registered,
    connectedInfo: registered || null
  });
});

// Admin Web Dashboard uchun to'liq jonli ma'lumotlar
router.get('/admin/overview', (req, res) => {
  const db = getDb();
  const hemisTeachers = db.hemisTeachers || [];
  const registeredTeachers = db.registeredTeachers || [];
  
  const now = new Date();
  const todayFormatted = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  let todayDate = req.query.date || todayFormatted;
  let lessons = (db.lessonsProcess || []).filter(l => l.date === todayDate);

  if (lessons.length === 0) {
    todayDate = db.currentDate || "05.11.2026";
    lessons = (db.lessonsProcess || []).filter(l => l.date === todayDate);
  }

  const savedLessons = lessons.filter(l => l.isSaved);
  const unsavedLessons = lessons.filter(l => !l.isSaved);

  const mappedTeachers = hemisTeachers.map((ht, idx) => {
    const reg = registeredTeachers.find(r => String(r.hemisId) === String(ht.hemisId));
    const teacherLastName = ht.fullName.split(' ')[0].toUpperCase();
    const teacherLessons = lessons.filter(l => l.teacher.toUpperCase().includes(teacherLastName));
    const teacherUnsaved = teacherLessons.filter(l => !l.isSaved);

    return {
      id: idx + 1,
      hemisId: ht.hemisId,
      fullName: ht.fullName,
      shortName: ht.shortName,
      department: ht.department,
      phone: ht.phone,
      title: ht.title,
      email: ht.email,
      isConnected: !!reg,
      chatId: reg ? reg.chatId : null,
      telegramUsername: reg ? reg.telegramUsername : null,
      telegramFirstName: reg ? reg.telegramFirstName : null,
      connectedAt: reg ? reg.connectedAt : null,
      todayLessonsCount: teacherLessons.length,
      todayUnsavedCount: teacherUnsaved.length,
      attendanceStatus: teacherLessons.length === 0 ? "dars_yoq" : (teacherUnsaved.length === 0 ? "saqlangan" : "saqlanmagan")
    };
  });

  res.json({
    success: true,
    superAdmin: {
      name: (db.botConfig && db.botConfig.superAdminName) || "Abdunazarov Azizbek Soxibjonovich",
      id: (db.botConfig && db.botConfig.adminId) || "6601373862"
    },
    metrics: {
      totalTeachers: hemisTeachers.length,
      connectedTeachers: registeredTeachers.length,
      connectionPercent: hemisTeachers.length > 0 ? Math.round((registeredTeachers.length / hemisTeachers.length) * 100) : 0,
      todayTotalLessons: lessons.length,
      todaySavedLessons: savedLessons.length,
      todayUnsavedLessons: unsavedLessons.length,
      todayDate: todayDate
    },
    teachers: mappedTeachers,
    todayLessons: lessons,
    botInfo: {
      username: "fstu_davomat_bot",
      name: "Hemis OTM",
      status: "active",
      cronSchedule: "Har kuni 20:00 da"
    }
  });
});

// Bot orqali barcha o'qituvchilarga kunlik bildirishnomani jo'natish (Broadcast)
router.post('/bot/trigger-daily', async (req, res) => {
  try {
    const { sendDailyNotificationToAllTeachers } = require('../services/botService');
    const result = await sendDailyNotificationToAllTeachers();
    res.json({
      success: true,
      message: "Kunlik bildirishnomalar barcha ulangan o'qituvchilarga jo'natildi",
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Broadcast alias
router.post('/bot/broadcast-reminders', async (req, res) => {
  try {
    const { sendDailyNotificationToAllTeachers } = require('../services/botService');
    const result = await sendDailyNotificationToAllTeachers();
    res.json({
      success: true,
      message: "Bildirishnomalar jo'natildi",
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bitta o'qituvchiga shaxsiy eslatma jo'natish
router.post('/bot/send-single-reminder', async (req, res) => {
  try {
    const { hemisId, chatId } = req.body;
    const db = getDb();
    const teachers = db.registeredTeachers || [];
    const teacher = teachers.find(t => 
      (hemisId && String(t.hemisId) === String(hemisId)) || 
      (chatId && String(t.chatId) === String(chatId))
    );

    if (!teacher || !teacher.chatId) {
      return res.status(404).json({ success: false, message: "O'qituvchi botga ulanmagan yoki topilmadi" });
    }

    const { sendSingleTeacherReminder } = require('../services/botService');
    const result = await sendSingleTeacherReminder(teacher);

    res.json({
      success: result.success,
      message: result.success ? "Eslatma o'qituvchiga yetkazildi!" : "Xatolik: " + result.error,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// O'qituvchini botdan uzish (Disconnect)
router.post('/bot/disconnect-teacher', (req, res) => {
  const db = getDb();
  const { hemisId, chatId } = req.body;
  if (!db.registeredTeachers) db.registeredTeachers = [];

  const initialCount = db.registeredTeachers.length;
  db.registeredTeachers = db.registeredTeachers.filter(t => {
    if (hemisId && String(t.hemisId) === String(hemisId)) return false;
    if (chatId && String(t.chatId) === String(chatId)) return false;
    return true;
  });

  saveDb(db);

  res.json({
    success: true,
    message: "O'qituvchi botdan uzildi",
    removedCount: initialCount - db.registeredTeachers.length
  });
});

// Yangi o'qituvchi qo'shish va unga bildirishnoma yuborish
router.post('/bot/add-teacher', async (req, res) => {
  try {
    const { fullName, chatId, department, phone, hemisId } = req.body;
    if (!fullName || !chatId) {
      return res.status(400).json({ success: false, message: "F.I.SH va Chat ID talab qilinadi!" });
    }

    const db = getDb();
    if (!db.registeredTeachers) db.registeredTeachers = [];

    const existingIndex = db.registeredTeachers.findIndex(t => String(t.chatId) === String(chatId));
    const finalHemisId = hemisId || String(3921612000 + db.registeredTeachers.length + 1);
    const newTeacher = {
      id: existingIndex >= 0 ? db.registeredTeachers[existingIndex].id : (db.registeredTeachers.length + 1),
      hemisId: String(finalHemisId),
      teacherUid: String(finalHemisId),
      fullName: fullName,
      shortName: fullName.split(' ').slice(0, 2).join(' '),
      department: department || "Kafedra",
      chatId: String(chatId),
      phone: phone || "+998 90 000 00 00",
      active: true,
      registeredAt: new Date().toLocaleString('uz-UZ')
    };

    if (existingIndex >= 0) {
      db.registeredTeachers[existingIndex] = newTeacher;
    } else {
      db.registeredTeachers.push(newTeacher);
    }

    saveDb(db);

    const { sendTeacherWelcomeNotification } = require('../services/botService');
    const notifyRes = await sendTeacherWelcomeNotification(newTeacher);

    res.json({
      success: true,
      message: "O'qituvchi qo'shildi",
      teacher: newTeacher,
      notification: notifyRes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================================================
// SUPERADMIN: API INTEGRATSIYASI VA XAVFSIZLIK PAROLI (FAQAT DASTURCHILAR UCHUN)
// ==========================================================================
const DEVELOPER_API_PASSWORD = "6aa181JTI74s8r";

router.post('/admin/verify-api-password', (req, res) => {
  const { password } = req.body;
  const p = (password || '').trim();

  if (p === DEVELOPER_API_PASSWORD) {
    return res.json({
      success: true,
      message: "Parol muvaffaqiyatli tasdiqlandi! API bo'limi ochildi."
    });
  }

  return res.status(401).json({
    success: false,
    message: "Xavfsizlik paroli noto‘g‘ri kiritildi!",
    contact: {
      role: "Texnik ma'sul",
      name: "Turaqulov Ilhomjon",
      phone: "+998 95 755 22 18"
    }
  });
});

router.get('/admin/api-config', (req, res) => {
  const db = getDb();
  const cfg = db.apiConfig || {
    hemisApiUrl: "https://hemis.fstu.uz/rest/v1",
    hemisApiToken: "",
    isLiveConnected: false,
    lastTestedAt: null
  };
  res.json({
    success: true,
    config: cfg
  });
});

router.post('/admin/save-api-config', (req, res) => {
  const { hemisApiUrl, hemisApiToken } = req.body;
  const db = getDb();
  if (!db.apiConfig) db.apiConfig = {};

  db.apiConfig.hemisApiUrl = (hemisApiUrl || '').trim();
  db.apiConfig.hemisApiToken = (hemisApiToken || '').trim();
  db.apiConfig.updatedAt = new Date().toLocaleString('uz-UZ');

  saveDb(db);

  res.json({
    success: true,
    message: "HEMIS API sozlamalari muvaffaqiyatli saqlandi! Tizim yangi API ga ulandi.",
    config: db.apiConfig
  });
});

router.post('/admin/test-api-connection', async (req, res) => {
  const { hemisApiUrl, hemisApiToken } = req.body;
  if (!hemisApiUrl) {
    return res.status(400).json({ success: false, message: "HEMIS API URL kiritilmadi!" });
  }

  try {
    const cleanUrl = hemisApiUrl.replace(/\/+$/, '');
    const headers = { 'Accept': 'application/json' };
    if (hemisApiToken) {
      headers['Authorization'] = `Bearer ${hemisApiToken}`;
    }

    const isLocal = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1') || cleanUrl.includes('10.58.91.229') || cleanUrl.endsWith(':4000/api') || cleanUrl.endsWith(':4000');
    const testUrl = isLocal 
      ? `${cleanUrl.replace(/\/api$/, '')}/api/admin/overview` 
      : `${cleanUrl}/data/employee-list?limit=1`;

    const response = await fetch(testUrl, { headers, signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const db = getDb();
      if (!db.apiConfig) db.apiConfig = {};
      db.apiConfig.isLiveConnected = true;
      db.apiConfig.lastTestedAt = new Date().toLocaleString('uz-UZ');
      saveDb(db);

      return res.json({
        success: true,
        message: "HEMIS API bilan muvaffaqiyatli bog'lanildi! Tizim faol."
      });
    } else {
      return res.status(response.status).json({
        success: false,
        message: `HEMIS server xatosi: HTTP ${response.status} ${response.statusText}`
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `HEMIS API ga ulanishda xatolik: ${err.message}`
    });
  }
});

module.exports = router;
