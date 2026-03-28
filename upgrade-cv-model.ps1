$ErrorActionPreference = 'Stop'

Set-Location 'C:\aya-expo-tools\cv'

# 1) Garantir modelo yolov8m.pt (Ultralytics baixa automaticamente se não existir)
Write-Output 'STEP 1/4 — Ensuring yolov8m.pt exists...'
& 'C:\aya-expo-tools\cv\venv\Scripts\python.exe' -c "from ultralytics import YOLO; YOLO('yolov8m.pt'); print('MODEL_OK')"

# 2) Atualizar config
Write-Output 'STEP 2/4 — Updating config...'
$configPath = 'C:\aya-expo-tools\config\beleza-astral.json'
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.cv.model = 'yolov8m'
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8

# Remove BOM if added by PowerShell
$content = [System.IO.File]::ReadAllText($configPath)
if ($content.Length -gt 0 -and $content[0] -eq [char]0xFEFF) {
  $content = $content.Substring(1)
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $content, $utf8NoBom)

Write-Output 'CONFIG_OK'

# 3) Reiniciar server
Write-Output 'STEP 3/4 — Restarting expo server...'
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Set-Location 'C:\aya-expo-tools'
$proc = Start-Process -FilePath 'node' -ArgumentList 'server/index.js','--config=beleza-astral' -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 8
if ($proc.HasExited) {
  Write-Output "SERVER_EXITED:$($proc.ExitCode)"
  exit 1
}
Write-Output "SERVER_OK:$($proc.Id)"

# 4) Validar config + status
Write-Output 'STEP 4/4 — Validating...'
& 'C:\Program Files\nodejs\node.exe' -e "const c=JSON.parse(require('fs').readFileSync('C:/aya-expo-tools/config/beleza-astral.json','utf8')); console.log('MODEL='+c.cv.model)"
