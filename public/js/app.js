// HEMIS Super Admin Attendance Monitoring Client Application

const state = {
  activeTab: 'monitoring',
  stats: {},
  lessons: [],
  teachers: [],
  notifications: [],
  settings: {},
  filters: {
    status: '',
    department: 'ALL',
    search: '',
    date: new Date().toISOString().split('T')[0]
  },
  autoRefreshInterval: null
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupNavigation();
  setupEventListeners();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  await loadAllData();

  // Auto refresh every 20 seconds
  state.autoRefreshInterval = setInterval(() => {
    if (document.getElementById('autoRefreshToggle')?.checked) {
      loadAllData(false);
    }
  }, 20000);
}

function updateLiveClock() {
  const clockEl = document.getElementById('liveClockText');
  if (clockEl) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    clockEl.textContent = `Sana: ${dateStr} ${timeStr}`;
  }
}

function setupNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item[data-tab]');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      document.querySelector('.hemis-sidebar').classList.toggle('open');
    });
  }
}

function switchTab(tabName) {
  state.activeTab = tabName;

  // Update sidebar active class
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update tab visibility
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Update breadcrumb
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
  if (breadcrumbCurrent) {
    const titles = {
      monitoring: 'Davomat monitoringi va Ogohlantirishlar',
      teachers: "O'qituvchilar va Telegram bog'lanishlari",
      alerts: 'Telegram Xabarnomalar jurnali',
      settings: 'HEMIS API va Bot sozlamalari',
      simulation: 'Interaktiv Simulyator (Jonli sinov)'
    };
    breadcrumbCurrent.textContent = titles[tabName] || tabName;
  }
}

function setupEventListeners() {
  // Check now button
  document.getElementById('btnCheckNow')?.addEventListener('click', runCheckNow);

  // Status and Department filters
  document.getElementById('statusFilter')?.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    loadLessons();
  });

  document.getElementById('deptFilter')?.addEventListener('change', (e) => {
    state.filters.department = e.target.value;
    loadLessons();
  });

  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    loadLessons();
  });

  // Settings form submission
  document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);

  // Test Telegram button
  document.getElementById('btnTestTelegram')?.addEventListener('click', testTelegramBot);

  // Test HEMIS API button
  document.getElementById('btnTestHemis')?.addEventListener('click', testHemisApi);

  // Add Teacher Modal
  document.getElementById('btnAddTeacherModal')?.addEventListener('click', () => openTeacherModal());
  document.getElementById('teacherForm')?.addEventListener('submit', saveTeacher);
}

// -------------------------------------------------------------
// DATA LOADING
// -------------------------------------------------------------

async function loadAllData(showLoader = true) {
  await Promise.all([
    loadStats(),
    loadLessons(),
    loadTeachers(),
    loadNotifications(),
    loadSettings()
  ]);
}

async function loadStats() {
  try {
    const res = await fetch(`/api/stats?date=${state.filters.date}`);
    const data = await res.json();
    state.stats = data;

    // Update DOM counters
    document.getElementById('statTotalLessons').textContent = data.totalLessons || 0;
    document.getElementById('statCompleted').textContent = data.completedLessons || 0;
    document.getElementById('statIncomplete').textContent = data.incompleteLessons || 0;
    document.getElementById('statNotified').textContent = data.totalNotified || 0;
    document.getElementById('statResolved').textContent = data.resolvedAfterWarning || 0;
    document.getElementById('statStillPending').textContent = data.stillPending || 0;

    // Header notification badge
    const headerBadge = document.getElementById('headerAlertBadge');
    if (headerBadge) {
      headerBadge.textContent = data.stillPending || 0;
      headerBadge.style.display = data.stillPending > 0 ? 'inline-block' : 'none';
    }

    // Sidebar warning badge
    const menuBadge = document.getElementById('menuWarningBadge');
    if (menuBadge) {
      menuBadge.textContent = data.incompleteLessons || 0;
    }
  } catch (err) {
    console.error('Stats load error:', err);
  }
}

