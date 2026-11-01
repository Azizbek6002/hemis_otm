// HEMIS Super Admin Attendance Monitoring Client Application

const state = {
  activeTab: 'monitoring',
  activeTeacherPane: 'pane-hemis',
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
  autoRefreshInterval: null,
  searchDebounceTimer: null
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupSidebarToggle();
  setupLanguageDropdown();
  setupNavigation();
  setupEventListeners();
  setupTeacherSearchAutofill();
  setupTeacherModalTabs();
  setupDepartmentSelect();
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

// -------------------------------------------------------------
// 1. SIDEBAR COLLAPSE TOGGLE (3 Horizontal Lines)
// -------------------------------------------------------------
function setupSidebarToggle() {
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  if (!toggleBtn) return;

  // Restore saved desktop collapse state
  const isCollapsed = localStorage.getItem('hemis_sidebar_collapsed') === '1';
  if (isCollapsed && window.innerWidth > 900) {
    document.body.classList.add('sidebar-collapsed');
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth <= 900) {
      document.body.classList.toggle('sidebar-open');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
      const nowCollapsed = document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem('hemis_sidebar_collapsed', nowCollapsed ? '1' : '0');
    }
  });

  // Close mobile sidebar on body click outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && document.body.classList.contains('sidebar-open')) {
      const sidebar = document.getElementById('hemisSidebar');
      if (sidebar && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        document.body.classList.remove('sidebar-open');
      }
    }
  });
}

// -------------------------------------------------------------
// 2. LANGUAGE DROPDOWN (Matches Rasm 1)
// -------------------------------------------------------------
function setupLanguageDropdown() {
  const wrapper = document.getElementById('langDropdownWrapper');
  const trigger = document.getElementById('langDropdownTrigger');
  const menu = document.getElementById('langDropdownMenu');
  const currentLangText = document.getElementById('currentLangText');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
    trigger.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (wrapper && !wrapper.contains(e.target)) {
      menu.classList.remove('show');
      trigger.classList.remove('active');
    }
  });

  const options = menu.querySelectorAll('.lang-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      const langCode = opt.getAttribute('data-lang');
      const langName = opt.textContent.trim();

      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      currentLangText.textContent = langName;
      menu.classList.remove('show');
      trigger.classList.remove('active');

      localStorage.setItem('hemis_lang', langCode);

      if (langCode !== 'uz-latn') {
        showToast(`Tanlandi: ${langName}. Hozircha tizim O'zbek tilida ishlaydi, boshqa tillar keyingi yangilanishda qo'shiladi.`, 'info');
      } else {
        showToast(`Til o'zgartirildi: ${langName}`, 'success');
      }
    });
  });

  const savedLang = localStorage.getItem('hemis_lang');
  if (savedLang) {
    const matching = menu.querySelector(`.lang-option[data-lang="${savedLang}"]`);
    if (matching) {
      options.forEach(o => o.classList.remove('selected'));
      matching.classList.add('selected');
      currentLangText.textContent = matching.textContent.trim();
    }
  }
}

// -------------------------------------------------------------
// 3. MODAL 3 TA BO'LIMI (HEMIS, QO'LDA, TELEGRAM) & KAFEDRA MENYUSI
// -------------------------------------------------------------
function setupTeacherModalTabs() {
  const tabBtns = document.querySelectorAll('.modal-nav-tab');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPane = btn.getAttribute('data-pane');
      goToTeacherPane(targetPane);
    });
  });
}

