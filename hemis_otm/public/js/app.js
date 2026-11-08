/**
 * HEMIS OTM Front-end Application Logic
 * O'zbekiston Respublikasi Oliy Ta'lim Axborot Tizimi (1:1 Klon)
 */

let appData = null;
let currentActiveLessonId = null;

// ==========================================================================
// 1. DASTURNI ISHGA TUSHIRISH VA MA'LUMOTLARNI YUKLASH
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initLiveClock();
  initSidebarEvents();
  await loadAppData();
  
  // Dastlabki sahifani hash orqali ochish (agar hash bo'lmasa 8.2 dars o'tish yoki dashboard)
  const hash = window.location.hash.replace('#', '') || 'lesson_process';
  navigateTo(hash);
});

// Real vaqtli sana va soat (Skrinshotdagi sana formati: 05.11.2026 21:23:48)
function initLiveClock() {
  const clockEl = document.getElementById('liveClockText');
  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockEl.innerText = `05.11.2026 ${h}:${min}:${s}`;
  }
  update();
  setInterval(update, 1000);
}

// ==========================================================================
// 2. SIDEBAR VA MENYU BOSHQARUVI (3 TA GORIZONTAL CHIZIQ TOGGLE)
// ==========================================================================
function initSidebarEvents() {
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const logoArea = document.getElementById('headerLogoArea');
  const logoTextFull = logoArea.querySelector('.logo-text-full');
  const logoTextMini = logoArea.querySelector('.logo-text-mini');

  // Hamburger menyu bosilganda (Rasm 22 holati - 50px ga qisqaradi)
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    if (isCollapsed) {
      logoTextFull.style.display = 'none';
      logoTextMini.style.display = 'inline';
    } else {
      logoTextFull.style.display = 'inline';
      logoTextMini.style.display = 'none';
    }
  });

  // Akkordeon submenyu (Treeview ochish/yopish)
  document.querySelectorAll('.sidebar-item.has-treeview > a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const parentItem = link.parentElement;
      const isOpen = parentItem.classList.contains('open');

      parentItem.classList.toggle('open', !isOpen);
      const submenu = parentItem.querySelector('.sidebar-submenu');
      if (submenu) {
        submenu.style.display = !isOpen ? 'block' : 'none';
      }
    });
  });

  // Ichki menyu (subitem) bosilganda sahifani almashtirish
  document.querySelectorAll('.sidebar-subitem').forEach(subitem => {
    subitem.addEventListener('click', (e) => {
      e.preventDefault();
      const page = subitem.getAttribute('data-page');
      navigateTo(page);
    });
  });

  // Bosh sahifa menyusi
  document.querySelector('.sidebar-item[data-page="dashboard"] a').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('dashboard');
  });

  // Tezkor menyu tanlagich
  const quickSelect = document.getElementById('sidebarQuickSelect');
  quickSelect.addEventListener('change', () => {
    navigateTo(quickSelect.value);
  });

  // Tepadagi foydalanuvchi profiliga bosilganda
  document.getElementById('userProfileHeaderBtn').addEventListener('click', () => {
    navigateTo('profile');
  });

  // Yangilash tugmasi
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await loadAppData();
  });

  // Floating Chat tugmasi
  document.getElementById('floatingChatBtn').addEventListener('click', () => {
    alert("HEMIS Onlayn Muloqot: Savollaringiz bo'lsa kafedra mudiri yoki administratorga murojaat qilishingiz mumkin.");
  });
}

// ==========================================================================
// 3. API MA'LUMOTLARINI YUKLASH VA JADVALLARNI TO'LDIRISH
// ==========================================================================
async function loadAppData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    if (data.success) {
      appData = data;
      renderAllTables(data);
    }
  } catch (err) {
    console.error("API ma'lumotlarini yuklashda xatolik:", err);
  }
}

