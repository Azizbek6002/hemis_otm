/**
 * HEMIS OTM Database Store
 * Yangi taqdim etilgan 8.2 skrinshoti asosida 1:1 to'ldirilgan haqiqiy ma'lumotlar
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'store.json');

// Boshlang'ich 1 dan 56 gacha bo'lgan sentabr-oktabr darslari
const generateEarlierLessons = () => {
  const earlier = [];
  const subjects = [
    { name: "Algoritmlarni loyihalash", group: "657-24 DIr", sem: "5-semestr", type: "Ma'ruza", pair: "2. 09:30-10:50", room: "8A-117" },
    { name: "Algoritmlarni loyihalash", group: "657-24 DIr", sem: "5-semestr", type: "Amaliy", pair: "3. 11:00-12:20", room: "8A-206 (kompyuter xonasi)" },
    { name: "Chuqur o'qitish", group: "617-23 Klr", sem: "7-semestr", type: "Amaliy", pair: "5. 14:30-15:50", room: "7-207 (kompyuter xonasi)" },
    { name: "Chuqur o'qitish", group: "687-23 Klr at", sem: "7-semestr", type: "Amaliy", pair: "4. 13:00-14:20", room: "7-117 (kompyuter xonasi)" },
    { name: "Operatsion tizimlar", group: "657-24 DIr", sem: "5-semestr", type: "Amaliy", pair: "1. 08:00-09:20", room: "8A-205 (kompyuter xonasi)" }
  ];

  const dates = [
    "21.09.2026", "22.09.2026", "23.09.2026", "24.09.2026", "25.09.2026",
    "28.09.2026", "29.09.2026", "30.09.2026", "01.10.2026", "02.10.2026",
    "05.10.2026", "06.10.2026", "07.10.2026", "08.10.2026", "09.10.2026",
    "12.10.2026", "13.10.2026", "14.10.2026", "15.10.2026", "16.10.2026",
    "19.10.2026", "20.10.2026", "21.10.2026", "22.10.2026", "23.10.2026",
    "26.10.2026", "27.10.2026", "28.10.2026"
  ];

  let idCounter = 1;
  dates.forEach((d, idx) => {
    const s1 = subjects[idx % subjects.length];
    const s2 = subjects[(idx + 1) % subjects.length];
    earlier.push({
      id: idCounter++,
      year: "2026-2027",
      semester: s1.sem,
      group: s1.group,
      date: d,
      subject: s1.name,
      type: s1.type,
      pair: s1.pair,
      room: s1.room,
      teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA",
      isSaved: true
    });
    if (idCounter <= 56) {
      earlier.push({
        id: idCounter++,
        year: "2026-2027",
        semester: s2.sem,
        group: s2.group,
        date: d,
        subject: s2.name,
        type: s2.type,
        pair: s2.pair,
        room: s2.room,
        teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA",
        isSaved: true
      });
    }
  });

  return earlier.slice(0, 56);
};

// 8.2 Skrinshotidagi 57 dan 78 gacha bo'lgan ANIQ real qatorlar
const screenshotRows = [
  { id: 57, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "29.10.2026", subject: "Operatsion tizimlar", type: "Amaliy", pair: "2. 09:30-10:50", room: "8A-204 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },
  { id: 58, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "30.10.2026", subject: "Operatsion tizimlar", type: "Ma'ruza", pair: "3. 11:00-12:20", room: "8A-117", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },
  { id: 59, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "02.11.2026", subject: "Algoritmlarni loyihalash", type: "Ma'ruza", pair: "2. 09:30-10:50", room: "8A-117", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },
  { id: 60, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "02.11.2026", subject: "Algoritmlarni loyihalash", type: "Amaliy", pair: "3. 11:00-12:20", room: "8A-206 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },
  { id: 61, year: "2026-2027", semester: "7-semestr", group: "617-23 Klr", date: "02.11.2026", subject: "Chuqur o'qitish", type: "Amaliy", pair: "5. 14:30-15:50", room: "7-207 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },
  
  // 62: Skrinshotda QIZIL! (03.11.2026 darsi davomati saqlanmagan!)
  { id: 62, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "03.11.2026", subject: "Algoritmlarni loyihalash", type: "Amaliy", pair: "2. 09:30-10:50", room: "8A-207", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },

  { id: 63, year: "2026-2027", semester: "7-semestr", group: "687-23 Klr at", date: "03.11.2026", subject: "Chuqur o'qitish", type: "Amaliy", pair: "4. 13:00-14:20", room: "7-117 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },
  { id: 64, year: "2026-2027", semester: "7-semestr", group: "617-23 Klr", date: "03.11.2026", subject: "Chuqur o'qitish", type: "Ma'ruza", pair: "5. 14:30-15:50", room: "7-209", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },
  { id: 65, year: "2026-2027", semester: "7-semestr", group: "687-23 Klr at", date: "03.11.2026", subject: "Chuqur o'qitish", type: "Ma'ruza", pair: "5. 14:30-15:50", room: "7-209", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: true },

  // BUGUNGI KUN (05.11.2026):
  // O'qituvchi davomatni hali saqlamagan bo'lsa QIZIL, saqlagach YASHIL ga aylanadi!
  { id: 66, lessonId: "sch-8", year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "05.11.2026", subject: "Operatsion tizimlar", type: "Amaliy", pair: "1. 08:00-09:20", room: "8A-205 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 67, lessonId: "sch-9", year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "05.11.2026", subject: "Operatsion tizimlar", type: "Amaliy", pair: "2. 09:30-10:50", room: "8A-201 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },

  // KELGUSI DARSLAR (ENDI O'TILISHI KERAK BO'LGANLAR - BARCHASI QIZIL!):
  // 68: Ertangi dars (06.11.2026, Juma)
  { id: 68, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "06.11.2026", subject: "Operatsion tizimlar", type: "Ma'ruza", pair: "3. 11:00-12:20", room: "8A-117", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 69, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "09.11.2026", subject: "Algoritmlarni loyihalash", type: "Ma'ruza", pair: "2. 09:30-10:50", room: "8A-117", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 70, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "09.11.2026", subject: "Algoritmlarni loyihalash", type: "Amaliy", pair: "3. 11:00-12:20", room: "8A-212", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 71, year: "2026-2027", semester: "7-semestr", group: "617-23 Klr", date: "09.11.2026", subject: "Chuqur o'qitish", type: "Amaliy", pair: "5. 14:30-15:50", room: "7-207 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 72, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "10.11.2026", subject: "Algoritmlarni loyihalash", type: "Amaliy", pair: "2. 09:30-10:50", room: "8A-215 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 73, year: "2026-2027", semester: "7-semestr", group: "687-23 Klr at", date: "10.11.2026", subject: "Chuqur o'qitish", type: "Amaliy", pair: "4. 13:00-14:20", room: "7-117 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 74, year: "2026-2027", semester: "7-semestr", group: "617-23 Klr", date: "10.11.2026", subject: "Chuqur o'qitish", type: "Ma'ruza", pair: "5. 14:30-15:50", room: "7-209", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 75, year: "2026-2027", semester: "7-semestr", group: "687-23 Klr at", date: "10.11.2026", subject: "Chuqur o'qitish", type: "Ma'ruza", pair: "5. 14:30-15:50", room: "7-209", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 76, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "12.11.2026", subject: "Operatsion tizimlar", type: "Amaliy", pair: "1. 08:00-09:20", room: "8A-205 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 77, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "12.11.2026", subject: "Operatsion tizimlar", type: "Amaliy", pair: "2. 09:30-10:50", room: "8A-201 (kompyuter xonasi)", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false },
  { id: 78, year: "2026-2027", semester: "5-semestr", group: "657-24 DIr", date: "13.11.2026", subject: "Operatsion tizimlar", type: "Ma'ruza", pair: "3. 11:00-12:20", room: "8A-117", teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA", isSaved: false }
];

const allLessonsProcess = [...generateEarlierLessons(), ...screenshotRows];

const initialData = {
  // Telegram Bot va Admin konfiguratsiyasi
  botConfig: {
    token: "9028859067:AAFEIB5KwwuRtlVocmAVUBKEZQqmUVV5WgQ",
    adminId: "6601373862",
    superAdminName: "Abdunazarov Azizbek Soxibjonovich",
    cronTime: "0 20 * * *"
  },

  // Ro'yxatdan o'tgan o'qituvchilar (Admin qo'shadigan ro'yxat)
  registeredTeachers: [],

  // Universitet HEMIS o'qituvchilar rasmiy reyestri
  hemisTeachers: [
    {
      hemisId: "3921612001",
      teacherUid: "3921612001",
      fullName: "AKRAMOVA GULYORA ABDIXALIKOVNA",
      shortName: "AKRAMOVA G. A.",
      department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi",
      title: "Katta o'qituvchi",
      phone: "+998 90 123 45 67",
      email: "g.akramova@fstu.uz",
      specialty: "Axborot xavfsizligi, Algoritmlar"
    },
    {
      hemisId: "3921612002",
      teacherUid: "3921612002",
      fullName: "SOBIROV JAMSHID RUSTAMOVICH",
      shortName: "SOBIROV J. R.",
      department: "Dasturiy injiniring kafedrasi",
      title: "Dotsent",
      phone: "+998 90 234 56 78",
      email: "j.sobirov@fstu.uz",
      specialty: "Dasturiy injiniring, Ma'lumotlar bazasi"
    },
    {
      hemisId: "3921612003",
      teacherUid: "3921612003",
      fullName: "KARIMOV SARDOR ILHOMOVICH",
      shortName: "KARIMOV S. I.",
      department: "Axborot xavfsizligi kafedrasi",
      title: "Katta o'qituvchi",
      phone: "+998 93 345 67 89",
      email: "s.karimov@fstu.uz",
      specialty: "Kriptografiya, Kiberxavfsizlik"
    },
    {
      hemisId: "3921612004",
      teacherUid: "3921612004",
      fullName: "ERGASHEV TEMURBEK ANVAROVICH",
      shortName: "ERGASHEV T. A.",
      department: "Kompyuter tizimlari kafedrasi",
      title: "Assistent",
      phone: "+998 91 456 78 90",
      email: "t.ergashev@fstu.uz",
      specialty: "Operatsion tizimlar, Tarmoqlar"
    },
    {
      hemisId: "3921612005",
      teacherUid: "3921612005",
      fullName: "ABDULLAYEVA DILFUZA BAXTIYOROVNA",
      shortName: "ABDULLAYEVA D. B.",
      department: "Sun'iy intellekt kafedrasi",
      title: "Dotsent",
      phone: "+998 97 567 89 01",
      email: "d.abdullayeva@fstu.uz",
      specialty: "Machine Learning, Neyron tarmoqlari"
    }
  ],

  teacher: {
    id: 543,
    uid: "3921612001",
    login: "gulyora_akramova",
    fullName: "AKRAMOVA GULYORA ABDIXALIKOVNA",
    shortName: "AKRAMOVA G. A.",
    role: "O'qituvchi",
    title: "Katta o'qituvchi",
    department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi",
    birthDate: "02-03-1988",
    passport: "AB1234567",
    specialty: "Axborot xavfsizligi, Algoritmlar va sun'iy intellekt",
    academicTitle: "Unvonsiz -",
    academicDegree: "Darajasiz -",
    email: "g.akramova@fstu.uz",
    phone: "+998 90 123 45 67",
    employmentDate: "28.03.2025 16:05:57",
    positions: [
      { id: 1, department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", rate: "1,00 stavka", position: "Katta o'qituvchi", status: "Ishlamoqda" },
      { id: 2, department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", rate: "0,50 stavka", position: "Katta o'qituvchi", status: "Bo'shagan" }
    ]
  },
  systemInfo: {
    appVersion: "1.9.84",
    coreVersion: "2.0.41.1",
    uid: "3921612001"
  },
  currentDate: "05.11.2026",
  academicYear: "2026-2027",

  // 8.1 Haftalik dars jadvali
  weeklySchedule: [
    { id: "sch-1", dayOfWeek: 1, dayName: "Dushanba", time: "09:30 - 10:50", type: "Ma'ruza", subject: "Algoritmlarni loyihalash", group: "657-24 DIr", room: "8A-117" },
    { id: "sch-2", dayOfWeek: 1, dayName: "Dushanba", time: "11:00 - 12:20", type: "Amaliy", subject: "Algoritmlarni loyihalash", group: "657-24 DIr", room: "8A-206 (kompyuter xonasi)" },
    { id: "sch-3", dayOfWeek: 1, dayName: "Dushanba", time: "14:30 - 15:50", type: "Amaliy", subject: "Chuqur o'qitish", group: "617-23 Klr", room: "7-207 (kompyuter xonasi)" },
    { id: "sch-4", dayOfWeek: 2, dayName: "Seshanba", time: "09:30 - 10:50", type: "Amaliy", subject: "Algoritmlarni loyihalash", group: "657-24 DIr", room: "8A-207" },
    { id: "sch-5", dayOfWeek: 2, dayName: "Seshanba", time: "13:00 - 14:20", type: "Amaliy", subject: "Chuqur o'qitish", group: "687-23 Klr at", room: "7-117 (kompyuter xonasi)" },
    { id: "sch-6", dayOfWeek: 2, dayName: "Seshanba", time: "14:30 - 15:50", type: "Ma'ruza", subject: "Chuqur o'qitish", group: "617-23 Klr", room: "7-209" },
    { id: "sch-7", dayOfWeek: 2, dayName: "Seshanba", time: "14:30 - 15:50", type: "Ma'ruza", subject: "Chuqur o'qitish", group: "687-23 Klr at", room: "7-209" },
    { id: "sch-8", dayOfWeek: 4, dayName: "Payshanba", time: "08:00 - 09:20", type: "Amaliy", subject: "Operatsion tizimlar", group: "657-24 DIr", room: "8A-205 (kompyuter xonasi)" },
    { id: "sch-9", dayOfWeek: 4, dayName: "Payshanba", time: "09:30 - 10:50", type: "Amaliy", subject: "Operatsion tizimlar", group: "657-24 DIr", room: "8A-201 (kompyuter xonasi)" },
    { id: "sch-10", dayOfWeek: 5, dayName: "Juma", time: "11:00 - 12:20", type: "Ma'ruza", subject: "Operatsion tizimlar", group: "657-24 DIr", room: "8A-117" }
  ],

  // 8.2 Dars o'tish ro'yxati (1-78 darslar, skrinshotdagi qizil va yashil sanalar bilan)
  lessonsProcess: allLessonsProcess,

  // Talabalar ro'yxati (657-24 DIr guruhi uchun)
  students: {
    "657-24 DIr": [
      { id: "st-1", code: "392221101001", name: "ABDUVALIYEV SANJARBEK O'KTAM O'G'LI", status: "present" },
      { id: "st-2", code: "392221101002", name: "ALIMOVA DILFUZA BAXTIYOR QIZI", status: "present" },
      { id: "st-3", code: "392221101003", name: "AZIZOV SARDORBEK ILHOM O'G'LI", status: "present" },
      { id: "st-4", code: "392221101004", name: "BOZOROV JAVLON SHERALIYEVICH", status: "absent_cause" },
      { id: "st-5", code: "392221101005", name: "ERGAASHEV TEMURBEK ANVAR O'G'LI", status: "present" },
      { id: "st-6", code: "392221101006", name: "G'ANIYEV ASILBEK NODIR O'G'LI", status: "present" },
      { id: "st-7", code: "392221101007", name: "HAMIDOV BEHRUZ AKMAL O'G'LI", status: "absent_uncause" },
      { id: "st-8", code: "392221101008", name: "ISMOILOV DIYORBEK SHAVKAT O'G'LI", status: "present" },
      { id: "st-9", code: "392221101009", name: "JALOLOV BOBURSHOH MUXTOR O'G'LI", status: "present" },
      { id: "st-10", code: "392221101010", name: "KARIMOV JASUR RAVSHANOVICH", status: "present" },
      { id: "st-11", code: "392221101011", name: "MAXMUDOV OYBEK SOBIR O'G'LI", status: "present" },
      { id: "st-12", code: "392221101012", name: "NORMATOV ELDOR VALIJON O'G'LI", status: "present" },
      { id: "st-13", code: "392221101013", name: "ORIPOV MUHAMMADALI SHUXRAT O'G'LI", status: "present" },
      { id: "st-14", code: "392221101014", name: "PULATOV SHOHRUX BAXODIR O'G'LI", status: "present" },
      { id: "st-15", code: "392221101015", name: "QODIROV BEGZOD ALISHER O'G'LI", status: "present" },
      { id: "st-16", code: "392221101016", name: "RAHMATILLAYEV SHOHJAHON UTKIR O'G'LI", status: "absent_uncause" },
      { id: "st-17", code: "392221101017", name: "SAIDOV MUROD BAXROM O'G'LI", status: "present" },
      { id: "st-18", code: "392221101018", name: "TURSUNOV DONIYOR SHOKIR O'G'LI", status: "present" },
      { id: "st-19", code: "392221101019", name: "ULUG'BEKOV ABBOSBEK ALISHER O'G'LI", status: "present" },
      { id: "st-20", code: "392221101020", name: "VALIYEV DIYORBEK RUSTAM O'G'LI", status: "present" },
      { id: "st-21", code: "392221101021", name: "XOLIQOV SHAXBOZ BAXODIR O'G'LI", status: "present" },
      { id: "st-22", code: "392221101022", name: "YOQUBOV SARDORBEK ILXOM O'G'LI", status: "present" },
      { id: "st-23", code: "392221101023", name: "ZOKIROV BILOLIDDIN JAMSHID O'G'LI", status: "present" },
      { id: "st-24", code: "392221101024", name: "SHARIPOV JASURBEK OLIMJON O'G'LI", status: "present" }
    ],
    "617-23 Klr": [
      { id: "st-201", code: "392221102001", name: "AKRAMOV DOSTONBEK ALISHER O'G'LI", status: "present" },
      { id: "st-202", code: "392221102002", name: "BEKNAZAROV FIRDAVS SOBIR O'G'LI", status: "present" },
      { id: "st-203", code: "392221102003", name: "CHORIYEV SHOHRUH ADHAM O'G'LI", status: "present" }
    ],
    "687-23 Klr at": [
      { id: "st-301", code: "392221103001", name: "DAVRONOV ELMUROD JALOL O'G'LI", status: "present" },
      { id: "st-302", code: "392221103002", name: "FAYZIYEV SARVARBEK JAMSHID O'G'LI", status: "present" }
    ]
  },

  attendanceJournals: [
    { id: 1, group: "617-23 Klr", subject: "Chuqur o'qitish", type: "Ma'ruza", year: "2026-2027", semester: "7-semestr" },
    { id: 2, group: "617-23 Klr", subject: "Chuqur o'qitish", type: "Amaliy", year: "2026-2027", semester: "7-semestr" },
    { id: 3, group: "657-24 DIr", subject: "Algoritmlarni loyihalash", type: "Ma'ruza", year: "2026-2027", semester: "5-semestr" },
    { id: 4, group: "657-24 DIr", subject: "Algoritmlarni loyihalash", type: "Amaliy", year: "2026-2027", semester: "5-semestr" },
    { id: 5, group: "657-24 DIr", subject: "Operatsion tizimlar", type: "Ma'ruza", year: "2026-2027", semester: "5-semestr" },
    { id: 6, group: "657-24 DIr", subject: "Operatsion tizimlar", type: "Amaliy", year: "2026-2027", semester: "5-semestr" },
    { id: 7, group: "687-23 Klr at", subject: "Chuqur o'qitish", type: "Ma'ruza", year: "2026-2027", semester: "7-semestr" },
    { id: 8, group: "687-23 Klr at", subject: "Chuqur o'qitish", type: "Amaliy", year: "2026-2027", semester: "7-semestr" }
  ],

  subjectTopics: [
    { id: 1, subject: "Sun'iy intellekt asoslari", curriculum: "SI (2024-2025)-Kunduzgi", year: "2025-2026", semester: "4-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "36 / 36", practice: "36 / 36" },
    { id: 2, subject: "Ma'lumotlar tuzilmasi va algoritmlar", curriculum: "Kiberxavfsizlik injiniringi (2024-2025)-Kunduzgi", year: "2024-2025", semester: "2-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "30 / 30", practice: "18 / 18" },
    { id: 3, subject: "Ma'lumotlar tuzilmasi va algoritmlar", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", year: "2024-2025", semester: "2-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "30 / 30", practice: "18 / 18" },
    { id: 4, subject: "Algoritmlarni loyihalash", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", year: "2026-2027", semester: "5-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "30 / 30", practice: "42 / 42" },
    { id: 5, subject: "Operatsion tizimlar", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", year: "2026-2027", semester: "5-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "30 / 30", practice: "42 / 42" },
    { id: 6, subject: "Ma'lumotlar tuzilmasi va algoritmlar", curriculum: "Kompyuter injiniringi (2024-2025)-Kunduzgi", year: "2024-2025", semester: "2-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "30 / 30", practice: "18 / 18" },
    { id: 7, subject: "Sun'iy intellekt asoslari", curriculum: "Kompyuter injiniringi (2024-2025)-Kunduzgi", year: "2025-2026", semester: "4-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "36 / 36", practice: "36 / 36" },
    { id: 8, subject: "Sun'iy intellekt asoslari", curriculum: "TT (2024-2025)-Sirtqi", year: "2025-2026", semester: "4-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "12 / 12", practice: "6 / 6" },
    { id: 9, subject: "Algoritmlarni loyihalash", curriculum: "Dasturiy injiniring (2024-2025)-Masofaviy", year: "2026-2027", semester: "5-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "30 / 0", practice: "42 / 0", warning: true },
    { id: 10, subject: "Operatsion tizimlar", curriculum: "Dasturiy injiniring (2024-2025)-Masofaviy", year: "2026-2027", semester: "5-semestr", eduType: "Bakalavr", status: "Ochiq", department: "Kompyuter muhandisligi va sun'iy intellekt kafedrasi", lecture: "30 / 30", practice: "42 / 12", warning: true }
  ],

  subjectResources: [
    { id: 1, title: "Настройка прав доступа NTFS и общих сетевых ресурсов. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 20:51:49", active: true },
    { id: 2, title: "Управление учётными записями пользователей и группами. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 20:51:19", active: true },
    { id: 3, title: "Работа с системным реестром Windows: regedit, доступ к... Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 20:50:36", active: true },
    { id: 4, title: "Планировщик заданий Windows (Task Scheduler): создание и настройка... Rus", subject: "Operatsion tizimlar 5-semestr / Ma'ruza / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 20:49:04", active: true },
    { id: 5, title: "Управление службами Windows: services.msc, Get-Service, sc.exe. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 20:46:52", active: true },
    { id: 6, title: "Мониторинг производительности системы: Resource Monitor, Performance Monitor. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 0, createdAt: "03.11.2026 20:46:23", active: true },
    { id: 7, title: "Управление процессами: диспетчер задач, tasklist, taskkill, Get-Process. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 20:37:40", active: true },
    { id: 8, title: "Основы PowerShell: командлеты, конвейер, объекты. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 10:45:33", active: true },
    { id: 9, title: "Работа в командной строке Windows (cmd): основные команды. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 10:44:18", active: true },
    { id: 10, title: "Установка, настройка и первоначальная конфигурация Windows. Rus", subject: "Operatsion tizimlar 5-semestr / Amaliy / AKRAMOVA G. A.", files: 1, createdAt: "03.11.2026 10:43:52", active: true }
  ],

  subjectTasks: [
    { id: 1, subject: "Algoritmlarni loyihalash", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr", type: "Ma'ruza", count: 1, semester: "5-semestr 2026-2027", lang: "Rus" },
    { id: 2, subject: "Algoritmlarni loyihalash", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr", type: "Amaliy", count: 1, semester: "5-semestr 2026-2027", lang: "Rus" },
    { id: 3, subject: "Operatsion tizimlar", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr", type: "Ma'ruza", count: 1, semester: "5-semestr 2026-2027", lang: "Rus" },
    { id: 4, subject: "Operatsion tizimlar", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr", type: "Amaliy", count: 1, semester: "5-semestr 2026-2027", lang: "Rus" },
    { id: 5, subject: "Chuqur o'qitish", curriculum: "Kompyuter injiniringi (KI)(2023-2024)-Kunduzgi", group: "617-23 Klr", type: "Ma'ruza", count: 1, semester: "7-semestr 2026-2027", lang: "Rus" },
    { id: 6, subject: "Chuqur o'qitish", curriculum: "Kompyuter injiniringi (KI)(2023-2024)-Kunduzgi", group: "617-23 Klr", type: "Amaliy", count: 1, semester: "7-semestr 2026-2027", lang: "Rus" },
    { id: 7, subject: "Chuqur o'qitish", curriculum: "Kompyuter injiniringi (AT-S) (2023-2024)-Kunduzgi", group: "687-23 Klr at", type: "Ma'ruza", count: 1, semester: "7-semestr 2026-2027", lang: "Rus" },
    { id: 8, subject: "Chuqur o'qitish", curriculum: "Kompyuter injiniringi (AT-S) (2023-2024)-Kunduzgi", group: "687-23 Klr at", type: "Amaliy", count: 1, semester: "7-semestr 2026-2027", lang: "Rus" }
  ],

  calendarPlans: [
    { id: 1, subject: "Algoritmlarni loyihalash", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr Rus", type: "Ma'ruza AKRAMOVA G. A.", semester: "5-semestr 2026-2027", fileName: "Algoritmlar_maruza.pdf" },
    { id: 2, subject: "Algoritmlarni loyihalash", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr Rus", type: "Amaliy AKRAMOVA G. A.", semester: "5-semestr 2026-2027", fileName: "Algoritmlar_amaliy.pdf" },
    { id: 3, subject: "Operatsion tizimlar", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr Rus", type: "Ma'ruza AKRAMOVA G. A.", semester: "5-semestr 2026-2027", fileName: "OS_maruza.pdf" },
    { id: 4, subject: "Operatsion tizimlar", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi", group: "657-24 DIr Rus", type: "Amaliy AKRAMOVA G. A.", semester: "5-semestr 2026-2027", fileName: "OS_amaliy.pdf" },
    { id: 5, subject: "Chuqur o'qitish", curriculum: "Kompyuter injiniringi (KI)(2023-2024)-Kunduzgi", group: "617-23 Klr Rus", type: "Ma'ruza AKRAMOVA G. A.", semester: "7-semestr 2026-2027", fileName: "DL_KI_maruza.pdf" },
    { id: 6, subject: "Chuqur o'qitish", curriculum: "Kompyuter injiniringi (AT-S) (2023-2024)-Kunduzgi", group: "687-23 Klr at Rus", type: "Ma'ruza AKRAMOVA G. A.", semester: "7-semestr 2026-2027", fileName: "DL_ATS_maruza.pdf" }
  ],

  subjectInfo: [
    { id: 1, subject: "Algoritmlarni loyihalash", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi Telekommunikatsiya va kiberxavfsizlik fakulteti", eduType: "Bakalavr / Kunduzgi Kredit baholash tizimi", semester: "5-semestr 2026-2027" },
    { id: 2, subject: "Operatsion tizimlar", curriculum: "Dasturiy injiniring (2024-2025)-Kunduzgi Telekommunikatsiya va kiberxavfsizlik fakulteti", eduType: "Bakalavr / Kunduzgi Kredit baholash tizimi", semester: "5-semestr 2026-2027" },
    { id: 3, subject: "Chuqur o'qitish", curriculum: "Kompyuter injiniringi (KI)(2023-2024)-Kunduzgi Axborot texnologiyalari va sun'iy intellekt fakulteti", eduType: "Bakalavr / Kunduzgi Kredit baholash tizimi", semester: "7-semestr 2026-2027" }
  ],

  exams: [
    { id: 1, title: "Biomuhandislik va nanotexnologiya", note: "Biomuhandislik va nanotexnologiya / Yakuniy nazorat / AKRAMOVA G. A.", year: "2025-2026 10-semestr", groups: "S717-21 Klr, S718-21 Klr", questions: 50, start: "28.03.2026 11:40", end: "28.03.2026 13:00", duration: "80 daqiqa", faceId: false, active: true },
    { id: 2, title: "Bulutli platformalar", note: "Bulutli platformalar / Yakuniy nazorat / AKRAMOVA G. A.", year: "2025-2026 8-semestr", groups: "S2OT718-22 Klr", questions: 50, start: "24.06.2026 11:00", end: "24.06.2026 12:20", duration: "80 daqiqa", faceId: false, active: true }
  ],

  gradeRecords: [
    {
      id: 1,
      orderNumber: "farmoyish-27 21.02.2026",
      student: "ULUG'BEKOV ABBOSBEK ALISHER O'G'LI\n392221101055",
      eduType: "Bakalavr\nSirtqi (Ikkinchi oliy)",
      specialty: "60610501\nKompyuter injiniringi (KI) (2021-2022)-Sirtqi (2OT)",
      subject: "Geoaxborot texnologiyalari",
      semester: "9-semestr\n2025-2026",
      subjectType: "M",
      workload: "180 / 6.0",
      score: "68.00",
      grade: "3.00",
      teacher: "AKRAMOVA GULYORA ABDIXALIKOVNA",
      deadline: "6.4.2026",
      deadlinePassed: true
    }
  ],

  statistics: {
    bachelor: { male: 14245, female: 3737, total: 17982 },
    master: { male: 243, female: 234, total: 477 },
    totalStudents: 18459,
    paymentTypes: { grant: 189, contract: 15406, total: 15595 },
    byRegion: [
      { region: "Andijon viloyati", bachelor: 2200, master: 80 },
      { region: "Farg'ona viloyati", bachelor: 13600, master: 320 },
      { region: "Namangan viloyati", bachelor: 900, master: 30 }
    ],
    byAge: { under30: { male: 240, female: 210 }, over30: { male: 30, female: 25 } },
    byAccommodation: [
      { type: "O'z uyida", bachelor: 8200, master: 210 },
      { type: "Talabalar turar joyida", bachelor: 9200, master: 235 }
    ]
  },

  fileManagerFolders: [
    "БиБ", "ГИТ", "МАТ", "ОВ-КИ-ЗАОЧ", "ООВ", "СП", "ТОВ-22", "ТОВ-лекция-22",
    "ЭК-22", "ЭС", "AI заочно", "AL", "DL", "IOT", "OC", "OS", "OS-zaochno", "SI"
  ]
};

function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    saveDb(initialData);
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("DB o'qishda xatolik:", err);
    return initialData;
  }
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("DB saqlashda xatolik:", err);
    return false;
  }
}

saveDb(initialData);

module.exports = {
  getDb,
  saveDb,
  initialData
};
