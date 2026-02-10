@echo off
echo ========================================
echo FORCING VERCEL REDEPLOY
echo ========================================
echo.
echo This will create a new commit to trigger Vercel deployment
echo.
pause

cd /d "%~dp0"

echo.
echo Creating deployment trigger file...
echo # Force Vercel Redeploy > DEPLOY_TRIGGER.txt
echo Timestamp: %date% %time% >> DEPLOY_TRIGGER.txt
echo Commit: c7a203c with all latest features >> DEPLOY_TRIGGER.txt

echo.
echo Adding files to git...
git add .

echo.
echo Creating commit...
git commit -m "deploy: force vercel redeploy with all latest features"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo DONE!
echo ========================================
echo.
echo Now:
echo 1. Wait 3-5 minutes for Vercel to deploy
echo 2. Check Vercel dashboard for new deployment
echo 3. Open your Vercel URL in INCOGNITO mode
echo 4. Verify all features are working
echo.
echo If features still don't show:
echo - Clear your browser cache completely
echo - Try different browser
echo - Check Vercel build logs
echo.
pause
