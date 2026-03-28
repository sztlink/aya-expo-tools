$desktop = "C:\Users\AYA\Desktop"

$toDelete = @(
    "index.html",
    "index.js",
    "config.html",
    "shared.css",
    "snap-cam1.jpg",
    "snap-cam2.jpg",
    "snap-test.jpg",
    "tmp-debug-auth.js",
    "tmp-find-pass.js",
    "tmp-identify.js",
    "tmp-patch.ps1",
    "tmp-patch2.js",
    "tmp-scan-cams.js",
    "tmp-set-cam3.js",
    "tmp-set-pass.js",
    "Samuel_Trilha.v2_19.03.wav"
)

foreach ($f in $toDelete) {
    $path = Join-Path $desktop $f
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Output "Removido: $f"
    } else {
        Write-Output "Nao encontrado: $f"
    }
}

Write-Output ""
Write-Output "=== Desktop atual ==="
Get-ChildItem $desktop | ForEach-Object { Write-Output $_.Name }
