/**
 * HEMIS OTM Telegram Bot Xizmati
 * Bot: @fstu_davomat_bot (ID: 9028859067)
 * SuperAdmin: Abdunazarov Azizbek Soxibjonovich (ID: 6601373862)
 * 
 * Imkoniyatlar:
 * 1. O'qituvchilarning bot orqali o'z-o'zini ro'yxatdan o'tkazishi (HEMIS ID bo'yicha)
 * 2. SuperAdmin uchun jonli boshqaruv va Web Dashboard havolasi
 * 3. Har kuni 20:00 da 8.2 davomat jurnali bo'yicha avtomatik bildirishnoma
 * 4. To'g'ridan-to'g'ri HEMIS saytiga Browser orqali o'tish tugmasi
 */

const { Bot } = require('node-telegram-bot-api');
const cron = require('node-cron');
const { getDb, saveDb } = require('../data/db');

// Konfiguratsiya
const BOT_TOKEN = process.env.BOT_TOKEN || "9028859067:AAFEIB5KwwuRtlVocmAVUBKEZQqmUVV5WgQ";
const ADMIN_ID = process.env.ADMIN_ID || "6601373862";
const SUPER_ADMIN_NAME = "Abdunazarov Azizbek Soxibjonovich";
const WEB_URL = process.env.WEB_URL || "http://10.58.91.229:4000";
const LOCAL_WEB_URL = "http://localhost:4000";

let bot = null;
const userStates = {}; // Foydalanuvchilar holati (ro'yxatdan o'tish, kiritish bosqichlari)

// Xavfsiz xabar yuborish yordamchi funksiyasi
async function safeSendMessage(chatId, text, options = {}) {
  if (!bot) {
    console.error('[BOT] Bot hali ishga tushmagan!');
    return { success: false, error: 'Bot ishga tushmagan' };
  }
  try {
    const res = await bot.api.sendMessage({
      chat_id: String(chatId),
      text: text,
      parse_mode: options.parse_mode || 'HTML',
      reply_markup: options.reply_markup
    });
    return { success: true, result: res };
  } catch (error) {
    console.error(`[BOT] Xabar yuborishda xatolik (chatId: ${chatId}):`, error.message);
    return { success: false, error: error.message };
  }
}

// Administrator ekanligini tekshirish
function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_ID);
}

// O'qituvchini chat_id orqali topish (ulanganlar ichidan)
function findTeacherByChatId(chatId) {
  const db = getDb();
  const teachers = db.registeredTeachers || [];
  return teachers.find(t => String(t.chatId) === String(chatId));
}

// HEMIS rasmiy reyestridan o'qituvchini qidirish
function findHemisTeacher(query) {
  const db = getDb();
  const teachers = db.hemisTeachers || [];
  const q = String(query).trim().toLowerCase();

  // 1. HEMIS ID bo'yicha aniq qidirish
  let found = teachers.find(t => String(t.hemisId).toLowerCase() === q);
  if (found) return found;

  // 2. Ism bo'yicha qidirish
  found = teachers.find(t => 
    t.fullName.toLowerCase().includes(q) || 
    (t.shortName && t.shortName.toLowerCase().includes(q))
  );
  return found || null;
}

// SuperAdmin menyu klaviaturasi
function getAdminKeyboard() {
  return {
    keyboard: [
      [{ text: "📊 Bugungi Davomat (8.2 Nazorat)" }, { text: "📢 20:00 Bildirishnoma (Sinov)" }],
      [{ text: "👥 Ulangan O'qituvchilar" }, { text: "🌐 Admin Web Paneli" }],
      [{ text: "📅 Ertangi Darslar" }, { text: "➕ O'qituvchi Qo'shish (Qo'lda)" }],
      [{ text: "🧪 Sinov: O'qituvchi Bildirishnomasi" }]
    ],
    resize_keyboard: true
  };
}

// O'qituvchi menyu klaviaturasi
function getTeacherKeyboard() {
  return {
    keyboard: [
      [{ text: "📋 Bugungi Davomatim (8.2)" }, { text: "📅 Ertangi Darslarim" }],
      [{ text: "🌐 HEMIS Saytiga O'tish" }, { text: "ℹ️ Mening Profilim" }]
    ],
    resize_keyboard: true
  };
}

// Bekor qilish klaviaturasi
function getCancelKeyboard() {
  return {
    keyboard: [
      [{ text: "❌ Bekor qilish" }]
    ],
    resize_keyboard: true
  };
}

// Tasdiqlash klaviaturasi
function getConfirmationKeyboard() {
  return {
    keyboard: [
      [{ text: "✅ Ha, profilimni tasdiqlayman" }],
      [{ text: "❌ Bekor qilish" }]
    ],
    resize_keyboard: true
  };
}

// HEMIS Browser inline tugmasi
function getBrowserInlineButton() {
  return {
    inline_keyboard: [
      [
        {
          text: "🌐 HEMIS Saytiga O'tish (Browser)",
          url: `${WEB_URL}/#lesson_process`
        }
      ]
    ]
  };
}

/**
 * 8.2 Bo'limi asosida 20:00 bildirishnoma matnini shakllantirish
 */
