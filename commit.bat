@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

title FactPay - Git Commit ^& Push Assistant

echo ======================================================
echo           FACTPAY - ASSISTANT GIT COMMIT ^& PUSH
echo ======================================================
echo.

:: 1. Verifier si Git est disponible
where git >nul 2>nul
if errorlevel 1 (
    echo [ERREUR] Git n'est pas installe ou pas accessible dans le PATH.
    echo.
    pause
    exit /b 1
)

:: 2. Obtenir la branche actuelle
for /f "tokens=*" %%i in ('git branch --show-current 2^>nul') do set "CURRENT_BRANCH=%%i"
if "%CURRENT_BRANCH%"=="" (
    echo [ERREUR] Impossible de detecter la branche Git courante.
    echo Assurez-vous d'executer ce script depuis le dossier du projet FactPay.
    echo.
    pause
    exit /b 1
)

echo Branche actuelle detectee : [%CURRENT_BRANCH%]
echo.

:: 3. Afficher les fichiers modifies
echo --- Fichiers modifies / ajoutes ---
git status -s
echo -----------------------------------
echo.

:: 4. Choix de la branche cible
:choose_branch
echo Choisis la branche cible :
echo   [1] staging  (pre-production / test) [Defaut]
echo   [2] main     (production)
echo   [3] Conserver la branche actuelle (%CURRENT_BRANCH%)
echo   [Q] Quitter
echo.

set "BRANCH_CHOICE=1"
set /p "BRANCH_CHOICE=Ton choix (1, 2, 3 ou Q) [1] : "

if /i "%BRANCH_CHOICE%"=="Q" goto cancel
if "%BRANCH_CHOICE%"=="1" (
    set "TARGET_BRANCH=staging"
) else if "%BRANCH_CHOICE%"=="2" (
    set "TARGET_BRANCH=main"
) else if "%BRANCH_CHOICE%"=="3" (
    set "TARGET_BRANCH=%CURRENT_BRANCH%"
) else (
    echo [!] Choix invalide, merci de taper 1, 2, 3 ou Q.
    echo.
    goto choose_branch
)

echo.
echo Branche retenue : [!TARGET_BRANCH!]

:: 5. Si la branche cible est differente de la branche actuelle
if /i not "!TARGET_BRANCH!"=="!CURRENT_BRANCH!" (
    echo.
    echo [ATTENTION] Tu es actuellement sur "!CURRENT_BRANCH!" et tu as choisi "!TARGET_BRANCH!".
    set "SWITCH_NOW=O"
    set /p "SWITCH_NOW=Souhaites-tu basculer sur !TARGET_BRANCH! maintenant ? (O/N) [O] : "
    if /i not "!SWITCH_NOW!"=="O" goto cancel
    
    echo Basculement vers !TARGET_BRANCH!...
    git checkout !TARGET_BRANCH!
    if errorlevel 1 (
        echo.
        echo [ERREUR] Impossible de basculer automatiquement sur %TARGET_BRANCH%.
        echo Tes modifications locales entrent probablement en conflit.
        echo Commite d'abord sur "%CURRENT_BRANCH%" ou nettoie tes changements.
        echo.
        pause
        exit /b 1
    )
    set "CURRENT_BRANCH=%TARGET_BRANCH%"
)

:: 6. Verifier s'il y a des modifications a commiter
set "HAS_CHANGES="
for /f "tokens=*" %%i in ('git status --porcelain 2^>nul') do set "HAS_CHANGES=1"

if not defined HAS_CHANGES (
    echo.
    echo [INFO] Aucune modification locale a commiter sur %TARGET_BRANCH%.
    set "JUST_PUSH=N"
    set /p "JUST_PUSH=Souhaites-tu quand meme envoyer les commits locaux vers origin/%TARGET_BRANCH% ? (O/N) [N] : "
    if /i not "!JUST_PUSH!"=="O" goto cancel
    goto do_push
)

:: 7. Demande du message de commit
:ask_message
echo.
set "COMMIT_MSG="
set /p "COMMIT_MSG=Message du commit : "

if "!COMMIT_MSG!"=="" (
    echo [!] Le message de commit ne peut pas etre vide.
    goto ask_message
)

