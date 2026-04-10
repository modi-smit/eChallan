@echo off
echo ===================================================
echo 🚀 STARTING GOD eCHALLAN DEPLOYMENT...
echo ===================================================

echo.
echo [1/4] Staging files...
git add .

echo.
echo [2/4] Committing changes...
git commit -m "Automated deployment"

echo.
echo [3/4] Pushing to GitHub & Vercel...
git push origin main

echo.
echo [4/4] Updating Supabase Edge Functions...
call npx supabase functions deploy send-monthly-ledger --no-verify-jwt

echo.
echo ===================================================
echo ✅ DEPLOYMENT 100%% COMPLETE!
echo ===================================================
pause