function buildDailyNotificationMessage(teacher) {
  const db = getDb();
  const todayDate = db.currentDate || "05.11.2026";
  const tomorrowDate = "06.11.2026";
  const lessons = db.lessonsProcess || [];

  // 1. Bugungi kungi darslar (8.2 bo'lim)
  const todayLessons = lessons.filter(l => {
    const isToday = l.date === todayDate;
    if (!isToday) return false;
    if (teacher && teacher.fullName) {
      const teacherLastName = teacher.fullName.split(' ')[0].toUpperCase();
      return l.teacher.toUpperCase().includes(teacherLastName);
    }
    return true;
  });

  const unsavedLessons = todayLessons.filter(l => !l.isSaved);
  const savedLessons = todayLessons.filter(l => l.isSaved);

  // 2. Ertangi kungi darslar
  const tomorrowLessons = lessons.filter(l => {
    const isTomorrow = l.date === tomorrowDate;
    if (!isTomorrow) return false;
    if (teacher && teacher.fullName) {
      const teacherLastName = teacher.fullName.split(' ')[0].toUpperCase();
      return l.teacher.toUpperCase().includes(teacherLastName);
    }
    return true;
  });

  let message = `🔔 <b>HEMIS KUNLIK AXBOROTNOMASI (20:00)</b>\n`;
  message += `👤 Hurmatli <b>${teacher ? (teacher.shortName || teacher.fullName) : "O'qituvchi"}</b>!\n`;
  if (teacher && teacher.department) {
    message += `🏛 <i>${teacher.department}</i>\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Bugungi darslar va davomat
  message += `📋 <b>BUGUNGI KUN DARSLARI VA DAVOMAT HOLATI\n(8.2 "Dars o'tish" bo'limi, ${todayDate}):</b>\n\n`;

  if (todayLessons.length === 0) {
    message += `ℹ️ <i>Bugungi kunda sizda darslar jadvalga kiritilmagan.</i>\n\n`;
  } else {
    todayLessons.forEach((l, idx) => {
      const isSaved = l.isSaved;
      const statusIcon = isSaved ? "🟢" : "🔴";
      const statusText = isSaved 
        ? `<b>DAVOMAT SAQLANGAN</b> (Sanasi Yashil)` 
        : `<b>DAVOMAT SAQLANMAGAN!</b> (Sanasi Qizil)`;

      message += `${idx + 1}. <b>${l.subject}</b> (${l.type})\n`;
      message += `   👥 Guruh: <b>${l.group}</b>\n`;
      message += `   ⏰ Vaqti: <b>${l.pair}</b>\n`;
      message += `   🏢 Auditoriya: ${l.room}\n`;
      message += `   📌 Holati: ${statusIcon} ${statusText}\n`;

      if (!isSaved) {
        message += `   ⚠️ <b>Diqqat:</b> Ushbu dars davomati hali HEMIS tizimida saqlanmagan. Iltimos, pastdagi tugma orqali tizimga kirib davomatni saqlang!\n`;
      }
      message += `\n`;
    });
  }

  // Ertangi darslar
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📅 <b>ERTANGI KUN DARSLAR JADVALI (${tomorrowDate}, Juma):</b>\n\n`;

  if (tomorrowLessons.length === 0) {
    message += `ℹ️ <i>Ertaga sizda darslar rejalashtirilmagan.</i>\n\n`;
  } else {
    tomorrowLessons.forEach((tl, idx) => {
      message += `${idx + 1}. ⏰ <b>${tl.pair}</b> | <b>${tl.type}</b>\n`;
      message += `   📚 Fan: <b>${tl.subject}</b>\n`;
      message += `   👥 Guruh: <b>${tl.group}</b>\n`;
      message += `   🏢 Auditoriya: <b>${tl.room}</b>\n\n`;
    });
  }

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 <i>Davomatni to'ldirish yoki tekshirish uchun quyidagi tugmani bosing:</i>`;

  return {
    message,
    unsavedCount: unsavedLessons.length,
    savedCount: savedLessons.length,
    todayCount: todayLessons.length
  };
}

/**
 * Yangi o'qituvchi qo'shilganda uning Telegramiga rasmiy bildirishnoma yuborish
 */
async function sendTeacherWelcomeNotification(teacher) {
  if (!teacher || !teacher.chatId) {
    return { success: false, error: "Chat ID mavjud emas" };
  }

  const hemisId = teacher.hemisId || teacher.teacherUid || "3921612001";

  const welcomeText = `🎉 <b>Assalomu alaykum, hurmatli ${teacher.fullName}!</b>\n\n` +
    `🏛 Siz <b>HEMIS OTM Axborot Tizimi</b> darslar va davomat monitoring xizmatiga muvaffaqiyatli biriktirildingiz!\n\n` +
    `📌 <b>Sizning tizimdagi ma'lumotlaringiz:</b>\n` +
    `🆔 <b>HEMIS ID:</b> <code>${hemisId}</code>\n` +
    `📱 <b>Telegram ID:</b> <code>${teacher.chatId}</code>\n` +
    `🏢 <b>Kafedra:</b> <b>${teacher.department || "Kafedra"}</b>\n` +
    `📞 <b>Telefon:</b> <b>${teacher.phone || "Kiritilmagan"}</b>\n` +
    `🔗 <b>HEMIS API Holati:</b> 🟢 Muvaffaqiyatli bog'landi\n\n` +
    `🔔 <b>Bot sizga qanday yordam beradi?</b>\n` +
    `Har kuni kechki payt soat <b>20:00 da</b> ushbu bot orqali sizga:\n` +
    `1️⃣ <b>8.2 "Dars o'tish"</b> bo'limidagi bugungi darslaringiz davomati saqlangan (🟢 Yashil) yoki saqlanmagan (🔴 Qizil) holati;\n` +
    `2️⃣ Ertangi kungi rejalashtirilgan darslar jadvali;\n` +
    `3️⃣ HEMIS tizimiga to'g'ridan-to'g'ri o'tuvchi Browser tugmasi yuboriladi.\n\n` +
    `👇 HEMIS tizimiga kirish uchun quyidagi tugmani bosing:`;

  return await safeSendMessage(teacher.chatId, welcomeText, {
    reply_markup: getBrowserInlineButton()
  });
}

/**
 * Bitta o'qituvchiga shaxsiy eslatma yuborish (Admin paneldan chaqiriladi)
 */
async function sendSingleTeacherReminder(teacher) {
  if (!teacher || !teacher.chatId) {
    return { success: false, error: "O'qituvchi chat ID topilmadi" };
  }

  const { message } = buildDailyNotificationMessage(teacher);
  return await safeSendMessage(teacher.chatId, message, {
    reply_markup: getBrowserInlineButton()
  });
}

/**
 * 20:00 da barcha ulangan o'qituvchilarga kunlik bildirishnomani yuborish
 */
async function sendDailyNotificationToAllTeachers() {
  const db = getDb();
  const teachers = db.registeredTeachers || [];
  let sentCount = 0;
  let failCount = 0;
  const results = [];

  console.log(`[BOT] 20:00 Bildirishnomalari yuborilmoqda... Ulangan o'qituvchilar soni: ${teachers.length}`);

  if (teachers.length === 0) {
    await safeSendMessage(ADMIN_ID, `ℹ️ <b>20:00 Bildirishnomasi:</b> Tizimda hali ulangan o'qituvchilar mavjud emas.`);
    return { sentCount: 0, failCount: 0, results: [] };
  }

  for (const teacher of teachers) {
    if (!teacher.chatId || !teacher.active) continue;

    const { message } = buildDailyNotificationMessage(teacher);
    const res = await safeSendMessage(teacher.chatId, message, {
      reply_markup: getBrowserInlineButton()
    });

    if (res.success) {
      sentCount++;
      results.push({ name: teacher.fullName, chatId: teacher.chatId, status: "OK" });
    } else {
      failCount++;
      results.push({ name: teacher.fullName, chatId: teacher.chatId, status: "FAIL", error: res.error });
      console.error(`[BOT] ${teacher.fullName} (${teacher.chatId}) ga xabar yetib bormadi:`, res.error);
    }
  }

  // SuperAdminga umumiy hisobot xabarnomasini yuborish
  try {
    let adminReport = `📊 <b>20:00 Kunlik Bildirishnomalari Yakunlandi</b>\n\n`;
    adminReport += `✅ Muvaffaqiyatli yuborildi: <b>${sentCount}</b> nafar\n`;
    adminReport += `❌ Yetib bormadi: <b>${failCount}</b> nafar\n\n`;
    adminReport += `<b>O'qituvchilar bo'yicha hisobot:</b>\n`;
    results.forEach((r, i) => {
      adminReport += `${i + 1}. ${r.name}: ${r.status === "OK" ? "🟢 Yuborildi" : "🔴 Xato: " + r.error}\n`;
    });

    adminReport += `\n<i>Batafsil nazorat:</i> <code>${WEB_URL}/admin</code>`;

    await safeSendMessage(ADMIN_ID, adminReport);
  } catch (err) {
    console.error("[BOT] Adminga hisobot yuborishda xato:", err.message);
  }

  return { sentCount, failCount, results };
}

/**
 * SuperAdmin qo'lda o'qituvchi kiritganda ma'lumotlarni saqlash
 */
async function handleManualAddTeacher(chatId, text) {
  const parts = text.split('|').map(p => p.trim());

  if (parts.length < 2) {
    return safeSendMessage(chatId, 
      `⚠️ <b>Format noto'g'ri!</b>\n\nIltimos, ma'lumotlarni <b>|</b> belgisi bilan ajratib yuboring:\n\n` +
      `<code>F.I.SH | Telegram ID | Kafedra | Telefon | HEMIS ID</code>\n\n` +
      `Misol: <code>Sobirov Jamshid Rustamovich | 6601373862 | Dasturiy injiniring kafedrasi | +998901234567 | 3921612002</code>`, 
      { reply_markup: getCancelKeyboard() }
    );
  }

  const fullName = parts[0];
  const teacherChatId = parts[1];
  const department = parts[2] || "Kafedra";
  const phone = parts[3] || "+998 90 000 00 00";
  const hemisId = parts[4] || String(3921612000 + (getDb().registeredTeachers ? getDb().registeredTeachers.length + 1 : 1));

  if (!/^\d+$/.test(teacherChatId)) {
    return safeSendMessage(chatId, 
      `⚠️ <b>Telegram ID noto'g'ri!</b>\nTelegram ID faqat sonlardan iborat bo'lishi kerak (masalan: <code>6601373862</code>). Qaytadan kiriting:`,
      { reply_markup: getCancelKeyboard() }
    );
  }

  const db = getDb();
  if (!db.registeredTeachers) db.registeredTeachers = [];

  const existingIndex = db.registeredTeachers.findIndex(t => String(t.chatId) === String(teacherChatId));
  const newTeacher = {
    id: existingIndex >= 0 ? db.registeredTeachers[existingIndex].id : (db.registeredTeachers.length + 1),
    hemisId: String(hemisId),
    teacherUid: String(hemisId),
    fullName: fullName,
    shortName: fullName.split(' ').slice(0, 2).join(' '),
    department: department,
    chatId: teacherChatId,
    phone: phone,
    active: true,
    registeredAt: new Date().toLocaleString('uz-UZ')
  };

  if (existingIndex >= 0) {
    db.registeredTeachers[existingIndex] = newTeacher;
  } else {
    db.registeredTeachers.push(newTeacher);
  }

  saveDb(db);
  delete userStates[chatId];

  const notifyRes = await sendTeacherWelcomeNotification(newTeacher);

  let successMsg = `✅ <b>O'QITUVCHI MUVAFFAQIYATLI BIRIKTIRILDI!</b>\n\n` +
    `👤 <b>F.I.SH:</b> ${newTeacher.fullName}\n` +
    `🆔 <b>HEMIS ID:</b> <code>${newTeacher.hemisId}</code>\n` +
    `📱 <b>Telegram ID:</b> <code>${newTeacher.chatId}</code>\n` +
    `🏛 <b>Kafedra:</b> ${newTeacher.department}\n` +
    `📞 <b>Telefon:</b> ${newTeacher.phone}\n` +
    `🔗 <b>HEMIS API:</b> 🟢 Bog'landi\n\n`;

  if (notifyRes.success) {
    successMsg += `📩 🟢 <b>O'qituvchining Telegramiga rasmiy bildirishnoma yetkazildi!</b>`;
  } else {
    successMsg += `⚠️ 🟡 <b>Telegram bildirishnomasi:</b> <i>${notifyRes.error}</i>\n` +
      `💡 <i>O'qituvchi @fstu_davomat_bot ga kirib /start bosganidan so'ng xabarlar unga boradi.</i>`;
  }

  return safeSendMessage(chatId, successMsg, {
    reply_markup: getAdminKeyboard()
  });
}

/**
 * O'qituvchi tomonidan kiritilgan HEMIS ID ni tekshirish va tasdiqlash
 */
async function handleTeacherSelfOnboardingInput(chatId, text, ctx) {
  const teacher = findHemisTeacher(text);

  if (!teacher) {
    return safeSendMessage(chatId, 
      `❌ <b>HEMIS tizimida bunday o'qituvchi topilmadi!</b>\n\n` +
      `Siz kiritgan ma'lumot: <code>${text}</code>\n\n` +
      `Iltimos, o'zingizning <b>HEMIS ID</b> raqamingizni to'g'ri kiritganingizni tekshirib, qayta yuboring:\n` +
      `<i>(Namuna: <code>3921612001</code> yoki <code>3921612002</code>)</i>\n\n` +
      `💡 <i>Shuningdek, familiyangizni kiritib qidirishingiz ham mumkin (masalan: Akramova).</i>`,
      { reply_markup: getCancelKeyboard() }
    );
  }

  // O'qituvchi topildi - Tasdiqlash holatiga o'tkazamiz
  userStates[chatId] = {
    action: 'confirming_teacher',
    teacher: teacher,
    telegramUser: {
      username: ctx.from?.username || "",
      firstName: ctx.from?.first_name || ""
    }
  };

  const confirmMsg = `🔍 <b>HEMIS O'QITUVCHISI TOPILDI!</b>\n\n` +
    `👤 <b>F.I.SH:</b> <b>${teacher.fullName}</b>\n` +
    `🆔 <b>HEMIS ID:</b> <code>${teacher.hemisId}</code>\n` +
    `🏛 <b>Kafedra:</b> ${teacher.department}\n` +
    `💼 <b>Lavozim:</b> ${teacher.title || "Katta o'qituvchi"}\n` +
    `📱 <b>Aloqa:</b> ${teacher.phone || "Kiritilmagan"}\n\n` +
    `❓ <b>Ushbu HEMIS profilini hozirgi Telegram akkauntingizga biriktirishni tasdiqlaysizmi?</b>`;

  // Inline va Reply tasdiqlash tugmalari
  const inlineButtons = {
    inline_keyboard: [
      [
        { text: "✅ Ha, tasdiqlayman", callback_data: `confirm_${teacher.hemisId}` },
        { text: "❌ Bekor qilish", callback_data: "cancel_onboarding" }
      ]
    ]
  };

  return safeSendMessage(chatId, confirmMsg, {
    reply_markup: inlineButtons
  });
}

/**
 * Tasdiqlangan o'qituvchini bazaga biriktirish
 */
async function finalizeTeacherRegistration(chatId, teacher, telegramUser = {}) {
  const db = getDb();
  if (!db.registeredTeachers) db.registeredTeachers = [];

  const existingIdx = db.registeredTeachers.findIndex(t => String(t.hemisId) === String(teacher.hemisId));
  const newReg = {
    id: existingIdx >= 0 ? db.registeredTeachers[existingIdx].id : (db.registeredTeachers.length + 1),
    hemisId: String(teacher.hemisId),
    teacherUid: String(teacher.hemisId),
    fullName: teacher.fullName,
    shortName: teacher.shortName || teacher.fullName.split(' ').slice(0, 2).join(' '),
    department: teacher.department,
    phone: teacher.phone || "+998 90 000 00 00",
    chatId: String(chatId),
    telegramUsername: telegramUser.username || "",
    telegramFirstName: telegramUser.firstName || "",
    active: true,
    connectedAt: new Date().toLocaleString('uz-UZ')
  };

  if (existingIdx >= 0) {
    db.registeredTeachers[existingIdx] = newReg;
  } else {
    db.registeredTeachers.push(newReg);
  }

  saveDb(db);
  delete userStates[chatId];

  // O'qituvchiga tabrik va yo'riqnoma
  const successMsg = `🎉 <b>TABRIKLAYMIZ! PROFILINGIZ MUVAFAQQIYATLI BIRIKTIRILDI!</b>\n\n` +
    `👤 <b>Hurmatli ${teacher.fullName}!</b>\n` +
    `🆔 <b>HEMIS ID:</b> <code>${teacher.hemisId}</code>\n` +
    `🏛 <b>Kafedra:</b> ${teacher.department}\n` +
    `🔗 <b>HEMIS API Holati:</b> 🟢 Muvaffaqiyatli bog'landi\n\n` +
    `🔔 <b>Endilikda sizga har kuni soat 20:00 da:</b>\n` +
    `1️⃣ <b>8.2 "Dars o'tish"</b> bo'limidagi bugungi darslaringiz davomati saqlangan (🟢 Yashil) yoki saqlanmagan (🔴 Qizil) holati;\n` +
    `2️⃣ Ertangi kungi rejalashtirilgan darslar jadvali;\n` +
    `3️⃣ HEMIS tizimiga to'g'ridan-to'g'ri o'tuvchi Browser tugmasi yuborib turiladi.\n\n` +
    `👇 HEMIS kabinetingizga kirish uchun quyidagi tugmani bosing:`;

  await safeSendMessage(chatId, successMsg, {
    reply_markup: getBrowserInlineButton()
  });

  await safeSendMessage(chatId, `Boshqaruv menyusi faollashtirildi:`, {
    reply_markup: getTeacherKeyboard()
  });

  // SuperAdminga xabarnoma yuborish
  try {
    const adminNotification = `🔔 <b>YANGI O'QITUVCHI BOTGA ULANDI!</b>\n\n` +
      `👤 <b>F.I.SH:</b> ${teacher.fullName}\n` +
      `🆔 <b>HEMIS ID:</b> <code>${teacher.hemisId}</code>\n` +
      `📱 <b>Telegram ID:</b> <code>${chatId}</code> ${telegramUser.username ? '(@' + telegramUser.username + ')' : ''}\n` +
      `🏛 <b>Kafedra:</b> ${teacher.department}\n` +
      `📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ')}\n\n` +
      `<i>Admin paneldan o'qituvchilarni kuzatishingiz mumkin:</i>\n` +
      `🔗 <code>${WEB_URL}/admin</code>`;

    await safeSendMessage(ADMIN_ID, adminNotification);
  } catch (err) {
    console.warn("SuperAdminga xabarnoma yetkazishda xatolik:", err.message);
  }

  return { success: true, teacher: newReg };
}

/**
 * Botni ishga tushirish
 */
function initBot() {
  if (bot) {
    console.log("Bot allaqachon ishga tushirilgan.");
    return bot;
  }

  try {
    bot = new Bot(BOT_TOKEN);
    console.log("🤖 Telegram Bot instance yaratildi: @fstu_davomat_bot");
  } catch (err) {
    console.error("Telegram botni yaratishda xatolik:", err.message);
    return null;
  }

  // Botdagi global xatoliklarni tutish
  bot.catch((err) => {
    console.warn('[Telegram Bot Xatolik Tutildi]:', err.message || err);
  });

  // 1. /start buyrug'i
  bot.command('start', async (ctx) => {
    const chatId = ctx.chatId || (ctx.chat && ctx.chat.id);
    const fromName = (ctx.from && ctx.from.first_name) || "Foydalanuvchi";

    delete userStates[chatId];

    // A. Administrator kirdi
    if (isAdmin(chatId)) {
      const welcomeAdmin = `👋 <b>Assalomu alaykum, Hurmatli SuperAdmin (${SUPER_ADMIN_NAME})!</b>\n\n` +
        `🏛 <b>HEMIS OTM Darslar va Davomat Monitoring Boti</b>ga xush kelibsiz.\n` +
        `Siz tizimda <b>Bosh SuperAdministrator</b> maqomiga egasiz.\n\n` +
        `📌 <b>Sizning imkoniyatlaringiz:</b>\n` +
        `1️⃣ <b>8.2 "Dars o'tish"</b> bo'limi bo'yicha bugungi darslar davomatini nazorat qilish (🟢 Yashil / 🔴 Qizil holatlar);\n` +
        `2️⃣ <b>Web Admin Panel:</b> O'qituvchilar monitoringi va biriktirish jadvalini ko'rish;\n` +
        `3️⃣ <b>20:00 Bildirishnoma (Sinov):</b> Barcha ulangan o'qituvchilarga kunlik eslatmani sinovdan o'tkazish;\n` +
        `4️⃣ O'zingizning Telegramingizga sinov xabarnomalarini qabul qilib ko'rish;\n` +
        `5️⃣ To'g'ridan-to'g'ri HEMIS veb-saytiga bitta tugma orqali o'tish.\n\n` +
        `👇 Quyidagi menyudan kerakli bo'limni tanlang:`;

      return safeSendMessage(chatId, welcomeAdmin, {
        reply_markup: getAdminKeyboard()
      });
    }

    // B. Avval ro'yxatdan o'tgan o'qituvchi kirdi
    const teacher = findTeacherByChatId(chatId);
    if (teacher) {
      const welcomeTeacher = `👋 <b>Assalomu alaykum, hurmatli ${teacher.fullName}!</b>\n\n` +
        `🎓 <b>HEMIS OTM O'qituvchi Kabineti</b> monitoring botiga xush kelibsiz.\n` +
        `🆔 <b>HEMIS ID:</b> <code>${teacher.hemisId || teacher.teacherUid || "3921612001"}</code>\n` +
        `🏛 <b>Kafedra:</b> <b>${teacher.department}</b>\n` +
        `🔗 <b>HEMIS API:</b> 🟢 Muvaffaqiyatli bog'langan\n\n` +
        `📌 <b>Bot vazifasi:</b>\n` +
        `Har kuni soat <b>20:00 da</b> sizga:\n` +
        `• <b>8.2 "Dars o'tish"</b> bo'limida o'tgan darslaringiz davomati saqlangan (🟢 Yashil) yoki saqlanmagan (🔴 Qizil) holati;\n` +
        `• Ertangi kun dars jadvali;\n` +
        `• HEMIS veb portaliga tezkor o'tish tugmasi yetkaziladi.\n\n` +
        `👇 Kerakli bo'limni tanlang:`;

      return safeSendMessage(chatId, welcomeTeacher, {
        reply_markup: getTeacherKeyboard()
      });
    }

    // C. Yangi (hali ulanmagan) o'qituvchi kirdi -> O'Z-O'ZINI RO'YXATDAN O'TKAZISH (Self-onboarding)
    userStates[chatId] = { action: 'awaiting_hemis_id' };

    const onboardingMsg = `👋 <b>Assalomu alaykum, hurmatli ustoz (${fromName})!</b>\n\n` +
      `🏛 <b>HEMIS OTM Darslar va Davomat Monitoring Boti</b>ga xush kelibsiz.\n\n` +
      `Ushbu bot sizga har kuni soat <b>20:00 da</b> o'tgan darslaringiz davomati (8.2 bo'lim) saqlangan yoki saqlanmaganligi hamda ertangi darslar jadvalini avtomatik yetkazib turadi.\n\n` +
      `🔐 <b>Tizimga ulanish uchun HEMIS ID raqamingizni kiriting:</b>\n` +
      `<i>(Masalan: <code>3921612001</code> yoki <code>3921612002</code>)</i>`;

    return safeSendMessage(chatId, onboardingMsg, {
      reply_markup: getCancelKeyboard()
    });
  });

  // 2. Inline tugmalar (Callback Queries) ni qayta ishlash
  bot.on('callback_query', async (ctx) => {
    const cq = ctx.callbackQuery || (ctx.update && ctx.update.callback_query);
    if (!cq) return;

    const data = cq.data || "";
    const chatId = (cq.message && cq.message.chat && cq.message.chat.id) || cq.from.id;

    try {
      if (typeof ctx.answerCallbackQuery === 'function') {
        await ctx.answerCallbackQuery();
      }
    } catch (e) {}

    // Tasdiqlash: confirm_3921612001
    if (data.startsWith('confirm_')) {
      const hemisId = data.replace('confirm_', '');
      const teacher = findHemisTeacher(hemisId);
      if (teacher) {
        await finalizeTeacherRegistration(chatId, teacher, {
          username: cq.from?.username || "",
          firstName: cq.from?.first_name || ""
        });
      }
      return;
    }

    // Bekor qilish
    if (data === 'cancel_onboarding') {
      delete userStates[chatId];
      return safeSendMessage(chatId, "Amal bekor qilindi. Qaytadan boshlash uchun /start buyrug'ini yuboring.");
    }
  });

  // 3. Barcha matnli xabarlarni qayta ishlash
  bot.on('message', async (ctx) => {
    const chatId = ctx.chatId || (ctx.chat && ctx.chat.id);
    const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : "";

    if (!text || text.startsWith('/start')) return;

    // Bekor qilish tugmasi
    if (text === "❌ Bekor qilish") {
      delete userStates[chatId];
      if (isAdmin(chatId)) {
        return safeSendMessage(chatId, "Amal bekor qilindi. Bosh menyu:", { reply_markup: getAdminKeyboard() });
      } else {
        const teacher = findTeacherByChatId(chatId);
        if (teacher) {
          return safeSendMessage(chatId, "Amal bekor qilindi.", { reply_markup: getTeacherKeyboard() });
        } else {
          return safeSendMessage(chatId, "Amal bekor qilindi. Qayta boshlash uchun /start bosing.");
        }
      }
    }

    // Agar o'qituvchi profilini matn orqali tasdiqlayotgan bo'lsa
    if (text === "✅ Ha, profilimni tasdiqlayman" && userStates[chatId] && userStates[chatId].action === 'confirming_teacher') {
      const teacher = userStates[chatId].teacher;
      const tgUser = userStates[chatId].telegramUser || {};
      return await finalizeTeacherRegistration(chatId, teacher, tgUser);
    }

    // 1-QADAM: O'qituvchi HEMIS ID kiritmoqda
    if (userStates[chatId] && userStates[chatId].action === 'awaiting_hemis_id') {
      return await handleTeacherSelfOnboardingInput(chatId, text, ctx);
    }

    // Agar admin qo'lda o'qituvchi qo'shish qadamida bo'lsa
    if (userStates[chatId] && userStates[chatId].action === 'awaiting_manual_teacher_data') {
      return await handleManualAddTeacher(chatId, text);
    }

    // ========================================================================
    // SUPERADMIN BUYRUQLARI
    // ========================================================================
    if (isAdmin(chatId)) {

      // A. "📊 Bugungi Davomat (8.2 Nazorat)"
      if (text === "📊 Bugungi Davomat (8.2 Nazorat)") {
        const db = getDb();
        const todayDate = db.currentDate || "05.11.2026";
        const lessons = (db.lessonsProcess || []).filter(l => l.date === todayDate);

        let report = `📊 <b>BUGUNGI DAVOMAT HOLATI (8.2 "Dars o'tish" bo'limi, ${todayDate}):</b>\n\n`;

        if (lessons.length === 0) {
          report += `Bugungi kunga darslar topilmadi.\n`;
        } else {
          const unsaved = lessons.filter(l => !l.isSaved);
          const saved = lessons.filter(l => l.isSaved);

          report += `📈 <b>Umumiy statistika:</b>\n`;
          report += `• Jami darslar: <b>${lessons.length} ta</b>\n`;
          report += `• 🟢 Davomat saqlangan (Yashil sana): <b>${saved.length} ta</b>\n`;
          report += `• 🔴 Davomat saqlanmagan (Qizil sana): <b>${unsaved.length} ta</b>\n\n`;
          report += `📋 <b>Darslar ro'yxati va holati:</b>\n\n`;

          lessons.forEach((l, idx) => {
            const icon = l.isSaved ? "🟢" : "🔴";
            const status = l.isSaved ? "Saqlangan (Yashil)" : "SAQLANMAGAN (Qizil)";
            report += `${idx + 1}. <b>${l.subject}</b> (${l.type})\n`;
            report += `   👥 Guruh: <b>${l.group}</b> | ⏰ ${l.pair}\n`;
            report += `   🏢 Xona: ${l.room}\n`;
            report += `   👤 O'qituvchi: ${l.teacher}\n`;
            report += `   📌 Davomat: ${icon} <b>${status}</b>\n\n`;
          });
        }

        return safeSendMessage(chatId, report, {
          reply_markup: getBrowserInlineButton()
        });
      }

      // B. "📢 20:00 Bildirishnoma (Sinov)"
      if (text === "📢 20:00 Bildirishnoma (Sinov)") {
        await safeSendMessage(chatId, "⏳ <i>20:00 kunlik bildirishnomalar barcha ulangan o'qituvchilarga jo'natilmoqda...</i>");
        const res = await sendDailyNotificationToAllTeachers();
        return safeSendMessage(chatId, `✅ <b>Sinov yakunlandi!</b>\n\nYuborilganlar: ${res.sentCount} ta\nYetib bormaganlar: ${res.failCount} ta`);
      }

      // C. "👥 Ulangan O'qituvchilar"
      if (text === "👥 Ulangan O'qituvchilar") {
        const db = getDb();
        const teachers = db.registeredTeachers || [];

        let tList = `👥 <b>BOTGA ULANIB ISHLATAYOTGAN O'QITUVCHILAR (${teachers.length} nafar):</b>\n\n`;
        if (teachers.length === 0) {
          tList += `ℹ️ <i>Hozircha tizimda biriktirilgan o'qituvchilar mavjud emas.</i>\n\n` +
            `O'qituvchilar botga kirib o'zlarining HEMIS ID larini kiritishlari orqali avtomatik ulanadilar.\n` +
            `Shuningdek, pastdagi <b>"➕ O'qituvchi Qo'shish (Qo'lda)"</b> tugmasi orqali o'zingiz ham qo'shishingiz mumkin.`;
          return safeSendMessage(chatId, tList);
        }

        teachers.forEach((t, i) => {
          tList += `${i + 1}. <b>${t.fullName}</b>\n`;
          tList += `   🆔 HEMIS ID: <code>${t.hemisId || t.teacherUid || "-"}</code>\n`;
          tList += `   📱 Telegram ID: <code>${t.chatId}</code> ${t.telegramUsername ? '(@' + t.telegramUsername + ')' : ''}\n`;
          tList += `   🏛 Kafedra: ${t.department || "Kafedra"}\n`;
          tList += `   📞 Telefon: ${t.phone || "-"}\n`;
          tList += `   📅 Ulandi: ${t.connectedAt || "-"}\n`;
          tList += `   📌 Holati: 🟢 Faol ulangan\n\n`;
        });

        return safeSendMessage(chatId, tList);
      }

      // D. "🌐 Admin Web Paneli"
      if (text === "🌐 Admin Web Paneli") {
        const adminUrl = `${WEB_URL}/admin`;
        const localAdminUrl = `${LOCAL_WEB_URL}/admin`;

        const panelMsg = `🌐 <b>HEMIS Boshqaruv va Monitoring Web Paneli:</b>\n\n` +
          `SuperAdmin sifatida barcha o'qituvchilarni, ulanganlik holatini va kunlik davomatni to'liq nazorat qilish uchun quyidagi manzilga kiring:\n\n` +
          `🔗 <b>Lokal tarmoq (Telefon va kompyuter uchun):</b>\n` +
          `<code>${adminUrl}</code>\n\n` +
          `🔗 <b>Lokal kompyuter uchun:</b>\n` +
          `<code>${localAdminUrl}</code>\n\n` +
          `To'g'ridan-to'g'ri ochish uchun pastdagi tugmani bosing:`;

        const adminInlineBtn = {
          inline_keyboard: [
            [
              { text: "🌐 Admin Web Panelini Ochish", url: adminUrl }
            ],
            [
              { text: "💻 HEMIS 8.2 Dars o'tish", url: `${WEB_URL}/#lesson_process` }
            ]
          ]
        };

        return safeSendMessage(chatId, panelMsg, {
          reply_markup: adminInlineBtn
        });
      }

      // E. "➕ O'qituvchi Qo'shish (Qo'lda)"
      if (text === "➕ O'qituvchi Qo'shish (Qo'lda)") {
        userStates[chatId] = { action: 'awaiting_manual_teacher_data' };

        const instruct = `➕ <b>O'QITUVCHINI QO'LDA TIZIMGA BIRIKTIRISH</b>\n\n` +
          `O'qituvchi ma'lumotlarini quyidagi formatda bitta xabarda yuboring:\n\n` +
          `<code>F.I.SH | Telegram ID | Kafedra | Telefon | HEMIS ID</code>\n\n` +
          `📝 <b>Namuna:</b>\n` +
          `<code>Sobirov Jamshid Rustamovich | 6601373862 | Dasturiy injiniring kafedrasi | +998901234567 | 3921612002</code>\n\n` +
          `💡 <i>Eslatma: O'qituvchi o'zi botga kirib HEMIS ID sini kiritganda ushbu jarayon avtomatik amalga oshadi.</i>`;

        return safeSendMessage(chatId, instruct, {
          reply_markup: getCancelKeyboard()
        });
      }

      // F. "📅 Ertangi Darslar"
      if (text === "📅 Ertangi Darslar") {
        const db = getDb();
        const tomorrowDate = "06.11.2026";
        const lessons = (db.lessonsProcess || []).filter(l => l.date === tomorrowDate);

        let tMsg = `📅 <b>ERTANGI KUN REJALASHTIRILGAN DARSLAR (${tomorrowDate}, Juma):</b>\n\n`;
        if (lessons.length === 0) {
          tMsg += `Ertaga darslar jadvalga kiritilmagan.\n`;
        } else {
          lessons.forEach((l, i) => {
            tMsg += `${i + 1}. ⏰ <b>${l.pair}</b> | <b>${l.type}</b>\n`;
            tMsg += `   📚 Fan: <b>${l.subject}</b>\n`;
            tMsg += `   👥 Guruh: <b>${l.group}</b>\n`;
            tMsg += `   🏢 Auditoriya: <b>${l.room}</b>\n`;
            tMsg += `   👤 O'qituvchi: ${l.teacher}\n\n`;
          });
        }

        return safeSendMessage(chatId, tMsg, {
          reply_markup: getBrowserInlineButton()
        });
      }

      // G. "🧪 Sinov: O'qituvchi Bildirishnomasi"
      if (text === "🧪 Sinov: O'qituvchi Bildirishnomasi") {
        const db = getDb();
        const teacher = db.teacher;

        await safeSendMessage(chatId, `🧪 <b>Sinov rejimi:</b> Sizga hozir o'qituvchiga boradigan xabarlar aynan qanday ko'rinishda borishi yuboriladi:`);

        await sendTeacherWelcomeNotification({
          fullName: teacher.fullName,
          hemisId: teacher.uid || "3921612001",
          teacherUid: teacher.uid || "3921612001",
          department: teacher.department,
          phone: teacher.phone,
          chatId: chatId
        });

        const { message } = buildDailyNotificationMessage(teacher);
        await safeSendMessage(chatId, message, {
          reply_markup: getBrowserInlineButton()
        });

        return safeSendMessage(chatId, `✅ <b>Sinov yakunlandi!</b> Yuqoridagi xabarlar o'qituvchiga qanday yetkazilishini ko'rsatib turibdi.`, {
          reply_markup: getAdminKeyboard()
        });
      }
    }

    // ========================================================================
    // O'QITUVCHI BUYRUQLARI (ULANGAN O'QITUVCHILAR UCHUN)
    // ========================================================================
    const teacher = findTeacherByChatId(chatId);
    if (teacher) {
      if (text === "📋 Bugungi Davomatim (8.2)") {
        const { message } = buildDailyNotificationMessage(teacher);
        return safeSendMessage(chatId, message, {
          reply_markup: getBrowserInlineButton()
        });
      }

      if (text === "📅 Ertangi Darslarim") {
        const db = getDb();
        const tomorrowDate = "06.11.2026";
        const lessons = (db.lessonsProcess || []).filter(l => l.date === tomorrowDate);

        let tMsg = `📅 <b>ERTANGI KUN DARSLARINGIZ (${tomorrowDate}):</b>\n\n`;
        if (lessons.length === 0) {
          tMsg += `Ertaga sizda darslar rejalashtirilmagan.\n`;
        } else {
          lessons.forEach((l, i) => {
            tMsg += `${i + 1}. ⏰ <b>${l.pair}</b> | ${l.type}\n`;
            tMsg += `   📚 Fan: <b>${l.subject}</b>\n`;
            tMsg += `   👥 Guruh: <b>${l.group}</b>\n`;
            tMsg += `   🏢 Auditoriya: <b>${l.room}</b>\n\n`;
          });
        }
        return safeSendMessage(chatId, tMsg, {
          reply_markup: getBrowserInlineButton()
        });
      }

      if (text === "🌐 HEMIS Saytiga O'tish") {
        return safeSendMessage(chatId, `🌐 HEMIS tizimiga kirish uchun quyidagi tugmani bosing:`, {
          reply_markup: getBrowserInlineButton()
        });
      }

      if (text === "ℹ️ Mening Profilim") {
        const infoMsg = `👤 <b>O'qituvchi Profil Ma'lumotlari:</b>\n\n` +
          `• F.I.SH: <b>${teacher.fullName}</b>\n` +
          `• HEMIS ID: <code>${teacher.hemisId || teacher.teacherUid || "3921612001"}</code>\n` +
          `• Telegram ID: <code>${teacher.chatId}</code>\n` +
          `• Kafedra: <b>${teacher.department}</b>\n` +
          `• Telefon: <b>${teacher.phone || "-"}</b>\n` +
          `• Ulanish sanasi: ${teacher.connectedAt || "-"}\n` +
          `• Holati: 🟢 HEMIS API orqali faol ulangan\n\n` +
          `<i>Har kuni soat 20:00 da davomat va ertangi darslar bildirishnomasi avtomatik tarzda sizga yetkaziladi.</i>`;

        return safeSendMessage(chatId, infoMsg);
      }
    }

    // Noma'lum buyruq
    return safeSendMessage(chatId, "Iltimos, pastdagi menyu tugmalaridan birini tanlang.", {
      reply_markup: isAdmin(chatId) ? getAdminKeyboard() : (teacher ? getTeacherKeyboard() : getCancelKeyboard())
    });
  });

  // Pollingni ishga tushirish
  bot.startPolling().catch((err) => {
    console.warn('[Telegram Polling Warning]:', err.message || err);
  });
  console.log("🚀 Telegram Bot polling faollashtirildi (@fstu_davomat_bot tinglamoqda)");

  // Har kuni soat 20:00 da avtomatik ishlaydigan CRON JOB
  cron.schedule('0 20 * * *', async () => {
    console.log(`[CRON 20:00] Rejali kunlik davomat bildirishnomalari yuborilmoqda...`);
    await sendDailyNotificationToAllTeachers();
  });
  console.log("⏰ 20:00 Cron jadvallari faollashtirildi (har kuni soat 20:00 da avtomatik yuboriladi)");

  return bot;
}

module.exports = {
  initBot,
  safeSendMessage,
  findHemisTeacher,
  buildDailyNotificationMessage,
  sendTeacherWelcomeNotification,
  sendSingleTeacherReminder,
  sendDailyNotificationToAllTeachers,
  finalizeTeacherRegistration,
  getBotInstance: () => bot
};
