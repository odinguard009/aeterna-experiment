@echo off
setlocal DisableDelayedExpansion
REM PreToolUse search and read coverage adapter installed by codebase-memory-mcp.
REM Fail-open: it never blocks or logs hook or prompt content.
set "BIN=C:/Users/guardino.fahmi.EMTEKGROUP/AppData/Local/Programs/codebase-memory-mcp/codebase-memory-mcp.exe"
if not exist "%BIN%" exit /b 0
"%BIN%" hook-augment 2>NUL
exit /b 0