async function loadLessons() {
  const tbody = document.getElementById('lessonsTableBody');
  if (!tbody) return;

  try {
    const params = new URLSearchParams({
      date: state.filters.date,
      status: state.filters.status,
      department: state.filters.department,
      search: state.filters.search
    });

    const res = await fetch(`/api/lessons?${params.toString()}`);
    const lessons = await res.json();
    state.lessons = lessons;

    document.getElementById('lessonsCountLabel').textContent = `1-${lessons.length} / jami ${lessons.length} ta dars`;

    if (lessons.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 24px; color: #64748b;">
            Hech qanday dars topilmadi
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lessons.map((l, index) => {
      let statusBadge = '';
      if (l.attendance_status === 'COMPLETED') {
        statusBadge = `<span class="badge badge-success"><i class="fa fa-check-circle"></i> To'liq (${l.marked_students}/${l.total_students})</span>`;
      } else if (l.attendance_status === 'PARTIAL') {
        statusBadge = `<span class="badge badge-warning"><i class="fa fa-exclamation-triangle"></i> Qisman (${l.marked_students}/${l.total_students})</span>`;
      } else {
        statusBadge = `<span class="badge badge-danger"><i class="fa fa-times-circle"></i> Olinmagan (0/${l.total_students})</span>`;
      }

      let notifBadge = '';
      if (l.notification_status) {
        const time = l.notified_at ? l.notified_at.split(' ')[1]?.substring(0, 5) : '';
        const countTxt = l.reminder_count > 1 ? ` (${l.reminder_count}-bor)` : '';
        notifBadge = `<span class="badge badge-info" title="Xabar yuborilgan"><i class="fa fa-paper-plane"></i> Yuborildi ${time}${countTxt}</span>`;
      } else {
        notifBadge = `<span class="badge badge-secondary"><i class="fa fa-clock"></i> Kutilmoqda</span>`;
      }

      let resultBadge = '';
      if (l.attendance_status === 'COMPLETED' && l.notification_id) {
        resultBadge = `<span class="badge badge-success" title="O'qituvchi ogohlantirishdan so'ng davomatni kiritdi"><i class="fa fa-check-double"></i> To'g'irlandi</span>`;
      } else if (l.notification_id && l.attendance_status !== 'COMPLETED') {
        resultBadge = `<span class="badge badge-danger" title="Ogohlantirildi, lekin hali ham qilinmagan!"><i class="fa fa-clock"></i> Hali ham qilinmadi!</span>`;
      } else if (l.attendance_status === 'COMPLETED') {
        resultBadge = `<span class="badge badge-success"><i class="fa fa-check"></i> Vaqtida olingan</span>`;
      } else {
        resultBadge = `<span class="badge badge-warning"><i class="fa fa-hourglass-half"></i> Ogohlantirilmagan</span>`;
      }

      return `
        <tr>
          <td><strong>${index + 1}</strong></td>
          <td>
            <div style="font-weight: 600; color: #1e293b;">${escapeHtml(l.teacher_name)}</div>
            <div style="font-size: 11px; color: #64748b;">${escapeHtml(l.department)} &bull; ${escapeHtml(l.phone || 'Tel yo‘q')}</div>
            <div style="font-size: 11px; color: #0284c7;">${escapeHtml(l.telegram_username || '@ulangan_emas')}</div>
          </td>
          <td>
            <strong>${escapeHtml(l.group_name)}</strong>
            <div style="font-size: 11px; color: #64748b;">${l.total_students} nafar talaba</div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(l.subject_name)}</div>
            <div style="font-size: 11px; color: #64748b;">${escapeHtml(l.room || 'Xona belgilanmagan')}</div>
          </td>
          <td>
            <span class="badge badge-secondary">${l.pair_number}-juftlik</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(l.pair_time)}</div>
          </td>
          <td>${statusBadge}</td>
          <td>${notifBadge}</td>
          <td>${resultBadge}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              ${l.attendance_status !== 'COMPLETED' ? `
                <button class="btn btn-warning btn-sm" onclick="sendSingleAlert(${l.id})" title="Telegramga ogohlantirish yuborish">
                  <i class="fa fa-bell"></i> Xabar
                </button>
                <button class="btn btn-success btn-sm" onclick="quickCompleteLesson(${l.id})" title="Davomat to'ldirildi deb belgilash (Sinov)">
                  <i class="fa fa-check"></i> To'ldirdi
                </button>
              ` : `
                <button class="btn btn-light btn-sm" onclick="quickResetLesson(${l.id})" title="Davomatni bekor qilish (Sinov)">
                  <i class="fa fa-undo"></i> Qaytarish
                </button>
              `}
              <button class="btn btn-light btn-sm" onclick="viewMessagePreview(${l.id})" title="Xabar matnini ko'rish">
                <i class="fa fa-eye"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lessons load error:', err);
  }
}

async function loadTeachers() {
  const tbody = document.getElementById('teachersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/teachers');
    const teachers = await res.json();
    state.teachers = teachers;

    tbody.innerHTML = teachers.map((t, index) => {
      const hasTelegram = t.telegram_chat_id ? true : false;
      const teleBadge = hasTelegram 
        ? `<span class="badge badge-success"><i class="fa fa-check"></i> Bog'langan (${t.telegram_chat_id})</span>`
        : `<span class="badge badge-warning"><i class="fa fa-exclamation-circle"></i> Chat ID kiritilmagan</span>`;

      return `
        <tr>
          <td><strong>${index + 1}</strong></td>
          <td><span class="badge badge-secondary">${escapeHtml(t.hemis_id)}</span></td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(t.full_name)}</div>
            <div style="font-size: 11px; color: #64748b;">${escapeHtml(t.faculty || '')}</div>
          </td>
          <td>${escapeHtml(t.department)}</td>
          <td>${escapeHtml(t.phone || '-')}</td>
          <td>${escapeHtml(t.telegram_username || '-')}</td>
          <td>${teleBadge}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-light btn-sm" onclick="editTeacher(${t.id})">
                <i class="fa fa-edit"></i> Tahrirlash
              </button>
              ${hasTelegram ? `
                <button class="btn btn-primary btn-sm" onclick="testTeacherAlert('${t.telegram_chat_id}', '${escapeHtml(t.full_name)}')">
                  <i class="fa fa-paper-plane"></i> Test xabar
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Teachers load error:', err);
  }
}

async function loadNotifications() {
  const tbody = document.getElementById('alertsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/notifications');
    const logs = await res.json();
    state.notifications = logs;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#64748b;">Hozircha xabarnomalar yo'q</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map((n, index) => {
      const resolvedBadge = n.resolved === 1
        ? `<span class="badge badge-success"><i class="fa fa-check-circle"></i> To'g'irlandi (${n.resolved_at?.split(' ')[1] || ''})</span>`
        : `<span class="badge badge-danger"><i class="fa fa-clock"></i> Hali kutilmoqda</span>`;

      return `
        <tr>
          <td><strong>${index + 1}</strong></td>
          <td><small>${n.sent_at}</small></td>
          <td><strong>${escapeHtml(n.teacher_name)}</strong></td>
          <td>${escapeHtml(n.group_name)} (${n.pair_number}-juftlik)</td>
          <td>${escapeHtml(n.subject_name)}</td>
          <td><span class="badge badge-info">${n.status}</span> (№${n.reminder_count})</td>
          <td>${resolvedBadge}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Alerts load error:', err);
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    state.settings = settings;

    // Fill settings inputs
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('hemisApiUrlInput', settings.hemis_api_url);
    setVal('hemisApiTokenInput', settings.hemis_api_token);
    setVal('telegramBotTokenInput', settings.telegram_bot_token);
    setVal('telegramBotUsernameInput', settings.telegram_bot_username);

    const mockCheckbox = document.getElementById('mockModeCheckbox');
    if (mockCheckbox) mockCheckbox.checked = settings.mock_mode === '1';

    const autoCheckCheckbox = document.getElementById('autoCheckCheckbox');
    if (autoCheckCheckbox) autoCheckCheckbox.checked = settings.auto_check_enabled === '1';

    const statusBadge = document.getElementById('mockModeStatusBadge');
    if (statusBadge) {
      if (settings.mock_mode === '1') {
        statusBadge.textContent = 'Simulyatsiya (Lokal Test Rejimida)';
        statusBadge.className = 'badge badge-warning';
      } else {
        statusBadge.textContent = 'Jonli HEMIS API Rejimi Faol';
        statusBadge.className = 'badge badge-success';
      }
    }
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

// -------------------------------------------------------------
// USER ACTIONS
// -------------------------------------------------------------

// Run Full Check & Notification
async function runCheckNow() {
  const btn = document.getElementById('btnCheckNow');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Tekshirilmoqda...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/check-now', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast(`Davomat to'liq tekshirildi! ${data.summary.notified} ta o'qituvchiga ogohlantirish yuborildi. ${data.summary.resolvedNow} ta o'qituvchi davomatni to'g'irlagani qayd etildi.`, 'success');
      await loadAllData();
    } else {
      showToast(`Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Server xatosi: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Send single alert to a teacher
async function sendSingleAlert(lessonId) {
  try {
    const res = await fetch(`/api/notify-single/${lessonId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`${data.teacher} ga (${data.group}) darsi uchun ogohlantirish yuborildi!`, 'success');
      await loadAllData();
    } else {
      showToast(`Xatolik: ${data.sendResult?.error || 'Yuborib bo‘lmadi'}`, 'error');
    }
  } catch (err) {
    showToast(`Xatolik: ${err.message}`, 'error');
  }
}

// Quick complete attendance (Simulation of teacher finishing davomat)
async function quickCompleteLesson(lessonId) {
  try {
    const res = await fetch('/api/simulate-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, status: 'COMPLETED' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Davomat to'liq kiritildi deb belgilandi! Tizim ogohlantirishni avtomatik "To'g'irlandi" holatiga o'tkazdi.`, 'success');
      await loadAllData();
    }
  } catch (err) {
    showToast(`Xatolik: ${err.message}`, 'error');
  }
}

// Quick reset attendance back to NOT_TAKEN
async function quickResetLesson(lessonId) {
  try {
    const res = await fetch('/api/simulate-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, status: 'NOT_TAKEN' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Davomat bekor qilindi (Olinmagan holatga qaytarildi).`, 'warning');
      await loadAllData();
    }
  } catch (err) {
    showToast(`Xatolik: ${err.message}`, 'error');
  }
}

// View Message Preview
function viewMessagePreview(lessonId) {
  const lesson = state.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  const modal = document.getElementById('messagePreviewModal');
  const previewBox = document.getElementById('messagePreviewContent');

  const text = `🔔 HEMIS DAVOMAT OGOHLANTIRISHI

Hurmatli ${lesson.teacher_name}!

Sizning quyidagi darsingiz uchun HEMIS tizimida talabalar davomati to'liq olinmaganligi aniqlandi:

📚 Fan: ${lesson.subject_name}
👥 Guruh: ${lesson.group_name} (Jami: ${lesson.total_students} talaba)
🕒 Vaqt: ${lesson.pair_number}-juftlik (${lesson.pair_time})
🏛 Auditoriya: ${lesson.room || 'Biriktirilgan xona'}
📊 Holat: ${lesson.attendance_status === 'COMPLETED' ? 'To\'liq belgilangan' : '❌ Belgilanmagan (0/' + lesson.total_students + ')'}

⚠️ Eslatma: Universitet ichki tartib-qoidalariga muvofiq, dars davomati to'liq va o'z vaqtida kiritilishi shart. Aks holda OTM ma'muriyati tomonidan intizomiy chora (xayfsan) berilishi mumkin!

👉 HEMIS ga kirish: https://student.fstu.uz`;

  previewBox.textContent = text;
  modal.style.display = 'flex';
}

function closeMessagePreview() {
  document.getElementById('messagePreviewModal').style.display = 'none';
}

// Save Settings
async function saveSettings(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSaveSettings');
  btn.disabled = true;

  const payload = {
    hemis_api_url: document.getElementById('hemisApiUrlInput').value,
    hemis_api_token: document.getElementById('hemisApiTokenInput').value,
    telegram_bot_token: document.getElementById('telegramBotTokenInput').value,
    telegram_bot_username: document.getElementById('telegramBotUsernameInput').value,
    mock_mode: document.getElementById('mockModeCheckbox').checked ? '1' : '0',
    auto_check_enabled: document.getElementById('autoCheckCheckbox').checked ? '1' : '0'
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Sozlamalar saqlandi!', 'success');
      await loadSettings();
    } else {
      showToast(`Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Server xatosi: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// Test Telegram Bot
async function testTelegramBot() {
  const token = document.getElementById('telegramBotTokenInput').value;
  const testChatId = document.getElementById('testTelegramChatIdInput')?.value;

  if (!token) {
    showToast('Iltimos, avval Telegram Bot Tokenni kiriting!', 'error');
    return;
  }

  const btn = document.getElementById('btnTestTelegram');
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Tekshirilmoqda...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/test-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId: testChatId })
    });
    const data = await res.json();

    if (data.success) {
      let msg = `✅ Bot muvaffaqiyatli bog'landi! Bot: @${data.bot.username} (${data.bot.first_name})`;
      if (testChatId && data.sendResult?.success) {
        msg += ` va test xabari ${testChatId} ga yetkazildi!`;
      }
      showToast(msg, 'success');
    } else {
      showToast(`❌ Bot xatosi: ${data.error || 'Token yaroqsiz'}`, 'error');
    }
  } catch (err) {
    showToast(`Xatolik: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<i class="fa fa-plug"></i> Bot aloqasini tekshirish';
    btn.disabled = false;
  }
}

// Test HEMIS API
async function testHemisApi() {
  const apiUrl = document.getElementById('hemisApiUrlInput').value;
  const apiToken = document.getElementById('hemisApiTokenInput').value;

  if (!apiUrl) {
    showToast('Iltimos, HEMIS API manzilini kiriting!', 'error');
    return;
  }

  const btn = document.getElementById('btnTestHemis');
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Tekshirilmoqda...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/test-hemis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl, apiToken })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`✅ HEMIS API bilan aloqa o'rnatildi!`, 'success');
    } else {
      showToast(`HEMIS API javobi: ${data.error || 'Ulanib bo‘lmadi'} (Ertaga haqiqiy token kiritilganda to‘liq ishlaydi)`, 'warning');
    }
  } catch (err) {
    showToast(`Xatolik: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<i class="fa fa-check"></i> HEMIS API ulanishini tekshirish';
    btn.disabled = false;
  }
}

// Teacher modal
function openTeacherModal(teacher = null) {
  const modal = document.getElementById('teacherModal');
  const form = document.getElementById('teacherForm');
  form.reset();

  if (teacher) {
    document.getElementById('teacherModalTitle').textContent = "O'qituvchini tahrirlash";
    document.getElementById('teacherIdInput').value = teacher.id;
    document.getElementById('teacherHemisIdInput').value = teacher.hemis_id;
    document.getElementById('teacherNameInput').value = teacher.full_name;
    document.getElementById('teacherDeptInput').value = teacher.department;
    document.getElementById('teacherPhoneInput').value = teacher.phone || '';
    document.getElementById('teacherChatIdInput').value = teacher.telegram_chat_id || '';
    document.getElementById('teacherTelegramUsernameInput').value = teacher.telegram_username || '';
  } else {
    document.getElementById('teacherModalTitle').textContent = "Yangi o'qituvchi qo'shish";
    document.getElementById('teacherIdInput').value = '';
    document.getElementById('teacherHemisIdInput').value = 'T-' + Math.floor(10000 + Math.random() * 90000);
  }

  modal.style.display = 'flex';
}

function closeTeacherModal() {
  document.getElementById('teacherModal').style.display = 'none';
}

function editTeacher(id) {
  const t = state.teachers.find(item => item.id === id);
  if (t) openTeacherModal(t);
}

async function saveTeacher(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('teacherIdInput').value || null,
    hemis_id: document.getElementById('teacherHemisIdInput').value,
    full_name: document.getElementById('teacherNameInput').value,
    department: document.getElementById('teacherDeptInput').value,
    phone: document.getElementById('teacherPhoneInput').value,
    telegram_chat_id: document.getElementById('teacherChatIdInput').value,
    telegram_username: document.getElementById('teacherTelegramUsernameInput').value
  };

  try {
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast("O'qituvchi ma'lumotlari saqlandi!", 'success');
      closeTeacherModal();
      await loadTeachers();
    } else {
      showToast(`Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Server xatosi: ${err.message}`, 'error');
  }
}

// Test message to teacher
async function testTeacherAlert(chatId, teacherName) {
  const message = `🔔 <b>HEMIS TEST XABARNOMASI</b>\n\nHurmatli <b>${teacherName}</b>!\nBu tizim sizning Telegramingizga muvaffaqiyatli bog'langanligini tasdiqlovchi test xabaridir.`;
  try {
    const res = await fetch('/api/test-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: state.settings.telegram_bot_token,
        chatId: chatId,
        message: message
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${teacherName} ga test xabari yetkazildi!`, 'success');
    } else {
      showToast(`Xabar yuborishda xatolik: ${data.error || 'Yuborib bo‘lmadi'}`, 'error');
    }
  } catch (err) {
    showToast(`Xatolik: ${err.message}`, 'error');
  }
}

// Interactive Simulation Tab Action
async function simulateScenario(type) {
  const lessonId = document.getElementById('simLessonSelect').value;
  if (!lessonId) {
    showToast('Iltimos, darsni tanlang!', 'warning');
    return;
  }

  if (type === 'MARK_UNMARKED') {
    await fetch('/api/simulate-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, status: 'NOT_TAKEN' })
    });
    showToast('1-Qadam: Dars davomati olinmagan (0 ta) deb belgilandi.', 'warning');
  } else if (type === 'RUN_WARNING') {
    const res = await fetch(`/api/notify-single/${lessonId}`, { method: 'POST' });
    const data = await res.json();
    showToast(`2-Qadam: Telegram orqali o'qituvchiga ogohlantirish yuborildi! Status: ${data.deliveryStatus}`, 'info');
  } else if (type === 'MARK_COMPLETED') {
    await fetch('/api/simulate-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, status: 'COMPLETED' })
    });
    showToast('3-Qadam: O\'qituvchi HEMIS ga kirib barcha talabalarni bor/yo\'q qildi. Tizim ogohlantirishni avtomatik "To\'g\'irlandi" deb yopdi!', 'success');
  }

  await loadAllData();
}

// -------------------------------------------------------------
// UTILITIES
// -------------------------------------------------------------

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgColors = {
    success: '#16a34a',
    error: '#dc2626',
    warning: '#d97706',
    info: '#0284c7'
  };

  toast.style.cssText = `
    background-color: ${bgColors[type] || '#334155'};
    color: #ffffff;
    padding: 12px 18px;
    border-radius: 6px;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    animation: toastIn 0.2s ease-out;
  `;

  toast.innerHTML = `<div>${escapeHtml(message)}</div>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
