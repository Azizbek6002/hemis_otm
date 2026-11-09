@echo off
chcp 65001 > nul
title HEMIS OTM va SuperAdmin Tizimi

echo ================================================================
echo 🎓 HEMIS OTM va SuperAdmin Davomat Tizimi Ishga Tushirilmoqda...
echo ================================================================
echo.

:: 1. Node.js o'rnatilganligini tekshirish
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [XATOLIK] Kompyuteringizda Node.js o'rnatilmagan!
    echo Iltimos, https://nodejs.org saytidan Node.js (LTS versiyasini) yuklab oling va o'rnating.
    echo O'rnatgach, ushbu faylni qaytadan ishga tushiring.
    echo.
    pause
    exit /b
)

:: 2. Kerakli paketlarni tekshirish va o'rnatish
if not exist "hemis_otm\node_modules\" (
    if not exist "node_modules\" (
        echo [MA'LUMOT] Kerakli paketlar yuklanmoqda, iltimos kuting...
        cd hemis_otm
        call npm install
        cd ..
        echo.
    )
)

echo [1/2] Server 4000-portda ishga tushmoqda...
echo [2/2] Brauzerda SuperAdmin paneli ochilmoqda...
echo.
echo ----------------------------------------------------------------
echo 🌐 O'qituvchilar kabineti: http://localhost:4000
echo 🛡️ SuperAdmin Paneli:     http://localhost:4000/admin
echo 🔑 API Bo'limi paroli:     6aa181JTI74s8r
echo 🤖 Telegram Bot:          @fstu_davomat_bot
echo ----------------------------------------------------------------
echo.

:: 3. Brauzerda avtomatik ochish
timeout /t 2 > nul
start "" "http://localhost:4000/admin"

:: 4. Serverni ishga tushirish
if exist "hemis_otm\server.js" (
    cd hemis_otm
    node server.js
) else (
    node server.js
)

pause
