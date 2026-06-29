@echo off
cls
echo ========================================
echo    DEMARRAGE PLATEFORME ISIMM
echo ========================================
echo.

echo [1/4] Demarrage Auth Service (port 8001)...
start "Auth Service" cmd /k "cd services\auth-service && python manage.py runserver 8001"

timeout /t 3 >nul

echo [2/4] Demarrage User Service (port 8002)...
start "User Service" cmd /k "cd services\user-service && python manage.py runserver 8002"

timeout /t 3 >nul

echo [3/4] Demarrage Candidature Service (port 8003)...
start "Candidature Service" cmd /k "cd services\candidature_service && python manage.py runserver 8003"

timeout /t 3 >nul

echo [4/4] Demarrage Frontend Angular (port 4200)...
start "Angular Frontend" cmd /k "cd frontend && ng serve"

echo.
echo ========================================
echo    TOUS LES SERVICES SONT DEMARRES
echo ========================================
echo.
echo URLs:
echo - Frontend:         http://localhost:4200
echo - Auth API:         http://localhost:8001
echo - User API:         http://localhost:8002
echo - Candidature API:  http://localhost:8003
echo.
echo Pour arreter les services, fermez les fenetres.
echo.
pause