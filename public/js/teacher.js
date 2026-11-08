// HEMIS Teacher Portal Application Logic

const teacherState = {
  currentTeacherId: 1,
  activeTab: 'lessons',
  teacher: {},
  teachersList: [],
  todayLessons: [],
  selectedLesson: null,
  students: [],
  attendanceMap: {} // student_id -> 'PRESENT' | 'ABSENT' | 'EXCUSED'
};

document.addEventListener('DOMContentLoaded', () => {
  initTeacherApp();
});

async function initTeacherApp() {
  setupNavigation();
  setupSidebarToggle();
  setupLanguageDropdown();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // Check query params for teacher_id (e.g. ?teacher_id=2)
  const urlParams = new URLSearchParams(window.location.search);
  const tId = urlParams.get('teacher_id');
  if (tId) teacherState.currentTeacherId = parseInt(tId, 10);

  await loadTeacherProfile();
  await loadTeacherLessons();
  await loadAttendanceReport();
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

function setupSidebarToggle() {
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth <= 900) {
      document.body.classList.toggle('sidebar-open');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
    }
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && document.body.classList.contains('sidebar-open')) {
      const sidebar = document.getElementById('hemisSidebar');
      if (sidebar && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        document.body.classList.remove('sidebar-open');
      }
    }
  });
}

function setupLanguageDropdown() {
  const trigger = document.getElementById('langDropdownTrigger');
  const menu = document.getElementById('langDropdownMenu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    menu.classList.remove('show');
  });
}

function setupNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item[data-tab]');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      switchTeacherTab(tabName);

      if (window.innerWidth <= 900) {
        document.body.classList.remove('sidebar-open');
      }
    });
  });
}

function switchTeacherTab(tabName) {
  teacherState.activeTab = tabName;

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
      lessons: 'Mening darslarim (Bugun)',
      attendance: 'Davomat olish (Yo‘qlama)',
      report: 'Davomat hisoboti',
      telegram: 'Telegram xabarnomalarim'
    };
    breadcrumbCurrent.textContent = titles[tabName] || tabName;
  }
}

// -------------------------------------------------------------
// LOAD TEACHER DATA
// -------------------------------------------------------------
async function loadTeacherProfile() {
  try {
    const res = await fetch(`/api/teacher/profile?teacher_id=${teacherState.currentTeacherId}`);
    const data = await res.json();
    teacherState.teacher = data.teacher;
    teacherState.teachersList = data.teachersList || [];

    // Header & Banner profile info
    document.getElementById('teacherHeaderName').textContent = data.teacher.full_name;
    document.getElementById('teacherHeaderRole').textContent = data.teacher.department;
    document.getElementById('bannerTeacherName').textContent = data.teacher.full_name;
    document.getElementById('bannerTeacherDept').textContent = `${data.teacher.department} kafedrasi (${data.teacher.hemis_id})`;

    // Teacher switcher dropdown in header
    const selectEl = document.getElementById('teacherSelectDropdown');
    if (selectEl && teacherState.teachersList.length > 0) {
      selectEl.innerHTML = teacherState.teachersList.map(t => `
        <option value="${t.id}" ${t.id === teacherState.currentTeacherId ? 'selected' : ''}>
          ${escapeHtml(t.full_name)} (${escapeHtml(t.department)})
        </option>
      `).join('');

      selectEl.addEventListener('change', (e) => {
        teacherState.currentTeacherId = parseInt(e.target.value, 10);
        window.location.search = `?teacher_id=${teacherState.currentTeacherId}`;
      });
    }

    // Bot connection link
    const inviteLinkInput = document.getElementById('teacherTelegramLinkInput');
    if (inviteLinkInput) {
      inviteLinkInput.value = `https://t.me/hemis_davomat_bot?start=${data.teacher.hemis_id}`;
    }
  } catch (err) {
    console.error('Teacher profile load error:', err);
  }
}

