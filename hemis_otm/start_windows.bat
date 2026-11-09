@echo off
chcp 65001 > nul
title HEMIS OTM va SuperAdmin Tizimi

echo ================================================================
echo 🎓 HEMIS OTM va SuperAdmin Davomat Tizimi Ishga Tushirilmoqda...
echo ================================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [XATOLIK] Kompyuteringizda Node.js o'rnatilmagan!
    echo Iltimos, https://nodejs.org saytidan Node.js ni yuklab oling va o'rnating.
    echo.
    pause
    exit /b
)

if not exist "node_modules\" (
    echo [MA'LUMOT] Kerakli paketlar o'rnatilmoqda (npm install)...
    call npm install
    echo.
)

echo ----------------------------------------------------------------
echo 🌐 O'qituvchilar kabineti: http://localhost:4000
echo 🛡️ SuperAdmin Paneli:     http://localhost:4000/admin
echo 🔑 API Bo'limi paroli:     6aa181JTI74s8r
echo 🤖 Telegram Bot:          @fstu_davomat_bot
echo ----------------------------------------------------------------
echo.

timeout /t 2 > nul
start "" "http://localhost:4000/admin"

node server.js

pause
