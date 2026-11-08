# 🎓 HEMIS OTM Axborot Tizimi (1:1 Haqiqiy Klon)

Ushbu platforma O'zbekiston Respublikasi Oliy Ta'lim Axborot Tizimi (**HEMIS OTM**) o'qituvchi shaxsiy kabinetining skrinshotlar asosida yaratilgan **1:1 to'liq kloni** hisoblanadi.

Loyiha o'qituvchilar uchun **Telegram bot** integratsiyasi bilan to'liq moslashtirilgan bo'lib, har kuni kechki soat 20:00 da bugungi darslar davomatining saqlangan/saqlanmagan holatini tekshiradi va ertangi darslar jadvalini xabarnoma sifatida taqdim etadi.

---

## 📸 Skrinshotlarga 1:1 Muvofiqlik
Sayt foydalanuvchi taqdim etgan barcha 22 ta skrinshot detallarini to'liq o'zida aks ettiradi:
1. **Top Navbar (Header):**
   - Moviy fon (`#2a7ca5`), "HEMIS OTM" brendi
   - 3 ta gorizontal oq chiziq (`fa-bars`) - sidebar menyuni yig'ish (collapse) va ochish
   - Til tanlash (`O‘zbekcha`), sariq yulduzcha (`fa-star`), yangilash belgisi
   - O'qituvchi surati va ma'lumoti: `AKRAMOVA G. A. / O'qituvchi` (bosilganda to'liq profil ochiladi)
2. **Chap Menyu (Sidebar - Slate Dark `#222d32`):**
   - Tepadagi `Tezkor menyu` qidiruv/select qutisi
   - 14 ta asosiy bo'lim va barcha ichki sahifalari:
     - 📁 `E-hujjatlar` -> Hujjatni imzolash
     - 👥 `Xodimlar` -> Shaxsiy ish reja
     - 📖 `Fanlar bazasi` -> Fan mavzulari, Fan resurslari, Fan topshiriqlari, Kurs topshiriqlari, Kalendar reja, Fan ma'lumotlari
     - 🎓 `O'quv jarayoni` -> Imtihonlar ro'yxati
     - 📋 `Yakka darslar` -> Fan talabalari, Yakka dars jadvali, Yakka dars davomat
     - 🔄 `Qayta o'qish` -> Q.o'qish mashg'ulotlari, Oraliq, Yakuniy, Boshqa baholash, O'qituvchi talabalari
     - ✓ `O'zlashtirish` -> Shaxsiy qaydnoma kiritish, Baholash so'rovlari
     - 📅 `Mashg'ulotlar` -> Dars jadvali, Dars o'tish, Davomat jurnali, Baholash jurnali
     - ⌛ `Nazoratlar` -> Oraliq, Yakuniy, Boshqa nazoratlar
     - 🔬 `Ilmiy faoliyat` -> Uslubiy nashrlar, Ilmiy nashrlar, Intellektual mulklar, Ilmiy faollik
     - 📊 `Statistika` -> Statistika dashboardi
     - 📑 `Hisobotlar` -> Mening fikrim, Global so'rovnoma
     - ✉ `Xabarlar` -> Mening xabarlarim, Xabar yaratish
     - ⚙ `Tizim` -> Fayl menejer (elFinder interfeysi)
   - 3 chiziq bosilganda sidebar 50px ga qisqaradi va faqat ikonalar qoladi (Rasm 22).
3. **Pastki Footer:**
   - `Dastur versiyasi 1.9.84 / Yadro 2.0.41.1 / UID: 543 / Sana 05.11.2026 HH:MM:SS` (jonli sekundlar bilan)
   - O'ng pastki burchakda ko'k onlayn chat tugmasi.

---

## 🤖 Telegram Bot Integratsiyasi (20:00 Bildirishnomasi)

Platforma Telegram bot uchun maxsus REST API ga ega:
- **API Endpoint:** `GET /api/bot/daily-notification`
- **Vazifasi:**
  1. Bugungi kunda (05.11.2026) o'qituvchining o'tgan darslarini tekshiradi:
     - Masalan: `Operatsion tizimlar` (657-24 DIr guruhi, 08:00 - 09:20 va 09:30 - 10:50)
     - Davomati saqlangan bo'lsa: `✅ Saqlangan`
     - Saqlanmagan bo'lsa: `⚠️ SAQLANMAGAN!` deb ogohlantiradi
  2. Ertangi kungi (06.11.2026, Juma) barcha darslar ro'yxatini shakllantiradi:
     - `11:00 - 12:20 | Ma'ruza` | Operatsion tizimlar | 657-24 DIr | Xona: 8A-117
  3. Bot uchun tayyor HTML formatidagi xabar matnini va pastki qismdagi **"🌐 HEMIS Saytiga O'tish"** inline tugmasi URL manzilini (`http://localhost:4000`) uzatadi.

---

## 🚀 Ishga Tushirish Yo'riqnomasi

```bash
cd /home/azizbek/Desktop/Projects/hemis_uchun/hemis_otm
npm install
node server.js
```

Brauzerda ochish: `http://localhost:4000`
