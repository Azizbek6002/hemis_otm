/**
 * HEMIS OTM Admin Dashboard JavaScript
 * SuperAdmin: Abdunazarov Azizbek Soxibjonovich
 */

document.addEventListener('DOMContentLoaded', () => {
  let adminData = null;
  let allTeachers = [];

  // DOM elementlari
  const statTotalTeachers = document.getElementById('statTotalTeachers');
  const statConnectedTeachers = document.getElementById('statConnectedTeachers');
  const statConnectedPercent = document.getElementById('statConnectedPercent');
  const statTodayLessons = document.getElementById('statTodayLessons');
  const statUnsavedLessons = document.getElementById('statUnsavedLessons');
  const statTodayDate = document.getElementById('statTodayDate');
  const superAdminNameNav = document.getElementById('superAdminNameNav');
  const userInitials = document.getElementById('userInitials');
  const cfgSuperAdminName = document.getElementById('cfgSuperAdminName');

  const teachersTableBody = document.getElementById('teachersTableBody');
  const attendanceTableBody = document.getElementById('attendanceTableBody');
  const teacherTableCount = document.getElementById('teacherTableCount');
  const teacherSearchInput = document.getElementById('teacherSearchInput');

  const btnBroadcastAll = document.getElementById('btnBroadcastAll');
  const btnRefreshData = document.getElementById('btnRefreshData');
  const btnOpenManualModal = document.getElementById('btnOpenManualModal');

  // Modal elementlari
  const manualAddModal = document.getElementById('manualAddModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const manualAddForm = document.getElementById('manualAddForm');

  // Toast konteyneri
  const toastContainer = document.getElementById('toastContainer');

  // Toast ko'rsatish funksiyasi
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 4500);
  }

  // Tablarni almashtirish va API Himoyasi
  let isApiUnlocked = sessionStorage.getItem('hemis_api_unlocked') === '1';

  function updateApiLockBadge() {
    const icon = document.getElementById('tabApiLockIcon');
    const badge = document.getElementById('badgeApiLock');
    if (!icon || !badge) return;
    if (isApiUnlocked) {
      icon.className = 'fa-solid fa-lock-open';
      icon.style.color = '#10b981';
      badge.textContent = 'Ochiq';
      badge.style.background = '#10b981';
    } else {
      icon.className = 'fa-solid fa-lock';
      icon.style.color = '#f59e0b';
      badge.textContent = 'Parolli';
      badge.style.background = '#ef4444';
    }
  }

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  function activateTab(targetId) {
    tabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === targetId) b.classList.add('active');
      else b.classList.remove('active');
    });
    tabContents.forEach(c => {
      if (c.id === targetId) c.classList.add('active');
      else c.classList.remove('active');
    });
    if (targetId === 'tab-api') {
      loadApiConfig();
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      if (targetId === 'tab-api' && !isApiUnlocked) {
        openApiPasswordModal();
        return;
      }
      activateTab(targetId);
    });
  });

  // API Parol modali elementlari
  const apiPasswordModal = document.getElementById('apiPasswordModal');
  const apiPasswordInput = document.getElementById('apiPasswordInput');
  const apiPasswordErrorContainer = document.getElementById('apiPasswordErrorContainer');
  const btnCloseApiPasswordModal = document.getElementById('btnCloseApiPasswordModal');
  const btnCancelApiPasswordModal = document.getElementById('btnCancelApiPasswordModal');
  const apiPasswordForm = document.getElementById('apiPasswordForm');
  const togglePasswordVisibilityBtn = document.getElementById('togglePasswordVisibilityBtn');
  const togglePasswordEyeIcon = document.getElementById('togglePasswordEyeIcon');

  function openApiPasswordModal() {
    if (!apiPasswordModal) return;
    apiPasswordModal.classList.add('active');
    if (apiPasswordErrorContainer) apiPasswordErrorContainer.style.display = 'none';
    if (apiPasswordInput) {
      apiPasswordInput.value = '';
      apiPasswordInput.type = 'password';
      apiPasswordInput.style.borderColor = '';
      setTimeout(() => apiPasswordInput.focus(), 150);
    }
    if (togglePasswordEyeIcon) togglePasswordEyeIcon.className = 'fa-solid fa-eye';
  }

  function closeApiPasswordModal() {
    if (!apiPasswordModal) return;
    apiPasswordModal.classList.remove('active');
    if (apiPasswordErrorContainer) apiPasswordErrorContainer.style.display = 'none';
  }

  btnCloseApiPasswordModal?.addEventListener('click', closeApiPasswordModal);
  btnCancelApiPasswordModal?.addEventListener('click', closeApiPasswordModal);

  apiPasswordModal?.addEventListener('click', (e) => {
    if (e.target === apiPasswordModal) {
      closeApiPasswordModal();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && apiPasswordModal?.classList.contains('active')) {
      closeApiPasswordModal();
    }
  });

  togglePasswordVisibilityBtn?.addEventListener('click', () => {
    if (!apiPasswordInput) return;
    if (apiPasswordInput.type === 'password') {
      apiPasswordInput.type = 'text';
      if (togglePasswordEyeIcon) togglePasswordEyeIcon.className = 'fa-solid fa-eye-slash';
    } else {
      apiPasswordInput.type = 'password';
      if (togglePasswordEyeIcon) togglePasswordEyeIcon.className = 'fa-solid fa-eye';
    }
  });

  const DEVELOPER_API_PASSWORD = "6aa181JTI74s8r";

  apiPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entered = (apiPasswordInput?.value || '').trim();

    let valid = (entered === DEVELOPER_API_PASSWORD);
    try {
      const res = await fetch('/api/admin/verify-api-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: entered })
      });
      valid = res.ok;
    } catch (err) {
      valid = (entered === DEVELOPER_API_PASSWORD);
    }

    if (valid) {
      isApiUnlocked = true;
      sessionStorage.setItem('hemis_api_unlocked', '1');
      closeApiPasswordModal();
      updateApiLockBadge();
      activateTab('tab-api');
      showToast("✅ Xavfsizlik paroli tasdiqlandi! API sozlamalari ochildi.", "success");
    } else {
      if (apiPasswordErrorContainer) apiPasswordErrorContainer.style.display = 'block';
      if (apiPasswordInput) {
        apiPasswordInput.style.borderColor = '#ef4444';
        apiPasswordInput.focus();
        apiPasswordInput.select();
      }
    }
  });

  // Re-lock
  document.getElementById('btnLockApiTab')?.addEventListener('click', () => {
    isApiUnlocked = false;
    sessionStorage.removeItem('hemis_api_unlocked');
    updateApiLockBadge();
    activateTab('tab-teachers');
    showToast("🔒 API bo'limi qayta qulflandi.", "success");
  });

  // Bearer Token ko'rinishini almashtirish
  const toggleTokenVisibilityBtn = document.getElementById('toggleTokenVisibilityBtn');
  const toggleTokenEyeIcon = document.getElementById('toggleTokenEyeIcon');
  const cfgHemisApiToken = document.getElementById('cfgHemisApiToken');

  toggleTokenVisibilityBtn?.addEventListener('click', () => {
    if (!cfgHemisApiToken) return;
    if (cfgHemisApiToken.type === 'password') {
      cfgHemisApiToken.type = 'text';
      if (toggleTokenEyeIcon) toggleTokenEyeIcon.className = 'fa-solid fa-eye-slash';
    } else {
      cfgHemisApiToken.type = 'password';
      if (toggleTokenEyeIcon) toggleTokenEyeIcon.className = 'fa-solid fa-eye';
    }
  });

  // Load API config
  async function loadApiConfig() {
    try {
      const res = await fetch('/api/admin/api-config');
      const data = await res.json();
      if (data.success && data.config) {
        const urlInput = document.getElementById('cfgHemisApiUrl');
        const tokenInput = document.getElementById('cfgHemisApiToken');
        if (urlInput) urlInput.value = data.config.hemisApiUrl || "https://hemis.fstu.uz/rest/v1";
        if (tokenInput) tokenInput.value = data.config.hemisApiToken || "";
      }
    } catch (e) {
      console.warn('API config load error:', e);
    }
  }

  // Save API settings form
  const apiSettingsForm = document.getElementById('apiSettingsForm');
  apiSettingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hemisApiUrl = document.getElementById('cfgHemisApiUrl')?.value.trim();
    const hemisApiToken = document.getElementById('cfgHemisApiToken')?.value.trim();

    try {
      const res = await fetch('/api/admin/save-api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hemisApiUrl, hemisApiToken })
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ HEMIS API sozlamalari muvaffaqiyatli saqlandi! Tizim yangi API ga ulandi.", "success");
      } else {
        showToast("Xatolik: " + data.message, "error");
      }
    } catch (err) {
      showToast("Server xatosi: " + err.message, "error");
    }
  });

  // Test real HEMIS API connection
  const btnTestApiConnection = document.getElementById('btnTestApiConnection');
  btnTestApiConnection?.addEventListener('click', async () => {
    const hemisApiUrl = document.getElementById('cfgHemisApiUrl')?.value.trim();
    const hemisApiToken = document.getElementById('cfgHemisApiToken')?.value.trim();
    const badge = document.getElementById('apiTestStatusBadge');

    if (!hemisApiUrl) {
      showToast("Iltimos, avval HEMIS API URL manzilini kiriting", "error");
      return;
    }

    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Tekshirilmoqda...`;
      badge.style.color = '#0284c7';
    }

    try {
      const res = await fetch('/api/admin/test-api-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hemisApiUrl, hemisApiToken })
      });
      const data = await res.json();
      if (data.success) {
        if (badge) {
          badge.innerHTML = `🟢 Aloqa muvaffaqiyatli!`;
          badge.style.color = '#16a34a';
        }
        showToast("✅ " + data.message, "success");
      } else {
        if (badge) {
          badge.innerHTML = `🔴 Xatolik (${res.status})`;
          badge.style.color = '#dc2626';
        }
        showToast("❌ " + data.message, "error");
      }
    } catch (err) {
      if (badge) {
        badge.innerHTML = `🔴 Aloqa xatosi`;
        badge.style.color = '#dc2626';
      }
      showToast("Tarmoq xatosi: " + err.message, "error");
    }
  });

  updateApiLockBadge();

  // 1. Ma'lumotlarni serverdan yuklash
  async function loadDashboardData() {
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();

      if (!data.success) {
        showToast("Ma'lumotlarni yuklashda xatolik yuz berdi", "error");
        return;
      }

      adminData = data;
      allTeachers = data.teachers || [];

      // SuperAdmin profili
      if (data.superAdmin) {
        superAdminNameNav.textContent = data.superAdmin.name;
        cfgSuperAdminName.textContent = data.superAdmin.name;
        const initials = data.superAdmin.name.split(' ').map(p => p[0]).slice(0, 2).join('');
        userInitials.textContent = initials || "AA";
      }

      // KPI Ko'rsatkichlari
      statTotalTeachers.textContent = data.metrics.totalTeachers;
      statConnectedTeachers.textContent = data.metrics.connectedTeachers;
      statConnectedPercent.textContent = `${data.metrics.connectionPercent}%`;
      statTodayLessons.textContent = data.metrics.todayTotalLessons;
      statUnsavedLessons.textContent = data.metrics.todayUnsavedLessons;
      statTodayDate.textContent = data.metrics.todayDate || "05.11.2026";

      // Jadvallarni chizish
      renderTeachersTable(allTeachers);
      renderAttendanceTable(data.todayLessons || []);

    } catch (err) {
      console.error("Dashboard yuklashda xato:", err);
      showToast("Server bilan bog'lanishda xatolik", "error");
    }
  }

  // 2. O'qituvchilar jadvalini chizish
  function renderTeachersTable(teachers) {
    teacherTableCount.textContent = teachers.length;

    if (teachers.length === 0) {
      teachersTableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 35px; color: #888;">
            <i class="fa-solid fa-user-slash" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Bazada o'qituvchilar topilmadi
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    teachers.forEach((t, idx) => {
      // Telegram holati
      let botBadge = '';
      if (t.isConnected) {
        const usernameStr = t.telegramUsername ? `@${t.telegramUsername}` : `ID: ${t.chatId}`;
        botBadge = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Ulangan (${usernameStr})</span>`;
      } else {
        botBadge = `<span class="badge badge-secondary"><i class="fa-regular fa-circle"></i> Hali ulanmagan</span>`;
      }

      // Bugungi davomat holati
      let attBadge = '';
      if (t.todayLessonsCount === 0) {
        attBadge = `<span class="badge badge-secondary">Dars yo'q</span>`;
      } else if (t.todayUnsavedCount > 0) {
        attBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-exclamation"></i> ${t.todayUnsavedCount} ta saqlanmagan</span>`;
      } else {
        attBadge = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> To'liq saqlangan</span>`;
      }

      // Amallar
      let actions = '';
      if (t.isConnected) {
        actions = `
          <button class="btn btn-outline btn-sm btn-send-single" data-hemis="${t.hemisId}" data-name="${t.fullName}" title="Eslatma yuborish">
            <i class="fa-solid fa-paper-plane"></i> Xabar
          </button>
          <button class="btn btn-danger-sm btn-sm btn-disconnect" data-hemis="${t.hemisId}" data-name="${t.fullName}" title="Botdan uzish">
            <i class="fa-solid fa-link-slash"></i> Uzish
          </button>
        `;
      } else {
        actions = `
          <button class="btn btn-outline btn-sm btn-quick-connect" data-hemis="${t.hemisId}" data-name="${t.fullName}" data-dept="${t.department}" data-phone="${t.phone}">
            <i class="fa-solid fa-link"></i> Qo'lda ulash
          </button>
        `;
      }

      html += `
        <tr>
          <td><b>${idx + 1}</b></td>
          <td><code>${t.hemisId}</code></td>
          <td><b>${t.fullName}</b></td>
          <td>${t.department}</td>
          <td>${t.phone || '-'}</td>
          <td>${botBadge}</td>
          <td><small>${t.connectedAt || '-'}</small></td>
          <td>${attBadge}</td>
          <td>${actions}</td>
        </tr>
      `;
    });

    teachersTableBody.innerHTML = html;
    attachTeacherTableEvents();
  }

  // 3. 8.2 Davomat jadvalini chizish
  function renderAttendanceTable(lessons) {
    if (lessons.length === 0) {
      attendanceTableBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 35px; color: #888;">
            Bugungi kunda rejalashtirilgan darslar yo'q
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    lessons.forEach((l, idx) => {
      const isSaved = l.isSaved;
      const statusBadge = isSaved 
        ? `<span class="badge badge-success"><i class="fa-solid fa-check"></i> 🟢 Saqlangan (Sanasi Yashil)</span>`
        : `<span class="badge badge-danger"><i class="fa-solid fa-triangle-exclamation"></i> 🔴 SAQLANMAGAN (Sanasi Qizil)</span>`;

      const dateStyle = isSaved ? 'color: #00a65a; font-weight: 700;' : 'color: #dd4b39; font-weight: 700;';

      html += `
        <tr>
          <td>${idx + 1}</td>
          <td><span style="${dateStyle}">${l.date}</span></td>
          <td><b>${l.group}</b></td>
          <td>${l.subject}</td>
          <td><span class="badge badge-secondary">${l.type}</span></td>
          <td>${l.pair}</td>
          <td>${l.room}</td>
          <td>${l.teacher}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-outline btn-sm btn-toggle-att" data-id="${l.id}">
              ${isSaved ? "Qizilga o'tkazish" : "Davomatni saqlash (Yashil)"}
            </button>
          </td>
        </tr>
      `;
    });

    attendanceTableBody.innerHTML = html;

    // Davomat holatini almashtirish tugmalari
    document.querySelectorAll('.btn-toggle-att').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lessonId = btn.getAttribute('data-id');
        try {
          const res = await fetch('/api/attendance/toggle-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonId })
          });
          const result = await res.json();
          if (result.success) {
            showToast("Davomat holati o'zgartirildi!");
            loadDashboardData();
          }
        } catch (e) {
          showToast("Xatolik yuz berdi", "error");
        }
      });
    });
  }

  // 4. Jadvaldagi amallar hodisalari
  function attachTeacherTableEvents() {
    // A. Bitta o'qituvchiga eslatma jo'natish
    document.querySelectorAll('.btn-send-single').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hemisId = btn.getAttribute('data-hemis');
        const teacherName = btn.getAttribute('data-name');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...`;

        try {
          const res = await fetch('/api/bot/send-single-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hemisId })
          });
          const result = await res.json();
          if (result.success) {
            showToast(`✅ ${teacherName} ga Telegram orqali eslatma yetkazildi!`);
          } else {
            showToast(`Xatolik: ${result.message || result.error}`, 'error');
          }
        } catch (err) {
          showToast("Xabar jo'natishda xatolik", "error");
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Xabar`;
        }
      });
    });

    // B. O'qituvchini botdan uzish
    document.querySelectorAll('.btn-disconnect').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hemisId = btn.getAttribute('data-hemis');
        const teacherName = btn.getAttribute('data-name');
        if (!confirm(`${teacherName} ni botdan uzmoqchimisiz?`)) return;

        try {
          const res = await fetch('/api/bot/disconnect-teacher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hemisId })
          });
          const result = await res.json();
          if (result.success) {
            showToast("O'qituvchi botdan uzildi!");
            loadDashboardData();
          }
        } catch (err) {
          showToast("Uzishda xatolik yuz berdi", "error");
        }
      });
    });

    // C. Qo'lda tezkor ulash
    document.querySelectorAll('.btn-quick-connect').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('mFullName').value = btn.getAttribute('data-name');
        document.getElementById('mHemisId').value = btn.getAttribute('data-hemis');
        document.getElementById('mDepartment').value = btn.getAttribute('data-dept');
        document.getElementById('mPhone').value = btn.getAttribute('data-phone');
        document.getElementById('mChatId').value = '6601373862'; // Boshlang'ich test uchun

        manualAddModal.classList.add('active');
      });
    });
  }

  // 5. O'qituvchilarni qidirish (Filter)
  teacherSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderTeachersTable(allTeachers);
      return;
    }

    const filtered = allTeachers.filter(t => 
      t.fullName.toLowerCase().includes(q) ||
      String(t.hemisId).includes(q) ||
      (t.department && t.department.toLowerCase().includes(q))
    );
    renderTeachersTable(filtered);
  });

  // 6. Barchaga 20:00 bildirishnomasini yuborish
  btnBroadcastAll.addEventListener('click', async () => {
    if (!confirm("Barcha ulangan o'qituvchilarga kunlik 20:00 bildirishnomasini yuborishni tasdiqlaysizmi?")) return;

    btnBroadcastAll.disabled = true;
    btnBroadcastAll.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...`;

    try {
      const res = await fetch('/api/bot/broadcast-reminders', { method: 'POST' });
      const result = await res.json();

      if (result.success) {
        showToast(`✅ Bildirishnomalar muvaffaqiyatli jo'natildi! (Yuborildi: ${result.result.sentCount} ta)`);
        loadDashboardData();
      } else {
        showToast("Xatolik: " + result.error, "error");
      }
    } catch (err) {
      showToast("Xatolik yuz berdi", "error");
    } finally {
      btnBroadcastAll.disabled = false;
      btnBroadcastAll.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Barchaga 20:00 Bildirishnomasini Yuborish</span>`;
    }
  });

  // 7. Yangilash tugmasi
  btnRefreshData.addEventListener('click', () => {
    loadDashboardData();
    showToast("Ma'lumotlar yangilandi!");
  });

  // 8. Qo'lda biriktirish modali
  btnOpenManualModal.addEventListener('click', () => {
    manualAddForm.reset();
    manualAddModal.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => manualAddModal.classList.remove('active'));
  btnCancelModal.addEventListener('click', () => manualAddModal.classList.remove('active'));

  manualAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      fullName: document.getElementById('mFullName').value.trim(),
      hemisId: document.getElementById('mHemisId').value.trim(),
      chatId: document.getElementById('mChatId').value.trim(),
      department: document.getElementById('mDepartment').value.trim(),
      phone: document.getElementById('mPhone').value.trim()
    };

    try {
      const res = await fetch('/api/bot/add-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast("O'qituvchi muvaffaqiyatli biriktirildi!");
        manualAddModal.classList.remove('active');
        loadDashboardData();
      } else {
        showToast("Xatolik: " + (data.message || data.error), "error");
      }
    } catch (err) {
      showToast("Server xatosi", "error");
    }
  });

  // Sahifa yuklanganda ma'lumotlarni olish
  loadDashboardData();

  // Har 10 soniyada avtomatik yangilash
  setInterval(loadDashboardData, 10000);
});