:: 8. Confirmation finale
echo.
echo ======================================================
echo Recaptulatif avant execution :
echo   - Branche cible : %TARGET_BRANCH%
echo   - Message       : "!COMMIT_MSG!"
echo ======================================================
set "CONFIRM=O"
set /p "CONFIRM=Confirmer l'ajout, le commit et le push sur GitHub ? (O/N) [O] : "
if /i not "!CONFIRM!"=="O" goto cancel

:: 9. Execution Git
echo.
echo [1/3] Indexation de tous les fichiers (git add -A)...
git add -A
if errorlevel 1 (
    echo [ERREUR] Echec lors du git add.
    pause
    exit /b 1
)

echo [2/3] Enregistrement du commit...
git commit -m "!COMMIT_MSG!"
if errorlevel 1 (
    echo [ERREUR] Echec lors du git commit.
    pause
    exit /b 1
)

:do_push
echo [3/3] Envoi vers origin/!TARGET_BRANCH! (git push)...
git push origin !TARGET_BRANCH!
if errorlevel 1 (
    echo.
    echo [ERREUR] Le push vers origin/!TARGET_BRANCH! a echoue.
    echo Verifie ta connexion ou execute 'git pull origin !TARGET_BRANCH!' si distant a avance.
    pause
    exit /b 1
)

echo.
echo ======================================================
echo  [SUCCES] Code pousse avec succes sur origin/!TARGET_BRANCH! !
echo ======================================================

:: Si le push a ete fait sur staging, proposer directement de mettre en prod (main)
if /i "!TARGET_BRANCH!"=="staging" (
    echo.
    echo ------------------------------------------------------
    echo  DEPLOIEMENT EN PRODUCTION (MAIN)
    echo ------------------------------------------------------
    echo Ton code est maintenant a jour sur staging (preprod).
    set "DEPLOY_PROD=N"
    set /p "DEPLOY_PROD=Souhaites-tu egalement le mettre en prod sur main ? (O/N) [N] : "
    if /i not "!DEPLOY_PROD!"=="O" (
        echo.
        echo [INFO] Les modifications restent uniquement sur staging.
        goto end
    )

    echo.
    echo [1/4] Basculement vers la branche main...
    git checkout main
    if errorlevel 1 (
        echo [ERREUR] Impossible de basculer sur main.
        pause
        exit /b 1
    )

    echo [2/4] Recuperation des derniers changements distants de main...
    git pull origin main

    echo [3/4] Fusion de staging vers main...
    if not defined COMMIT_MSG set "COMMIT_MSG=Mise a jour depuis staging"
    git merge staging -m "Merge staging: !COMMIT_MSG!"
    if errorlevel 1 (
        echo.
        echo [ERREUR] Erreur ou conflit lors de la fusion vers main.
        echo Merci de verifier manuellement l'etat de votre depot Git.
        pause
        exit /b 1
    )

    echo [4/4] Envoi en production sur origin/main (git push)...
    git push origin main
    if errorlevel 1 (
        echo [ERREUR] Le push vers origin/main a echoue.
        pause
        exit /b 1
    )

    echo.
    echo ======================================================
    echo  [PROD OK] Deploiement sur main termine avec succes !
    echo ======================================================
    echo.
    echo Sur quel environnement souhaites-tu te positionner maintenant ?
    echo   [1] staging  (pre-production) [Defaut]
    echo   [2] main     (production)
    echo.
    set "FINAL_ENV=1"
    set /p "FINAL_ENV=Ton choix (1 ou 2) [1] : "

    if "!FINAL_ENV!"=="2" (
        echo.
        echo [OK] Tu restes sur la branche main (production).
    ) else (
        echo.
        echo Basculement vers la branche staging (pre-production)...
        git checkout staging
        if errorlevel 1 (
            echo [ERREUR] Impossible de basculer sur staging.
        ) else (
            echo [OK] Tu es maintenant sur la branche staging (pre-production).
        )
    )
)

goto end

:cancel
echo.
echo [ANNULATION] Operation annulee. Aucun commit ni push effectue.

:end
echo.
pause
