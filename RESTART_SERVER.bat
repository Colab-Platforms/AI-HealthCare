@echo off
echo ========================================
echo Restarting Healthcare AI Server
echo ========================================
echo.

cd server

echo Stopping any running Node processes...
taskkill /F /IM node.exe 2>nul

echo.
echo Starting server...
echo.

start cmd /k "npm start"

echo.
echo ========================================
echo Server is starting in a new window
echo ========================================
echo.
echo Next steps:
echo 1. Wait for "Database connected" message
echo 2. Go to http://localhost:3000
echo 3. Navigate to Diet Plan page
echo 4. Click "Generate AI Diet Plan" button
echo.
pause
