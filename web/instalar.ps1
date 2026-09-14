# Instalador de Winclus para Windows 10 y 11.
# Uso (en PowerShell):   irm https://winclus.com/instalar.ps1 | iex
# Para quitarlo:         irm https://winclus.com/instalar.ps1 | iex; Desinstalar-Winclus
#
# Descarga el ZIP oficial, lo descomprime en la carpeta de programas del usuario
# (no hace falta ser administrador), crea los accesos directos y abre Winclus.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version   = "0.1.0"
$ZipUrl    = "https://github.com/specteriatech/winclus/releases/latest/download/Winclus-Windows.zip"
$Destino   = Join-Path $env:LOCALAPPDATA "Programs\Winclus"
$Escritorio = [Environment]::GetFolderPath("Desktop")
$MenuInicio = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"

function Escribir($texto, $color = "Cyan") { Write-Host $texto -ForegroundColor $color }

function Crear-Acceso($ruta, $objetivo, $carpeta, $icono) {
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut($ruta)
    $lnk.TargetPath = $objetivo
    $lnk.WorkingDirectory = $carpeta
    $lnk.IconLocation = "$icono,0"
    $lnk.Description = "Winclus: mueve el puntero con la cabeza o los ojos"
    $lnk.Save()
}

function Desinstalar-Winclus {
    Escribir "Quitando Winclus..."
    Get-Process -Name Winclus -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    $perfiles = Join-Path $Destino "configs"
    if (Test-Path $perfiles) {
        $copia = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Winclus-perfiles"
        Copy-Item $perfiles $copia -Recurse -Force
        Escribir "Tus perfiles quedan guardados en: $copia" "Yellow"
    }
    Remove-Item $Destino -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $Escritorio "Winclus.lnk") -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $MenuInicio "Winclus.lnk") -Force -ErrorAction SilentlyContinue
    Escribir "Winclus se ha quitado del equipo." "Green"
}

function Instalar-Winclus {
    Escribir ""
    Escribir "  Winclus $Version - Tecnologia que incluye, un mundo que avanza" "Green"
    Escribir "  https://winclus.com"
    Escribir ""

    if ([Environment]::OSVersion.Version.Major -lt 10) {
        throw "Winclus necesita Windows 10 u 11."
    }
    if (-not [Environment]::Is64BitOperatingSystem) {
        throw "Winclus necesita Windows de 64 bits."
    }

    Get-Process -Name Winclus -ErrorAction SilentlyContinue | Stop-Process -Force

    $temporal = Join-Path $env:TEMP "Winclus-descarga"
    New-Item -ItemType Directory -Force $temporal | Out-Null
    $zip = Join-Path $temporal "Winclus-Windows.zip"

    Escribir "1/4  Descargando Winclus (unos 100 MB, puede tardar un par de minutos)..."
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest -Uri $ZipUrl -OutFile $zip -UseBasicParsing
    $ProgressPreference = "Continue"

    Escribir "2/4  Descomprimiendo..."
    $extraido = Join-Path $temporal "extraido"
    Remove-Item $extraido -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive -Path $zip -DestinationPath $extraido -Force
    $carpetaZip = Get-ChildItem $extraido -Directory | Where-Object { Test-Path (Join-Path $_.FullName "Winclus.exe") } | Select-Object -First 1
    if (-not $carpetaZip) { throw "El ZIP no contiene Winclus.exe." }

    Escribir "3/4  Instalando en $Destino ..."
    # Conservar los perfiles de una instalación anterior
    $perfilesViejos = Join-Path $Destino "configs"
    $copiaPerfiles = $null
    if (Test-Path $perfilesViejos) {
        $copiaPerfiles = Join-Path $temporal "configs-anteriores"
        Copy-Item $perfilesViejos $copiaPerfiles -Recurse -Force
    }
    Remove-Item $Destino -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force (Split-Path $Destino) | Out-Null
    Move-Item $carpetaZip.FullName $Destino
    if ($copiaPerfiles) { Copy-Item (Join-Path $copiaPerfiles "*") (Join-Path $Destino "configs") -Recurse -Force }
    Get-ChildItem $Destino -Recurse | Unblock-File -ErrorAction SilentlyContinue

    Escribir "4/4  Creando accesos directos..."
    $exe = Join-Path $Destino "Winclus.exe"
    $ico = Join-Path $Destino "assets\images\icono.ico"
    if (-not (Test-Path $ico)) { $ico = $exe }
    Crear-Acceso (Join-Path $Escritorio "Winclus.lnk") $exe $Destino $ico
    Crear-Acceso (Join-Path $MenuInicio "Winclus.lnk") $exe $Destino $ico

    Remove-Item $temporal -Recurse -Force -ErrorAction SilentlyContinue

    Escribir ""
    Escribir "Listo. Winclus esta instalado y tienes un acceso directo en el escritorio." "Green"
    Escribir "Ponte frente a la camara, pulsa Activar y parpadea para hacer clic."
    Escribir "Para quitarlo:  irm https://winclus.com/instalar.ps1 | iex; Desinstalar-Winclus" "DarkGray"
    Escribir ""
    Start-Process -FilePath $exe -WorkingDirectory $Destino
}

# Al ejecutarse con "irm ... | iex" se instala directamente; la función
# Desinstalar-Winclus queda definida para poder llamarla después.
if ($MyInvocation.InvocationName -ne "Desinstalar-Winclus") {
    Instalar-Winclus
}
