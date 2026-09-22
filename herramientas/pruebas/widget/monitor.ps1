# Programa Winclus Monitor para que corra solo cada día en Windows (Programador de tareas).
# Uso (PowerShell, en esta carpeta):  .\monitor.ps1 -Config .\monitor.json [-Hora 06:30]
# Antes, una vez: npm i  y  npx playwright install chromium
# Para quitarlo: schtasks /Delete /TN "Winclus Monitor" /F
param([string]$Config = ".\monitor.json", [string]$Hora = "06:30")
$node = (Get-Command node).Source
$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = (Resolve-Path $Config).Path
$orden = "`"$node`" `"$carpeta\monitor.js`" `"$cfg`""
schtasks /Create /TN "Winclus Monitor" /TR $orden /SC DAILY /ST $Hora /F | Out-Null
Write-Host "Tarea creada: Winclus Monitor, cada día a las $Hora. Panel en la carpeta 'monitor' junto a $cfg."
Write-Host "Para probarla ahora: schtasks /Run /TN `"Winclus Monitor`""