// Barcha sahifalar jadvallarini render qilish
function renderAllTables(data) {
  
  // ========================================================================
  // 8.2 DARS O'TISH JADVALI (ENG ASOSIY JOY!)
  // Qoida:
  // - Oldingi kunlardagi darslarning sanasi YASHIL (#00a65a)
  // - Bugungi darslarning (05.11.2026) sanasi esa saqlanmagan bo'lsa QIZIL (#dd4b39)!
  // - O'qituvchi davomatni saqlaganidan so'ng sanasi YASHIL ga aylanadi!
  // ========================================================================
  const lessonsTbody = document.getElementById('lessonsHistoryTableBody');
  if (lessonsTbody && data.lessonsProcess) {
    lessonsTbody.innerHTML = data.lessonsProcess.map(l => {
      // Sana rangi: agar saqlangan bo'lsa yashil, saqlanmagan bo'lsa qizil!
      const dateColor = l.isSaved ? '#00a65a' : '#dd4b39';
      const statusTitle = l.isSaved ? 'Davomat saqlangan' : 'Davomat saqlanmagan! Saqlash uchun bosing';
      const dateHtml = `<a href="javascript:void(0)" onclick="openAttendanceModal('${l.id}')" style="color: ${dateColor}; font-weight: 700; text-decoration: underline;" title="${statusTitle}">${l.date}</a>`;

      return `
        <tr>
          <td>${l.id}</td>
          <td>${l.year}</td>
          <td>${l.semester}</td>
          <td><span class="badge-pill-blue">${l.group}</span></td>
          <td>${dateHtml}</td>
          <td>${l.subject}</td>
          <td>${l.type}</td>
          <td>${l.pair}</td>
          <td>${l.room}</td>
          <td>${l.teacher}</td>
          <td style="text-align: center;">
            <i class="fa fa-qrcode" style="font-size: 18px; color: #3c8dbc; cursor: pointer;" title="QR Davomat" onclick="openAttendanceModal('${l.id}')"></i>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 8.3 Davomat jurnali (Rasm 8.3)
  const journalTbody = document.getElementById('attendanceJournalTableBody');
  if (journalTbody && data.attendanceJournals) {
    journalTbody.innerHTML = data.attendanceJournals.map(j => `
      <tr>
        <td>${j.id}</td>
        <td><a href="javascript:void(0)" onclick="navigateTo('lesson_process')" style="color: #0073b7; font-weight: 600;">${j.group}</a></td>
        <td><a href="javascript:void(0)" onclick="navigateTo('lesson_process')" style="color: #0073b7;">${j.subject}</a></td>
        <td>${j.type}</td>
        <td>${j.year}</td>
        <td>${j.semester}</td>
      </tr>
    `).join('');
  }

  // 8.4 Baholash jurnali (Rasm 8.4)
  const gradeJournalTbody = document.getElementById('gradeJournalTableBody');
  if (gradeJournalTbody && data.attendanceJournals) {
    gradeJournalTbody.innerHTML = data.attendanceJournals.map(j => `
      <tr>
        <td>${j.id}</td>
        <td><span style="color: #0073b7; font-weight: 600;">${j.group}</span></td>
        <td><span style="color: #0073b7;">${j.subject}</span></td>
        <td>${j.type}</td>
        <td>${j.year}</td>
        <td>${j.semester}</td>
      </tr>
    `).join('');
  }

  // 3.1 Fan mavzulari (Rasm 3.1)
  const topicsTbody = document.getElementById('subjectTopicsTableBody');
  if (topicsTbody && data.subjectTopics) {
    topicsTbody.innerHTML = data.subjectTopics.map(t => {
      const lectureBadge = t.warning && t.lecture === '30 / 0' 
        ? `<span class="badge-lesson-red">Ma'ruza [${t.lecture}]</span>`
        : `<span class="badge-lesson-green">Ma'ruza [${t.lecture}]</span>`;
      const practiceBadge = t.warning && t.practice.includes('/ 0')
        ? `<span class="badge-lesson-red">Amaliy [${t.practice}]</span>`
        : `<span class="badge-lesson-green">Amaliy [${t.practice}]</span>`;
      return `
        <tr>
          <td>${t.id}</td>
          <td><span style="color: #0073b7; font-weight: 600;">${t.subject}</span></td>
          <td>${t.curriculum}</td>
          <td>${t.year}<br><small style="color: #888;">${t.semester}</small></td>
          <td>${t.eduType}<br><small style="color: #00a65a;">${t.status}</small></td>
          <td>${t.department}</td>
          <td>${lectureBadge} ${practiceBadge}</td>
        </tr>
      `;
    }).join('');
  }

  // 3.2 Fan resurslari (Rasm 3.2)
  const resTbody = document.getElementById('subjectResourcesTableBody');
  if (resTbody && data.subjectResources) {
    resTbody.innerHTML = data.subjectResources.map(r => `
      <tr>
        <td>${r.id}</td>
        <td><a href="javascript:void(0)" style="color: #0073b7;">${r.title}</a></td>
        <td>${r.subject}</td>
        <td style="text-align: center;"><span style="background: #777; color: #fff; padding: 2px 7px; border-radius: 10px; font-size: 11px;">${r.files}</span></td>
        <td>${r.createdAt}</td>
        <td style="text-align: center;">
          <label class="switch">
            <input type="checkbox" ${r.active ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
      </tr>
    `).join('');
  }

  // 3.3 Fan topshiriqlari (Rasm 3.3)
  const tasksTbody = document.getElementById('subjectTasksTableBody');
  if (tasksTbody && data.subjectTasks) {
    tasksTbody.innerHTML = data.subjectTasks.map(tk => `
      <tr>
        <td>${tk.id}</td>
        <td><span style="color: #0073b7;">${tk.subject}</span></td>
        <td>${tk.curriculum}</td>
        <td><span class="badge-pill-blue">${tk.group}</span></td>
        <td>${tk.type}</td>
        <td style="text-align: center;">${tk.count}</td>
        <td>${tk.semester}</td>
        <td>${tk.lang}</td>
      </tr>
    `).join('');
  }

  // 3.5 Kalendar reja (Rasm 3.5)
  const calTbody = document.getElementById('calendarPlansTableBody');
  if (calTbody && data.calendarPlans) {
    calTbody.innerHTML = data.calendarPlans.map(cp => `
      <tr>
        <td>${cp.id}</td>
        <td><span style="color: #0073b7;">${cp.subject}</span></td>
        <td>${cp.curriculum}</td>
        <td>${cp.group}</td>
        <td>${cp.type}</td>
        <td>${cp.semester}</td>
        <td style="text-align: center;">
          <button class="btn-hemis-primary" style="height: 26px; padding: 0 8px;" title="Yuklab olish">
            <i class="fa fa-download"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  // 3.6 Fan ma'lumotlari (Rasm 3.6)
  const infoTbody = document.getElementById('subjectInfoTableBody');
  if (infoTbody && data.subjectInfo) {
    infoTbody.innerHTML = data.subjectInfo.map(si => `
      <tr>
        <td>${si.id}</td>
        <td><span style="color: #0073b7;">${si.subject}</span></td>
        <td>${si.curriculum}</td>
        <td>${si.eduType}</td>
        <td>${si.semester}</td>
      </tr>
    `).join('');
  }

  // 4.1 Imtihonlar ro'yxati (Rasm 4.1)
  const examTbody = document.getElementById('examListTableBody');
  if (examTbody && data.exams) {
    examTbody.innerHTML = data.exams.map(e => `
      <tr>
        <td><strong style="color: #0073b7;">${e.title}</strong><br><small style="color: #777;">${e.note}</small></td>
        <td>${e.year}</td>
        <td>${e.groups}</td>
        <td style="text-align: center;">${e.questions}</td>
        <td>${e.start}</td>
        <td>${e.end}</td>
        <td>${e.duration}</td>
        <td style="text-align: center;"><label class="switch"><input type="checkbox" ${e.faceId ? 'checked' : ''}><span class="slider"></span></label></td>
        <td style="text-align: center;"><label class="switch"><input type="checkbox" ${e.active ? 'checked' : ''}><span class="slider"></span></label></td>
      </tr>
    `).join('');
  }

  // 7.1 Shaxsiy qaydnoma kiritish (Rasm 7.1)
  const gradeTbody = document.getElementById('gradeRecordsTableBody');
  if (gradeTbody && data.gradeRecords) {
    gradeTbody.innerHTML = data.gradeRecords.map(gr => `
      <tr>
        <td>${gr.id}</td>
        <td><span style="color: #0073b7;">${gr.orderNumber}</span></td>
        <td><strong>${gr.student.split('\n')[0]}</strong><br><small style="color: #777;">${gr.student.split('\n')[1] || ''}</small></td>
        <td>${gr.eduType.replace('\n', '<br>')}</td>
        <td>${gr.specialty.replace('\n', '<br>')}</td>
        <td><span style="color: #0073b7;">${gr.subject}</span></td>
        <td>${gr.semester.replace('\n', '<br>')}</td>
        <td>${gr.subjectType}</td>
        <td>${gr.workload}</td>
        <td>${gr.score}</td>
        <td>${gr.grade}</td>
        <td>${gr.teacher}</td>
        <td><span style="color: #dd4b39; font-weight: 700;">${gr.deadline}</span></td>
      </tr>
    `).join('');
  }

  // 14.1 Fayl menejer (Rasm 14.1)
  const fmTree = document.getElementById('fmTreeList');
  const fmGrid = document.getElementById('fmFolderGrid');
  if (fmTree && fmGrid && data.fileManagerFolders) {
    fmTree.innerHTML = data.fileManagerFolders.map(folder => `
      <div style="padding: 3px 0; cursor: pointer;"><i class="fa fa-folder" style="color: #70b8f4; margin-right: 5px;"></i> ${folder}</div>
    `).join('');

    fmGrid.innerHTML = data.fileManagerFolders.map(folder => `
      <div class="fm-folder-item" ondblclick="alert('Papka ochildi: ${folder}')">
        <i class="fa fa-folder fm-folder-icon"></i>
        <span class="fm-folder-name">${folder}</span>
      </div>
    `).join('');
  }
}

// ==========================================================================
// 4. SPA ROUTER (SAHIFALAR O'RTASIDA O'TISH)
// ==========================================================================
const pageTitles = {
  'dashboard': 'Bosh sahifa',
  'schedule': 'Dars jadvali',
  'attendance_journal': 'Davomat jurnali',
  'grade_journal': 'Baholash jurnali',
  'lesson_process': 'Dars o\'tish',
  'subject_topics': 'Fan mavzulari',
  'subject_resources': 'Fan resurslari',
  'subject_tasks': 'Fan topshiriqlari',
  'course_tasks': 'Kurs topshiriqlari',
  'calendar_plans': 'Kalendar reja',
  'subject_info': 'Fan ma\'lumotlari',
  'exam_list': 'Imtihonlar ro\'yxati',
  'grade_records': 'Shaxsiy qaydnoma kiritish',
  'statistics': 'Statistika dashboardi',
  'file_manager': 'Fayl menejer',
  'my_messages': 'Mening xabarlarim',
  'create_message': 'Xabar yaratish',
  'profile': 'Mening profilim',
  'sign_docs': 'Hujjatni imzolash',
  'work_plan': 'Shaxsiy ish reja',
  'ind_students': 'Fan talabalari',
  'ind_schedule': 'Yakka dars jadvali',
  'ind_attendance': 'Yakka dars davomat',
  'retake_lessons': 'Q.o\'qish mashg\'ulotlari',
  'retake_midterm': 'Oraliq baholash',
  'retake_final': 'Yakuniy baholash',
  'retake_other': 'Boshqa baholash',
  'retake_students': 'O\'qituvchi talabalari',
  'grade_requests': 'Baholash so\'rovlari',
  'control_midterm': 'Oraliq nazorat',
  'control_final': 'Yakuniy nazorat',
  'control_other': 'Boshqa nazoratlar',
  'methodological_pubs': 'Uslubiy nashrlar',
  'scientific_pubs': 'Ilmiy nashrlar',
  'intellectual_prop': 'Intellektual mulklar',
  'scientific_activity': 'Ilmiy faollik',
  'my_feedback': 'Mening fikrim',
  'global_surveys': 'Global so\'rovnoma'
};

function navigateTo(pageId) {
  document.querySelectorAll('.page-view').forEach(view => {
    view.style.display = 'none';
  });

  document.querySelectorAll('.sidebar-subitem').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`page-${pageId}`);
  if (targetView) {
    targetView.style.display = 'block';
  } else {
    const genericView = document.getElementById('page-generic');
    genericView.style.display = 'block';
  }

  const activeSubitem = document.querySelector(`.sidebar-subitem[data-page="${pageId}"]`);
  if (activeSubitem) {
    activeSubitem.classList.add('active');
    const parentTree = activeSubitem.closest('.sidebar-item');
    if (parentTree) {
      parentTree.classList.add('open');
      parentTree.classList.add('active');
      const sub = parentTree.querySelector('.sidebar-submenu');
      if (sub) sub.style.display = 'block';
    }
  } else {
    const activeItem = document.querySelector(`.sidebar-item[data-page="${pageId}"]`);
    if (activeItem) activeItem.classList.add('active');
  }

  const title = pageTitles[pageId] || pageId;
  document.getElementById('breadcrumbCurrentTitle').innerText = title;
  window.location.hash = pageId;
  window.scrollTo(0, 0);
}

// ==========================================================================
// 5. 8.2 BO'LIMIDAN DAVOMATNI SAQLASH (O'QITUVCHI SAQLAGACH SANA YASHIL BO'LADI)
// ==========================================================================
async function openAttendanceModal(lessonId) {
  currentActiveLessonId = lessonId;
  const overlay = document.getElementById('attendanceModalOverlay');
  
  let lesson = null;
  if (appData && appData.lessonsProcess) {
    lesson = appData.lessonsProcess.find(l => l.id == lessonId || l.lessonId === lessonId);
  }

  if (!lesson) {
    lesson = {
      id: lessonId,
      date: "05.11.2026",
      subject: "Operatsion tizimlar",
      group: "657-24 DIr",
      pair: "1. 08:00-09:20",
      isSaved: false
    };
  }

  document.getElementById('modalSubjectName').innerText = lesson.subject;
  document.getElementById('modalGroupName').innerText = lesson.group;
  document.getElementById('modalDateName').innerText = lesson.date;
  document.getElementById('modalTimeName').innerText = lesson.pair || lesson.time || "08:00 - 09:20";

  const statusBadge = document.getElementById('modalAttendanceStatusBadge');
  if (lesson.isSaved) {
    statusBadge.style.backgroundColor = '#d4edda';
    statusBadge.style.color = '#155724';
    statusBadge.style.border = '1px solid #c3e6cb';
    statusBadge.innerHTML = `<i class="fa fa-check-circle"></i> Davomat Saqlangan (Sanasi yashil)`;
  } else {
    statusBadge.style.backgroundColor = '#f8d7da';
    statusBadge.style.color = '#721c24';
    statusBadge.style.border = '1px solid #f5c6cb';
    statusBadge.innerHTML = `<i class="fa fa-exclamation-triangle"></i> Davomat Hali Saqlanmagan (Sanasi qizil)`;
  }

  await loadModalStudents(lesson.group);
  overlay.classList.add('active');
}

function closeAttendanceModal() {
  document.getElementById('attendanceModalOverlay').classList.remove('active');
}

async function loadModalStudents(group) {
  const tbody = document.getElementById('modalStudentsTableBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Yuklanmoqda...</td></tr>';

  try {
    const res = await fetch(`/api/students/${encodeURIComponent(group)}`);
    const data = await res.json();
    const students = data.students || [];

    document.getElementById('modalStudentsCount').innerText = students.length;

    tbody.innerHTML = students.map((s, idx) => `
      <tr data-student-id="${s.id}">
        <td>${idx + 1}</td>
        <td><code>${s.code}</code></td>
        <td><strong>${s.name}</strong></td>
        <td style="text-align: center;">
          <label style="margin-right: 12px; cursor: pointer; color: #00a65a; font-weight: 600;">
            <input type="radio" name="st_status_${s.id}" value="present" ${s.status === 'present' ? 'checked' : ''}> Bor
          </label>
          <label style="margin-right: 12px; cursor: pointer; color: #f39c12;">
            <input type="radio" name="st_status_${s.id}" value="absent_cause" ${s.status === 'absent_cause' ? 'checked' : ''}> Sababli
          </label>
          <label style="cursor: pointer; color: #dd4b39; font-weight: 600;">
            <input type="radio" name="st_status_${s.id}" value="absent_uncause" ${s.status === 'absent_uncause' ? 'checked' : ''}> Sababsiz
          </label>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Talabalar ro\'yxatini yuklab bo\'lmadi</td></tr>';
  }
}

function markAllStudents(status) {
  document.querySelectorAll('#modalStudentsTableBody input[value="' + status + '"]').forEach(radio => {
    radio.checked = true;
  });
}

// DAVOMATNI SAQLASH TUGMASI (O'qituvchi saqlaganida dars sanasi YASHIL ga aylanadi!)
async function submitAttendance() {
  if (!currentActiveLessonId) return;

  const rows = document.querySelectorAll('#modalStudentsTableBody tr');
  const studentsList = [];

  rows.forEach(row => {
    const id = row.getAttribute('data-student-id');
    const checked = row.querySelector('input[type="radio"]:checked');
    const status = checked ? checked.value : 'present';
    const code = row.querySelector('code') ? row.querySelector('code').innerText : '';
    const name = row.querySelector('strong') ? row.querySelector('strong').innerText : '';
    studentsList.push({ id, code, name, status });
  });

  try {
    const res = await fetch('/api/attendance/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: currentActiveLessonId,
        students: studentsList
      })
    });

    const result = await res.json();
    if (result.success) {
      alert("Davomat muvaffaqiyatli saqlandi!\n8.2 bo'limda dars sanasi YASHIL rangga o'tdi.");
      closeAttendanceModal();
      await loadAppData();
    }
  } catch (err) {
    alert('Davomatni saqlashda xatolik yuz berdi!');
  }
}

// Sinov uchun holatni almashtirish (Test qilish uchun)
async function toggleAttendanceStatus() {
  if (!currentActiveLessonId) return;

  try {
    const res = await fetch('/api/attendance/toggle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: currentActiveLessonId })
    });
    const result = await res.json();
    if (result.success) {
      alert(`Dars davomati holati o'zgartirildi: ${result.lesson.isSaved ? 'YASHIL (Saqlangan)' : 'QIZIL (Saqlanmagan)'}`);
      closeAttendanceModal();
      await loadAppData();
    }
  } catch (err) {
    alert('Xatolik yuz berdi');
  }
}
