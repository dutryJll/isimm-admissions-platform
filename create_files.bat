@echo off
cls
echo ========================================
echo   CREATION FICHIERS NOTIFICATIONS
echo ========================================
echo.

cd services\candidature_service\candidature_app

echo [1/5] Creation de notifications.py...
type nul > notifications.py
echo      ✓ notifications.py cree

echo [2/5] Creation de signals.py...
type nul > signals.py
echo      ✓ signals.py cree

echo [3/5] Creation du dossier management...
if not exist management mkdir management
type nul > management\__init__.py
echo      ✓ management\__init__.py cree

echo [4/5] Creation du dossier commands...
if not exist management\commands mkdir management\commands
type nul > management\commands\__init__.py
echo      ✓ management\commands\__init__.py cree

echo [5/5] Creation de envoyer_rappels.py...
type nul > management\commands\envoyer_rappels.py
echo      ✓ management\commands\envoyer_rappels.py cree

echo.
echo ========================================
echo   TOUS LES FICHIERS SONT CREES !
echo ========================================
echo.

echo Structure creee:
echo candidature_app\
echo ├── notifications.py
echo ├── signals.py
echo └── management\
echo     ├── __init__.py
echo     └── commands\
echo         ├── __init__.py
echo         └── envoyer_rappels.py
echo.

cd ..\..\..\

echo Vous devez maintenant copier le contenu dans ces fichiers.
echo.
pause