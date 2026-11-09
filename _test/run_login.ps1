$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
# Perfil nuevo en cada ejecución: evita que un service worker cacheado
# sirva una versión antigua de js/views/login.js.
$perfil = Join-Path $env:TEMP ("chrome-login-" + (Get-Random))
$fallos = 0

function Prueba($url) {
  $dom = & $chrome --headless=new --disable-gpu --no-sandbox --user-data-dir=$perfil `
    --virtual-time-budget=15000 --enable-logging=stderr --v=1 --dump-dom $url 2>err.txt | Out-String
  $consola = (Get-Content err.txt -ErrorAction SilentlyContinue |
    Select-String -Pattern 'CONSOLE' | ForEach-Object { $_.Line }) -join "`n"
  Remove-Item err.txt -ErrorAction SilentlyContinue
  $m = [regex]::Match($dom, '<div id="resultado-prueba"[^>]*>([^<]*)</div>')
  @{ marca = $m.Groups[1].Value; consola = $consola }
}

# Ruido aceptable: el aviso de meta de Apple y el warn propio de login.js
function ConsolaSospechosa($c) {
  if (-not $c) { return $false }
  $limpio = $c -replace 'CONSOLE:\d+\]\s*"[^"]*apple-mobile-web-app[^"]*"', ''
  $limpio = $limpio -replace 'CONSOLE:\d+\]\s*"\[login\] Supabase devolvió:[^"]*"', ''
  $limpio = $limpio -replace 'CONSOLE:\d+\]\s*"Service worker no registrado[^"]*"', ''
  return ($limpio -match 'Uncaught|SyntaxError|TypeError|ReferenceError')
}

function Mostrar($titulo, $url, $esperado) {
  $r = Prueba $url
  Write-Host "== $titulo"
  if (ConsolaSospechosa($r.consola)) {
    Write-Host ("  CONSOLA: " + $r.consola) -ForegroundColor Yellow
    $script:fallos++
  }
  $txt = $r.marca -replace '&quot;','"' -replace '&amp;','&' -replace '&#39;',"'"
  if (-not $txt) { Write-Host "  SIN MARCA" -ForegroundColor Red; $script:fallos++; return }
  $o = $txt | ConvertFrom-Json
  if ($o.errores.Count) {
    Write-Host ("  ERRORES: " + ($o.errores -join ' | ')) -ForegroundColor Red
    $script:fallos++
  }
  foreach ($x in $o.resultados) {
    if ($null -eq $x) { Write-Host "  (nulo)" -ForegroundColor Yellow; continue }
    if ($x.sinFormulario) { Write-Host ("  " + [string]$x.entrada + ": ya no hay formulario (ya se entró)"); continue }
    $rpc = if ($x.rpc) { [string]$x.rpc.p_usuario } else { "-" }
    $ent = [string]$x.entrada
    $sin = [string]$x.signIn
    Write-Host ("  " + $ent.PadRight(18) + " rpc=" + $rpc.PadRight(12) +
      " signIn=" + $sin.PadRight(28) + " entro=" + $x.entro + " toast=" + $x.toastError)
  }
  # Comprobación de expectativas (solo se valida `entro`; el texto del
  # toast se muestra arriba para revisarlo a mano)
  foreach ($e in $esperado) {
    $ok = $false
    foreach ($x in $o.resultados) {
      if ($null -ne $x -and $x.entrada -eq $e.entrada -and $x.entro -eq $e.entro) { $ok = $true }
    }
    if ($ok) { Write-Host ("  OK   esperado: " + $e.entrada + " entro=" + $e.entro) -ForegroundColor Green }
    else { Write-Host ("  FALLO esperado: " + ($e | ConvertTo-Json -Compress)) -ForegroundColor Red; $script:fallos++ }
  }
}

$puerto = if ($args[0]) { $args[0] } else { 8771 }
$base = "http://127.0.0.1:$puerto"

Mostrar "Acceso por USUARIO" "$base/_test/login.html" @(
  @{ entrada = 'noexiste';     entro = $false },
  @{ entrada = 'lucia.v';      entro = $false },
  @{ entrada = 'carlos';       entro = $false },
  @{ entrada = 'DUENO';        entro = $true }
)

Mostrar "Acceso por EMAIL" "$base/_test/login.html?caso=email" @(
  @{ entrada = 'maria@gmail.com'; entro = $false },
  @{ entrada = 'maria@gmail.com'; entro = $true }
)

Write-Host ""
Write-Host "Fallos: $fallos"
exit $fallos
