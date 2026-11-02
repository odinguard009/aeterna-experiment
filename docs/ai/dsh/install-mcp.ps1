# Installs the Lane K MCP servers for the DeepSeek harness under ~/.dsh/mcp. Idempotent; a failed step does not stop the rest.
# No secrets: the GitHub wrapper reads `gh auth token` at run time.
$ErrorActionPreference = 'Continue'
$mcp = Join-Path $env:USERPROFILE '.dsh\mcp'; New-Item -ItemType Directory -Force $mcp | Out-Null
function Step($name, [scriptblock]$b) { try { & $b; Write-Host "OK   $name" } catch { Write-Warning "FAIL $name : $_" } }

Step 'sequential-thinking' {
  $d = Join-Path $mcp 'node_seqthinking'; New-Item -ItemType Directory -Force $d | Out-Null
  Push-Location $d; npm install --no-audit --no-fund @modelcontextprotocol/server-sequential-thinking; Pop-Location
}
Step 'serena' {
  python -m venv (Join-Path $mcp 'venv-serena'); & (Join-Path $mcp 'venv-serena\Scripts\pip.exe') install -q serena-agent
}
Step 'basic-memory' {
  python -m venv (Join-Path $mcp 'venv-basic-memory'); & (Join-Path $mcp 'venv-basic-memory\Scripts\pip.exe') install -q basic-memory
}
Step 'github' {
  $g = Join-Path $mcp 'github'; New-Item -ItemType Directory -Force $g | Out-Null
  $rel = gh api repos/github/github-mcp-server/releases/latest --jq '.assets[] | select(.name | test("Windows_x86_64.zip$")) | .browser_download_url'
  $zip = Join-Path $g 'github-mcp-server.zip'; Invoke-WebRequest $rel -OutFile $zip; Expand-Archive $zip $g -Force
  $cmd = @(
    '@echo off',
    'setlocal',
    'for /f "usebackq delims=" %%t in (`gh auth token 2^>nul`) do set "GITHUB_PERSONAL_ACCESS_TOKEN=%%t"',
    '"%~dp0github-mcp-server.exe" stdio --toolsets repos,issues,pull_requests,actions'
  )
  Set-Content (Join-Path $g 'run-github-mcp.cmd') -Value $cmd -Encoding ascii
}
Step 'context7' { npm install -g @upstash/context7-mcp }

Write-Host "Done. Register the servers with docs/ai/dsh/cordis.mcp.template.yml and restart the harness."
