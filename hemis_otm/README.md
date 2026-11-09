# 🎓 HEMIS OTM va SuperAdmin Davomat Nazorati Tizimi

Universitet (OTM) o'qituvchilari tomonidan HEMIS tizimida talabalar davomatini (bor/yo'q) to'liq va o'z vaqtida belgilanishini avtomatik nazorat qiluvchi, o'qituvchilar kabineti (1:1 kloni), SuperAdmin monitoring paneli hamda Telegram ogohlantirish boti majmuasi.

---

## 📌 Asosiy Xususiyatlar va Tizim Manzillari

* 🎓 **O'qituvchi Kabineti (1:1 HEMIS Kloni):** [http://localhost:4000](http://localhost:4000)
  * Dars jadvali, 8.2 Dars o'tish ro'yxati, davomat jurnali, talabalar yo'qlamasi va baholash.
* 🛡️ **SuperAdmin Boshqaruv & Monitoring Paneli:** [http://localhost:4000/admin](http://localhost:4000/admin)
  * Real vaqtda barcha darslar va o'qituvchilar davomat holati, Telegram orqali ogohlantirishlar nazorati.
* 🤖 **Telegram Bot:** `@fstu_davomat_bot` (O'qituvchilarga avtomatik va shaxsiy ogohlantirish yuborish).
* 🔒 **API Integratsiyasi Bo'limi (Himoyalangan):**
  * Dasturchilar uchun maxsus xavfsizlik paroli: `6aa181JTI74s8r`
  * Noto'g'ri parol kiritilganda texnik ma'sul: **Turaqulov Ilhomjon** (`+998 95 755 22 18`)

---

## 💻 WINDOWS TIZIMIGA O'RNATISH VA ISHGA TUSHIRISH (BOSQICHMA-BOSQICH)

Ushbu loyihani Windows (Windows 10, Windows 11 yoki Windows Server) tizimida o'rnatish va ishga tushirish juda oson. Quyidagi 4 ta qadamni bajaring:

### 1-QADAM: Node.js ni o'rnatish
Agar kompyuteringizda Node.js o'rnatilmagan bo'lsa:
1. Rasmiy saytga kiring: [https://nodejs.org](https://nodejs.org)
2. **LTS** (tavsiya etilgan, masalan `v20.x` yoki `v22.x`) versiyasini yuklab oling (`.msi` fayl).
3. Yuklangan faylni ochib, barcha qadamlarda *"Next"* tugmasini bosib o'rnating.
4. Tekshirish uchun Windowsda **CMD (Buyruqlar qatori)** yoki **PowerShell** ni ochib yozing:
   ```cmd
   node -v
   npm -v
   ```
   *(Agar versiya raqami chiqsa, demak Node.js to'g'ri o'rnatilgan).*

---

### 2-QADAM: Loyihani yuklab olish
Loyihani 2 xil usulda yuklab olishingiz mumkin:

* **1-usul (Git orqali klonlash):**
  ```cmd
  git clone https://github.com/Azizbek6002/hemis_otm.git
  cd hemis_otm
  ```
* **2-usul (ZIP orqali):**
  GitHub sahifasidagi yashil **`<> Code`** tugmasini bosib, **`Download ZIP`** ni tanlang. Yuklangan arxivni istalgan papkaga chiqarib oling.

---

### 3-QADAM: Kerakli kutubxonalarni o'rnatish
Windows CMD yoki PowerShell oynasida loyiha papkasiga kiring va quyidagi buyruqni bering:

```cmd
npm install
```
*(Bu buyruq tizim ishlashi uchun kerak bo'lgan barcha paketlarni avtomatik o'rnatadi).*

---

### 4-QADAM: Tizimni ishga tushirish

Sizda **2 xil qulay yo'l** bor:

#### A) Eng oson yo'l (1 bosishda ishga tushirish):
Loyiha papkasidagi **`start_windows.bat`** fayli ustiga sichqonchani **2 marta bosing**.
* Skript o'zi avtomatik serverni 4000-portda yoqadi va brauzeringizda SuperAdmin panelini ochib beradi!

#### B) Buyruqlar qatori (CMD / PowerShell) orqali:
```cmd
npm start
```
yoki
```cmd
node server.js
```

---

## 🌐 Brauzerda Ishlatish

Server yoqilgach, brauzeringizni ochib quyidagi manzillarga kiring:

1. **SuperAdmin Monitoring Paneli:**  
   👉 **http://localhost:4000/admin**
2. **HEMIS OTM O'qituvchi Kabineti (1:1 klon):**  
   👉 **http://localhost:4000**

---

## 🔒 Dasturchilar uchun: "4. API Integratsiyasi" Bo'limi

SuperAdmin panelida (`/admin`) joylashgan **"4. API Integratsiyasi"** bo'limi xavfsizlik paroli bilan himoyalangan:

1. **Parol:** `6aa181JTI74s8r`
2. Parol to'g'ri kiritilganda bo'lim ochiladi va quyidagilarni o'zgartirish imkoniyati beriladi:
   * **HEMIS API URL:** masalan, `https://hemis.fstu.uz/rest/v1`
   * **HEMIS API Token:** Universitet beradigan Bearer token
   * **"Ulanishni Tekshirish"** tugmasi orqali universitet serveri bilan aloqani darhol sinab ko'rish mumkin.
3. Agar parol noto'g'ri kiritilsa, texnik ma'sul kontaktlari chiqadi:
   * **Texnik ma'sul:** Turaqulov Ilhomjon
   * **Telefon:** `+998 95 755 22 18`

---

## 🤖 Telegram Botni Sozlash (@fstu_davomat_bot)

* Bot manzili: **[@fstu_davomat_bot](https://t.me/fstu_davomat_bot)**
* O'qituvchilar botga kirib **/start** buyrug'ini berishadi va o'zlarining HEMIS ID sini yuborishadi.

---

## 👨‍💻 Texnik Yordam
* **SuperAdmin:** Abdunazarov Azizbek Soxibjonovich
* **Texnik Ma'sul:** Turaqulov Ilhomjon | 📞 +998 95 755 22 18