window.goToTeacherPane = function(paneId) {
  state.activeTeacherPane = paneId;

  // Update tabs
  document.querySelectorAll('.modal-nav-tab').forEach(btn => {
    if (btn.getAttribute('data-pane') === paneId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update panes
  document.querySelectorAll('.modal-nav-pane').forEach(pane => {
    if (pane.id === paneId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  // Update Prev / Next buttons
  const prevBtn = document.getElementById('btnPrevTeacherPane');
  const nextBtn = document.getElementById('btnNextTeacherPane');
  const submitBtn = document.getElementById('btnSubmitTeacher');

  if (paneId === 'pane-hemis') {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.innerHTML = '2-bo\'lim: Qo\'lda kiritish <i class="fa fa-chevron-right"></i>';
    }
  } else if (paneId === 'pane-manual') {
    if (prevBtn) {
      prevBtn.style.display = 'inline-flex';
      prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i> 1-bo\'lim (HEMIS)';
    }
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.innerHTML = '3-bo\'lim: Telegram <i class="fa fa-chevron-right"></i>';
    }
  } else if (paneId === 'pane-telegram') {
    if (prevBtn) {
      prevBtn.style.display = 'inline-flex';
      prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i> 2-bo\'lim (Qo\'lda)';
    }
    if (nextBtn) nextBtn.style.display = 'none';
  }
};

window.navigateTeacherPane = function(delta) {
  const panes = ['pane-hemis', 'pane-manual', 'pane-telegram'];
  const currentIndex = panes.indexOf(state.activeTeacherPane);
  const nextIndex = currentIndex + delta;

  if (nextIndex >= 0 && nextIndex < panes.length) {
    goToTeacherPane(panes[nextIndex]);
  }
};

// Kafedra Dropdown setup (User requirement: "Kafedra qo'shayotganda menu chiqsin tanlab kiritishga oson bo'lishi uchun")
function setupDepartmentSelect() {
  const select = document.getElementById('teacherDeptSelect');
  const customInput = document.getElementById('teacherDeptInput');
  if (!select || !customInput) return;

  select.addEventListener('change', () => {
    if (select.value === 'CUSTOM') {
      customInput.style.display = 'block';
      customInput.value = '';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = select.value;
    }
  });
}

// -------------------------------------------------------------
// 4. TEACHER SEARCH & AUTOFILL FROM HEMIS (1-BO'LIM)
// -------------------------------------------------------------
function setupTeacherSearchAutofill() {
  const searchInput = document.getElementById('hemisTeacherSearchInput');
  const resultsBox = document.getElementById('hemisSearchResults');
  if (!searchInput || !resultsBox) return;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearTimeout(state.searchDebounceTimer);

    if (val.length < 2) {
      resultsBox.innerHTML = '';
      resultsBox.style.display = 'none';
      return;
    }

    state.searchDebounceTimer = setTimeout(async () => {
      try {
        resultsBox.innerHTML = '<div style="padding: 10px; font-size: 12px; color: #64748b;"><i class="fa fa-spinner fa-spin"></i> HEMIS bazasidan qidirilmoqda...</div>';
        resultsBox.style.display = 'block';

        const res = await fetch(`/api/hemis/search-teachers?q=${encodeURIComponent(val)}`);
        const teachers = await res.json();

        if (!teachers || teachers.length === 0) {
          resultsBox.innerHTML = `
            <div style="padding: 12px; font-size: 12px; color: #64748b; text-align: center;">
              HEMIS da "${escapeHtml(val)}" bo‘yicha o‘qituvchi topilmadi.<br>
              <button type="button" class="btn btn-light btn-sm" style="margin-top: 6px;" onclick="goToTeacherPane('pane-manual')">
                <i class="fa fa-pen"></i> 2-bo'limga o'tib qo'lda kiritish
              </button>
            </div>
          `;
          return;
        }

        resultsBox.innerHTML = teachers.map(t => `
          <div class="hemis-search-item" onclick="selectHemisTeacher(${JSON.stringify(t).replace(/"/g, '&quot;')})">
            <div class="name">
              <i class="fa fa-user-tie" style="color: var(--hemis-blue);"></i>
              <span>${escapeHtml(t.full_name)}</span>
              <span class="badge badge-secondary" style="font-size: 10px; margin-left: auto;">${escapeHtml(t.hemis_id)}</span>
            </div>
            <div class="meta">
              ${escapeHtml(t.department || 'Kafedra')} &bull; ${escapeHtml(t.faculty || 'Fakultet')} &bull; ${escapeHtml(t.phone || 'Tel ko‘rsatilmagan')}
            </div>
          </div>
        `).join('');
      } catch (err) {
        resultsBox.innerHTML = `<div style="padding: 10px; font-size: 12px; color: #dc2626;">Qidiruvda xatolik: ${err.message}</div>`;
      }
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
      resultsBox.style.display = 'none';
    }
  });
}

window.selectHemisTeacher = function(t) {
  // Populate Manual fields
  document.getElementById('teacherHemisIdInput').value = t.hemis_id || '';
  document.getElementById('teacherNameInput').value = t.full_name || '';
  document.getElementById('teacherPhoneInput').value = t.phone || '';

  // Select Department in menu
  const deptSelect = document.getElementById('teacherDeptSelect');
  const customInput = document.getElementById('teacherDeptInput');
  let foundOption = false;

  if (deptSelect) {
    for (let i = 0; i < deptSelect.options.length; i++) {
      if (deptSelect.options[i].value.toLowerCase() === (t.department || '').toLowerCase()) {
        deptSelect.selectedIndex = i;
        foundOption = true;
        break;
      }
    }

    if (!foundOption) {
      deptSelect.value = 'CUSTOM';
      if (customInput) {
        customInput.style.display = 'block';
        customInput.value = t.department || '';
      }
    } else {
      if (customInput) {
        customInput.style.display = 'none';
        customInput.value = t.department || '';
      }
    }
  }

  // Update Bot Invite Link with teacher HEMIS ID
  const botUsername = state.settings.telegram_bot_username?.replace('@', '') || 'hemis_davomat_bot';
  const inviteLinkInput = document.getElementById('teacherBotInviteLink');
  if (inviteLinkInput) {
    inviteLinkInput.value = `https://t.me/${botUsername}?start=${t.hemis_id || 'teacher'}`;
  }

  // Hide search dropdown
  const resultsBox = document.getElementById('hemisSearchResults');
  if (resultsBox) resultsBox.style.display = 'none';

  // Show Teacher preview card in 1-bo'lim
  const previewBox = document.getElementById('selectedTeacherPreview');
  const previewName = document.getElementById('previewTeacherName');
  const previewDetails = document.getElementById('previewTeacherDetails');

  if (previewBox && previewName && previewDetails) {
    previewName.textContent = t.full_name;
    previewDetails.innerHTML = `<strong>HEMIS ID:</strong> ${t.hemis_id} &bull; <strong>Kafedra:</strong> ${t.department} &bull; <strong>Tel:</strong> ${t.phone || 'Ko‘rsatilmagan'}`;
    previewBox.style.display = 'block';
  }

  showToast(`✅ "${t.full_name}" ma'lumotlari to'liq yuklandi!`, 'success');
};

window.copyBotInviteLink = function() {
  const linkInput = document.getElementById('teacherBotInviteLink');
  if (linkInput) {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      showToast('Bot havolasi nusxalandi! Ushbu havolani o‘qituvchiga yuborishingiz mumkin.', 'success');
    }).catch(() => {
      linkInput.select();
      document.execCommand('copy');
      showToast('Bot havolasi nusxalandi!', 'success');
    });
  }
};

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

      if (window.innerWidth <= 900) {
        document.body.classList.remove('sidebar-open');
      }
    });
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

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
  document.getElementById('btnCheckNow')?.addEventListener('click', runCheckNow);

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

  document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);
  document.getElementById('btnTestTelegram')?.addEventListener('click', testTelegramBot);
  document.getElementById('btnTestHemis')?.addEventListener('click', testHemisApi);
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

    document.getElementById('statTotalLessons').textContent = data.totalLessons || 0;
    document.getElementById('statCompleted').textContent = data.completedLessons || 0;
    document.getElementById('statIncomplete').textContent = data.incompleteLessons || 0;
    document.getElementById('statNotified').textContent = data.totalNotified || 0;
    document.getElementById('statResolved').textContent = data.resolvedAfterWarning || 0;
    document.getElementById('statStillPending').textContent = data.stillPending || 0;

    const headerBadge = document.getElementById('headerAlertBadge');
    if (headerBadge) {
      headerBadge.textContent = data.stillPending || 0;
      headerBadge.style.display = data.stillPending > 0 ? 'inline-block' : 'none';
    }

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
          <td colspan="9" style="text-align: center; padding: 24px; color: #64748b;">
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
        if (l.notification_status === 'NO_CHAT_ID') {
          notifBadge = `<span class="badge badge-warning" title="O'qituvchining Telegram Chat ID si kiritilmagan"><i class="fa fa-exclamation-triangle"></i> Telegram ulanmagan</span>`;
        } else if (l.notification_status === 'FAILED') {
          notifBadge = `<span class="badge badge-danger" title="Xabarni yetkazishda xatolik yuz berdi"><i class="fa fa-times-circle"></i> Yetkazilmadi</span>`;
        } else {
          const time = l.notified_at ? l.notified_at.split(' ')[1]?.substring(0, 5) : '';
          const countTxt = l.reminder_count > 1 ? ` (${l.reminder_count}-bor)` : '';
          notifBadge = `<span class="badge badge-info" title="Xabar yuborilgan"><i class="fa fa-paper-plane"></i> Yuborildi ${time}${countTxt}</span>`;
        }
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

