# 🎓 HEMIS Davomat Monitoring & Telegram Ogohlantirish Tizimi (Super Admin)

Universitet (OTM) o'qituvchilari tomonidan HEMIS tizimida talabalar davomatini (bor/yo'q) to'liq va o'z vaqtida belgilanishini avtomatik nazorat qiluvchi va davomat olinmagan taqdirda o'qituvchilarga shaxsiy Telegram orqali ogohlantirish yuboruvchi dasturiy majmua.

---

## 🎯 Tizim qanday muammoni hal qiladi?
1. **O'qituvchilarning unutishi:** Darsdan so'ng o'qituvchilar ko'pincha guruh davomatini to'liq belgilashni unutib qoldirishadi yoki qisman belgilab ketishadi. OTM ma'muriyati esa o'z vaqtida olinmagan davomat uchun ularga **xayfsan / intizomiy jazo** beradi.
2. **Xabarsizlik:** O'qituvchi qaysi darsini to'liq tekshirib bo'lgani yoki yo'qligini eslay olmaydi.
3. **Avtomatik ogohlantirish:** Tizim bugungi dars jadvali bo'yicha har bir o'qituvchining davomat holatini tekshiradi. Agar davomat olinmagan (yoki chala olingan) bo'lsa, o'qituvchining Telegramiga aniq va qisqa ma'lumot (Fan, Guruh, Juftlik, Auditoriya, Holat) yuboriladi.
4. **Super Admin to'liq nazorati:** OTM rahbariyati (Super Admin) bitta ekranda kimga ogohlantirish borgani, ogohlantirishdan keyin o'qituvchi davomatni to'g'irlaganmi yoki hali ham qilinmaganmi — hammasini jonli kuzatib turadi.

---

## 📸 Dizayn (HEMIS UI asosida)
Foydalanuvchi taqdim etgan rasmlar asosida HEMIS tizimining o'zbekona dizayni to'liq takrorlangan:
- **Yuqori ko'k panel (HEMIS Blue):** `#1b75bb`, til tanlash, bildirishnoma qo'ng'irog'i (real vaqtda xavf soni bilan), Super Admin profili.
- **Chap qoramtir menyu (Dark Slate):** `#263238`, qulay navigatsiya, versiya va sana ko'rsatkichi.
- **Yashil asosiy banner:** Semestr ko'rsatkichlari va tezkor *"Hozir tekshirish & Xabar yuborish"* tugmasi.
- **Pastel doira ikonkali KPI kartalari:**
  - 📘 *Bugungi jami darslar*
  - 🟢 *Davomati to'liq olingan*
  - 🔴 *Davomati olinmagan / chala (Xavf ostida)*
  - 🟡 *Telegram ogohlantirish yuborilganlar*
  - 🎯 *Ogohlantirishdan so'ng to'g'irlaganlar*
  - 🚨 *Hali ham qilinmaganlar (Qat'iy nazoratda)*

---

## ⚡ Asosiy Imkoniyatlar
1. **Jonli Monitoring Jadvali:**
   - Har bir dars, o'qituvchi, guruh, fan, auditoriya, juftlik vaqti.
   - Statuslar: `🟢 To'liq (26/26)`, `🟡 Qisman (10/28)`, `🔴 Olinmagan (0/26)`.
   - Telegram holati: `💬 Yuborildi (10:15, 2-bor)`.
   - Natija: `🎯 To'g'irlandi` yoki `❌ Hali ham qilinmadi!`.
   - Harakat tugmalari: *Xabar yuborish*, *Davomatni to'ldirdi deb belgilash*, *Xabarni ko'rish*.

2. **Telegram Bot Integratsiyasi:**
   - Real Telegram Bot orqali to'g'ridan-to'g'ri o'qituvchining `chat_id` siga HTML formatdagi bildirishnoma yuboriladi.
   - Simulyatsiya rejimida ham, real rejimda ham xatoliksiz ishlaydi.
   - Admin o'z chat ID siga sinov xabarini 1 tugma bilan yuborib ko'rishi mumkin.

3. **HEMIS API Integratsiyasi (Ertangi real token uchun tayyor):**
   - Sozlamalar panelida `HEMIS API URL` va `HEMIS API Token` joyi tayyorlab qo'yilgan.
   - Token olingan zahoti uni joylab **"Sozlamalarni saqlash"** bosiladi — tizim avtomatik jonli HEMIS tizimidan ma'lumotlarni tortishga o'tadi.

4. **Avtomatik Rejalashtiruvchi (Cron Job):**
   - Har 15 daqiqada (yoki sozlangan oraliqda) avtomatik tekshiruv o'tkazib, o'qituvchilarga xabarnoma yuboradi.

5. **Super Admin Jonli Simulyatori (Demo):**
   - 1-qadam: Dars davomatini olinmagan qilish.
   - 2-qadam: Telegram ogohlantirishini yuborish.
   - 3-qadam: O'qituvchi to'g'irlaganini simulyatsiya qilish va statusning "To'g'irlandi"ga aylanishini ko'rish.

---

## 🚀 Ishga Tushirish

```bash
# 1. Loyiha papkasiga kiring
cd /home/azizbek/Desktop/Projects/hemis_uchun

# 2. Serverni ishga tushiring
npm start
```

Brauzerda oching:
👉 **http://localhost:3000**

---

## ⚙️ Sozlamalar va Ertangi API ulash
1. Brauzerda ochib, chap menyudan **"HEMIS API & Bot"** bo'limiga o'ting.
2. Ertaga HEMIS ma'murlaridan olingan API kalitni **HEMIS API Bearer Token** maydoniga kiriting.
3. BotFather'dan olingan bot tokenini **Telegram Bot Token** maydoniga kiriting.
4. **"HEMIS API ulanishini tekshirish"** tugmasini bosing va **"Sozlamalarni saqlash"** tugmasini bosing.
Tizim to'liq jonli ish rejimiga o'tadi!
