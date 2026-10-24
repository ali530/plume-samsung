@echo off
rem Plume for Samsung: build, sign and install on the TV. No questions:
rem   - certificate profile: S90CA (change PROFILE below if yours is named differently)
rem   - the TV: the one already connected in Tizen's Device Manager, else the address saved from last time (install.cfg)
rem Optional: install.bat 192.168.1.50   (use this TV address and remember it)
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set PROFILE=S90CA
set TVIP=%~1

set TIZEN=C:\tizen-studio\tools\ide\bin\tizen.bat
set SDB=C:\tizen-studio\tools\sdb.exe
if not exist "%TIZEN%" set TIZEN=C:\tizen\tools\ide\bin\tizen.bat
if not exist "%SDB%" set SDB=C:\tizen\tools\sdb.exe
if not exist "%TIZEN%" (
  echo Tizen Studio was not found in C:\tizen-studio or C:\tizen. Edit the TIZEN and SDB lines at the top of this file.
  pause & exit /b 1
)

rem the address saved last time
if "%TVIP%"=="" if exist install.cfg for /f "usebackq tokens=1,* delims==" %%a in ("install.cfg") do if /i "%%a"=="TVIP" set TVIP=%%b

echo.
echo [1/4] Finding the TV ...
"%SDB%" start-server >nul 2>&1
if not "%TVIP%"=="" "%SDB%" connect %TVIP%:26101 >nul 2>&1
rem a TV already connected (Device Manager): use it
set FOUND=
for /f "skip=1 tokens=1" %%d in ('call "%SDB%" devices') do (
  echo %%d | find ":26101" >nul && if "!FOUND!"=="" set FOUND=%%d
)
if "%FOUND%"=="" (
  rem not connected: look for a TV in Developer Mode on this network (it answers on port 26101)
  echo     Searching the home network for the TV ...
  for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)\.' -and $_.PrefixLength -ge 16 } | ForEach-Object { $_.IPAddress }; $c = @(); foreach ($ip in $ips) { $n = $ip.Substring(0, $ip.LastIndexOf('.') + 1); 1..254 | ForEach-Object { $t = New-Object Net.Sockets.TcpClient; $c += ,@($t, $t.BeginConnect($n + $_, 26101, $null, $null), ($n + $_)) } }; Start-Sleep -Milliseconds 1800; foreach ($x in $c) { if ($x[0].Connected) { $x[2] } ; $x[0].Close() }"`) do if "!FOUND!"=="" (
    "%SDB%" connect %%t:26101 >nul 2>&1
    set FOUND=%%t:26101
  )
)
if "%FOUND%"=="" (
  echo Couldn't find the TV. Check it's on, on the same network, and in Developer Mode with this computer's IP.
  echo Or run:  install.bat THE-TV-IP-ADDRESS
  pause & exit /b 1
)
for /f "tokens=1 delims=:" %%i in ("%FOUND%") do set TVIP=%%i
> install.cfg echo TVIP=%TVIP%
echo     TV at %TVIP%

echo.
echo [2/4] Building and signing with profile %PROFILE% ...
if exist "Plume\Plume.wgt" del /q "Plume\Plume.wgt"
call "%TIZEN%" package -t wgt -s %PROFILE% -- "%~dp0Plume"
if not exist "Plume\Plume.wgt" (
  echo Signing failed. In Tizen Studio, open Certificate Manager and check that the profile %PROFILE% exists and is Active.
  pause & exit /b 1
)

echo.
echo [3/4] Installing ...
call "%TIZEN%" install -n Plume.wgt -s %TVIP%:26101 -- "%~dp0Plume"

echo.
echo [4/4] Opening Plume on the TV ...
call "%TIZEN%" run -p PlumeTV001.Plume -s %TVIP%:26101

echo.
echo Done.
timeout /t 5 >nul
