$paths = @(
    "C:\ffmpeg\bin\ffmpeg.exe",
    "C:\aya-expo-tools\ffmpeg\bin\ffmpeg.exe",
    "D:\ffmpeg\bin\ffmpeg.exe",
    "C:\ProgramData\chocolatey\bin\ffmpeg.exe",
    "C:\Users\AYA\AppData\Local\Microsoft\WinGet\Packages\ffmpeg.exe"
)
foreach ($p in $paths) {
    if (Test-Path $p) { Write-Output "FOUND: $p"; break }
}
$found = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($found) { Write-Output "PATH: $($found.Source)" }

# Also find Python venv
$py = "C:\aya-expo-tools\cv\venv\Scripts\python.exe"
if (Test-Path $py) { Write-Output "PYTHON: $py" }
