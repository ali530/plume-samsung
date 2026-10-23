@echo off
rem Plume for Samsung: build, sign and install on the TV.
rem Usage: double-click, or   install.bat S90CA 192.168.1.50
setlocal
cd /d "%~dp0"

set PROFILE=%~1
set TVIP=%~2
if "%PROFILE%"=="" set /p PROFILE=Certificate profile name (for example S90CA):
if "%TVIP%"=="" set /p TVIP=TV IP address (TV: Settings ^> General ^> Network ^> Network Status ^> IP Settings):

set TIZEN=C:\tizen-studio\tools\ide\bin\tizen.bat
set SDB=C:\tizen-studio\tools\sdb.exe
if not exist "%TIZEN%" set TIZEN=C:\tizen\tools\ide\bin\tizen.bat
if not exist "%SDB%" set SDB=C:\tizen\tools\sdb.exe
if not exist "%TIZEN%" (
  echo Tizen Studio was not found in C:\tizen-studio or C:\tizen. Edit the TIZEN and SDB lines at the top of this file.
  pause & exit /b 1
)

echo.
echo [1/4] Connecting to the TV at %TVIP% ...
"%SDB%" connect %TVIP%:26101
"%SDB%" devices | find "%TVIP%" >nul || (
  echo Could not reach the TV. Check that Developer Mode is on with this computer's IP, and that the TV was restarted.
  pause & exit /b 1
)

echo.
echo [2/4] Building and signing with profile %PROFILE% ...
if exist "Plume\Plume.wgt" del /q "Plume\Plume.wgt"
call "%TIZEN%" package -t wgt -s %PROFILE% -- "%~dp0Plume"
if not exist "Plume\Plume.wgt" (
  echo Signing failed. In Tizen Studio, open Certificate Manager and check the profile name and that it is Active.
  pause & exit /b 1
)

echo.
echo [3/4] Installing ...
call "%TIZEN%" install -n Plume.wgt -s %TVIP%:26101 -- "%~dp0Plume"

echo.
echo [4/4] Opening Plume on the TV ...
call "%TIZEN%" run -p PlumeTV001.Plume -s %TVIP%:26101

echo.
echo Done. On the TV: Home, highlight Plume, press Down, Move, and put it first.
pause