async function loadTeacherLessons() {
  try {
    const res = await fetch(`/api/teacher/lessons?teacher_id=${teacherState.currentTeacherId}`);
    const lessons = await res.json();
    teacherState.todayLessons = lessons;

    const tbody = document.getElementById('teacherLessonsTableBody');
    const warningBox = document.getElementById('urgentWarningBanner');
    const warningText = document.getElementById('urgentWarningText');
    const pendingBadge = document.getElementById('teacherPendingBadge');

    let pendingCount = 0;
    let pendingLessonNames = [];

    lessons.forEach(l => {
      if (l.attendance_status !== 'COMPLETED') {
        pendingCount++;
        pendingLessonNames.push(`${l.pair_number}-juftlik (${l.group_name})`);
      }
    });

    if (pendingBadge) {
      pendingBadge.textContent = pendingCount;
      pendingBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    // Show/hide urgent warning banner
    if (warningBox && warningText) {
      if (pendingCount > 0) {
        warningText.innerHTML = `DIQQAT! Bugungi darsingiz uchun talabalar davomati olinmagan: <strong>${pendingLessonNames.join(', ')}</strong>. OTM ma'muriyatidan xayfsan olmaslik uchun zudlik bilan yo'qlamani to'ldiring!`;
        warningBox.style.display = 'flex';
      } else {
        warningBox.style.display = 'none';
      }
    }

    if (!tbody) return;

    if (lessons.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
            Bugungi kunda sizga biriktirilgan darslar topilmadi.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lessons.map((l, index) => {
      let statusBadge = '';
      if (l.attendance_status === 'COMPLETED') {
        statusBadge = `<span class="badge badge-success"><i class="fa fa-check-circle"></i> To'liq olingan (${l.marked_students}/${l.total_students})</span>`;
      } else if (l.attendance_status === 'PARTIAL') {
        statusBadge = `<span class="badge badge-warning"><i class="fa fa-exclamation-triangle"></i> Qisman (${l.marked_students}/${l.total_students})</span>`;
      } else {
        statusBadge = `<span class="badge badge-danger"><i class="fa fa-times-circle"></i> Olinmagan (0/${l.total_students})</span>`;
      }

      let warningBadge = '';
      if (l.notification_id) {
        if (l.is_resolved === 1) {
          warningBadge = `<span class="badge badge-success"><i class="fa fa-check-double"></i> To'g'irlandi</span>`;
        } else {
          warningBadge = `<span class="badge badge-danger"><i class="fa fa-bell"></i> Ogohlantirish borgan!</span>`;
        }
      } else {
        warningBadge = `<span class="badge badge-secondary"><i class="fa fa-clock"></i> Yo'q</span>`;
      }

      return `
        <tr>
          <td><strong>${index + 1}</strong></td>
          <td>
            <span class="badge badge-secondary">${l.pair_number}-juftlik</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(l.pair_time)}</div>
          </td>
          <td>
            <strong>${escapeHtml(l.group_name)}</strong>
            <div style="font-size: 11px; color: #64748b;">${l.total_students} nafar talaba</div>
          </td>
          <td>
            <div style="font-weight: 600; color: #1e293b;">${escapeHtml(l.subject_name)}</div>
            <div style="font-size: 11px; color: #64748b;">Auditoriya: ${escapeHtml(l.room || 'Xona yo‘q')}</div>
          </td>
          <td>${statusBadge}</td>
          <td>${warningBadge}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="openLessonAttendance(${l.id})">
              <i class="fa fa-clipboard-check"></i> ${l.attendance_status === 'COMPLETED' ? 'Qayta ko‘rish / Tahrirlash' : 'Davomat olish'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Teacher lessons load error:', err);
  }
}

// -------------------------------------------------------------
// OPEN LESSON ATTENDANCE (YO'QLAMA OLISH)
// -------------------------------------------------------------
async function openLessonAttendance(lessonId) {
  try {
    const res = await fetch(`/api/teacher/lesson/${lessonId}/students`);
    const data = await res.json();

    if (!data.lesson) {
      showToast('Dars ma’lumotlari topilmadi', 'error');
      return;
    }

    teacherState.selectedLesson = data.lesson;
    teacherState.students = data.students || [];

    // Initialize attendance map
    teacherState.attendanceMap = {};
    data.students.forEach(s => {
      teacherState.attendanceMap[s.id] = s.attendance_status || 'PRESENT';
    });

    // Populate Attendance Header
    document.getElementById('attLessonTitle').textContent = `${data.lesson.group_name} — ${data.lesson.subject_name}`;
    document.getElementById('attLessonMeta').innerHTML = `
      <strong>Juftlik:</strong> ${data.lesson.pair_number}-juftlik (${data.lesson.pair_time}) &bull; 
      <strong>Xona:</strong> ${data.lesson.room || 'Auditoriya'} &bull; 
      <strong>Talabalar soni:</strong> ${data.students.length} nafar
    `;

    renderStudentsTable();
    updateAttendanceCounters();

    // Switch to Attendance tab
    switchTeacherTab('attendance');
  } catch (err) {
    showToast(`Xatolik: ${err.message}`, 'error');
  }
}

function renderStudentsTable() {
  const tbody = document.getElementById('studentsAttendanceTableBody');
  if (!tbody) return;

  tbody.innerHTML = teacherState.students.map((s, index) => {
    const currentStatus = teacherState.attendanceMap[s.id] || 'PRESENT';

    return `
      <tr id="student-row-${s.id}">
        <td><strong>${index + 1}</strong></td>
        <td><span class="badge badge-secondary" style="font-family: monospace;">${escapeHtml(s.student_id_number)}</span></td>
        <td>
          <div style="font-weight: 600; font-size: 13px; color: #1e293b;">
            <i class="fa fa-${s.gender === 'F' ? 'female' : 'male'}" style="color: ${s.gender === 'F' ? '#ec4899' : '#0284c7'}; margin-right: 4px;"></i>
            ${escapeHtml(s.full_name)}
          </div>
        </td>
        <td>
          <div class="attendance-toggle-group">
            <button type="button" class="att-btn att-present ${currentStatus === 'PRESENT' ? 'active' : ''}" onclick="setStudentStatus(${s.id}, 'PRESENT')">
              <i class="fa fa-check"></i> Bor
            </button>
            <button type="button" class="att-btn att-absent ${currentStatus === 'ABSENT' ? 'active' : ''}" onclick="setStudentStatus(${s.id}, 'ABSENT')">
              <i class="fa fa-times"></i> Sababsiz
            </button>
            <button type="button" class="att-btn att-excused ${currentStatus === 'EXCUSED' ? 'active' : ''}" onclick="setStudentStatus(${s.id}, 'EXCUSED')">
              <i class="fa fa-file-medical"></i> Sababli
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.setStudentStatus = function(studentId, status) {
  teacherState.attendanceMap[studentId] = status;

  // Update row buttons
  const row = document.getElementById(`student-row-${studentId}`);
  if (row) {
    const buttons = row.querySelectorAll('.att-btn');
    buttons.forEach(b => b.classList.remove('active'));

    if (status === 'PRESENT') row.querySelector('.att-present')?.classList.add('active');
    else if (status === 'ABSENT') row.querySelector('.att-absent')?.classList.add('active');
    else if (status === 'EXCUSED') row.querySelector('.att-excused')?.classList.add('active');
  }

  updateAttendanceCounters();
};

window.markAllStudents = function(status) {
  teacherState.students.forEach(s => {
    teacherState.attendanceMap[s.id] = status;
  });
  renderStudentsTable();
  updateAttendanceCounters();
  showToast(`Barcha talabalar "${status === 'PRESENT' ? 'Bor' : (status === 'ABSENT' ? 'Sababsiz' : 'Sababli')}" deb belgilandi!`, 'info');
};

function updateAttendanceCounters() {
  let present = 0, absent = 0, excused = 0;
  Object.values(teacherState.attendanceMap).forEach(st => {
    if (st === 'PRESENT') present++;
    else if (st === 'ABSENT') absent++;
    else if (st === 'EXCUSED') excused++;
  });

  const total = teacherState.students.length;
  document.getElementById('countPresent').textContent = present;
  document.getElementById('countAbsent').textContent = absent;
  document.getElementById('countExcused').textContent = excused;
  document.getElementById('countTotal').textContent = total;
}

// -------------------------------------------------------------
// SAVE ATTENDANCE TO HEMIS
// -------------------------------------------------------------
window.saveAttendanceToHemis = async function() {
  if (!teacherState.selectedLesson) {
    showToast('Dars tanlanmagan', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitAttendance');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> HEMIS ga saqlanmoqda...';
  btn.disabled = true;

  const records = teacherState.students.map(s => ({
    student_id: s.id,
    status: teacherState.attendanceMap[s.id] || 'PRESENT'
  }));

  try {
    const res = await fetch(`/api/teacher/lesson/${teacherState.selectedLesson.id}/save-attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`✅ ${data.message}`, 'success');

      // Refresh lessons and report
      await loadTeacherLessons();
      await loadAttendanceReport();

      // Show success modal or switch back to lessons
      setTimeout(() => {
        switchTeacherTab('lessons');
      }, 1200);
    } else {
      showToast(`Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Server xatosi: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
};

// -------------------------------------------------------------
// LOAD ATTENDANCE REPORT (Image 4 format)
// -------------------------------------------------------------
async function loadAttendanceReport() {
  try {
    const res = await fetch(`/api/teacher/attendance-report?teacher_id=${teacherState.currentTeacherId}`);
    const report = await res.json();

    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    if (report.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Hozircha davomat hisoboti shakllanmagan</td></tr>`;
      return;
    }

    tbody.innerHTML = report.map(r => `
      <tr>
        <td><strong>${r.id}</strong></td>
        <td>
          <div style="font-weight: 600; color: #1e293b;">${escapeHtml(r.subject_name)}</div>
          <div style="font-size: 11px; color: #64748b;">Guruh: ${escapeHtml(r.group_name)}</div>
        </td>
        <td>${r.aud_hours}</td>
        <td>${r.sababli}</td>
        <td><strong style="color: ${r.sababsiz > 0 ? '#dc2626' : '#334155'};">${r.sababsiz}</strong></td>
        <td><strong>${r.jami}</strong></td>
        <td><span class="badge ${parseFloat(r.foiz) > 10 ? 'badge-danger' : 'badge-success'}">${r.foiz}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Attendance report load error:', err);
  }
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
    max-width: 420px;
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