// -------------------------------------------------------------
// TEACHER MODAL OPEN & SAVE
// -------------------------------------------------------------
function openTeacherModal(teacher = null) {
  const modal = document.getElementById('teacherModal');
  const form = document.getElementById('teacherForm');
  form.reset();

  const previewBox = document.getElementById('selectedTeacherPreview');
  const searchInput = document.getElementById('hemisTeacherSearchInput');
  const resultsBox = document.getElementById('hemisSearchResults');
  const customDeptInput = document.getElementById('teacherDeptInput');
  const deptSelect = document.getElementById('teacherDeptSelect');

  if (previewBox) previewBox.style.display = 'none';
  if (resultsBox) resultsBox.style.display = 'none';
  if (customDeptInput) customDeptInput.style.display = 'none';

  if (teacher) {
    document.getElementById('teacherModalTitle').innerHTML = "<i class=\"fa fa-user-edit\"></i> O'qituvchini tahrirlash";
    document.getElementById('teacherIdInput').value = teacher.id;
    document.getElementById('teacherHemisIdInput').value = teacher.hemis_id;
    document.getElementById('teacherNameInput').value = teacher.full_name;
    document.getElementById('teacherPhoneInput').value = teacher.phone || '';
    document.getElementById('teacherChatIdInput').value = teacher.telegram_chat_id || '';
    document.getElementById('teacherTelegramUsernameInput').value = teacher.telegram_username || '';

    // Set Department
    let foundOption = false;
    if (deptSelect) {
      for (let i = 0; i < deptSelect.options.length; i++) {
        if (deptSelect.options[i].value.toLowerCase() === (teacher.department || '').toLowerCase()) {
          deptSelect.selectedIndex = i;
          foundOption = true;
          break;
        }
      }
      if (!foundOption) {
        deptSelect.value = 'CUSTOM';
        if (customDeptInput) {
          customDeptInput.style.display = 'block';
          customDeptInput.value = teacher.department || '';
        }
      } else {
        if (customDeptInput) customDeptInput.value = teacher.department || '';
      }
    }

    // Go directly to 2-bo'lim (Qo'lda kiritish) when editing
    goToTeacherPane('pane-manual');
  } else {
    document.getElementById('teacherModalTitle').innerHTML = "<i class=\"fa fa-user-plus\"></i> Yangi o'qituvchi qo'shish va bog'lash";
    document.getElementById('teacherIdInput').value = '';
    document.getElementById('teacherHemisIdInput').value = '';
    if (deptSelect) deptSelect.value = 'Dasturiy injiniring';
    if (customDeptInput) customDeptInput.value = 'Dasturiy injiniring';

    // Start with 1-bo'lim (HEMIS avtomatik)
    goToTeacherPane('pane-hemis');

    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 150);
    }
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

  const deptSelectVal = document.getElementById('teacherDeptSelect')?.value;
  const customDeptVal = document.getElementById('teacherDeptInput')?.value?.trim();
  const finalDepartment = (deptSelectVal === 'CUSTOM' || !deptSelectVal)
    ? (customDeptVal || 'Kafedra')
    : deptSelectVal;

  const payload = {
    id: document.getElementById('teacherIdInput').value || null,
    hemis_id: document.getElementById('teacherHemisIdInput').value.trim(),
    full_name: document.getElementById('teacherNameInput').value.trim(),
    department: finalDepartment,
    phone: document.getElementById('teacherPhoneInput').value.trim(),
    telegram_chat_id: document.getElementById('teacherChatIdInput').value.trim(),
    telegram_username: document.getElementById('teacherTelegramUsernameInput').value.trim()
  };

  if (!payload.hemis_id || !payload.full_name) {
    showToast('Iltimos, HEMIS ID va F.I.SH maydonlarini to\'ldiring (2-bo\'lim)', 'warning');
    goToTeacherPane('pane-manual');
    return;
  }

  try {
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast("O'qituvchi ma'lumotlari muvaffaqiyatli saqlandi!", 'success');
      closeTeacherModal();
      await loadTeachers();
    } else {
      showToast(`Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Server xatosi: ${err.message}`, 'error');
  }
}

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
