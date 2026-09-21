# Ventana nativa de Windows (Windows Forms) para probar el barrido de la aplicación: dos botones, una casilla y un
# campo, con nombres accesibles de verdad como los de cualquier programa. Cada acción se anota en el archivo que se
# pasa como argumento, para que la prueba sepa qué se pulsó. Uso: powershell -File ventana_barrido.ps1 <registro>
param([string]$registro)
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.Form
$f.Text = "Prueba del barrido Winclus"; $f.Width = 420; $f.Height = 260; $f.StartPosition = "Manual"; $f.Left = 200; $f.Top = 200; $f.TopMost = $true
function Anotar($t) { Add-Content -Path $registro -Value $t -Encoding UTF8 }
$b1 = New-Object System.Windows.Forms.Button; $b1.Text = "Guardar"; $b1.Left = 20; $b1.Top = 20; $b1.Width = 120; $b1.Height = 40
$b1.Add_Click({ Anotar "guardar" })
$b2 = New-Object System.Windows.Forms.Button; $b2.Text = "Salir"; $b2.Left = 200; $b2.Top = 20; $b2.Width = 120; $b2.Height = 40
$b2.Add_Click({ Anotar "salir" })
$c = New-Object System.Windows.Forms.CheckBox; $c.Text = "Recordarme"; $c.Left = 20; $c.Top = 90; $c.Width = 160
$c.Add_CheckedChanged({ Anotar ("marcada=" + $c.Checked) })
$t = New-Object System.Windows.Forms.TextBox; $t.Left = 20; $t.Top = 150; $t.Width = 200; $t.AccessibleName = "Tu nombre"
$t.Add_GotFocus({ Anotar "foco" })
$f.Controls.AddRange(@($b1, $b2, $c, $t))
Anotar "lista"
[System.Windows.Forms.Application]::Run($f)
