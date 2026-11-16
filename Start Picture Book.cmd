@echo off
setlocal
cd /d "%~dp0"
title Philine's Picture Book
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.13 or newer, then try again.
  pause
  exit /b 1
)
node --env-file-if-exists=.env scripts/boot.mjs %*
if errorlevel 1 (
  echo.
  echo Startup failed. Read the message above.
  pause
  exit /b 1
)
