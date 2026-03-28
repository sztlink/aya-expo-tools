$daily = "C:\aya-expo-tools\logs\cv\daily\2026-03-26.json"
$jsonl = "C:\aya-expo-tools\logs\cv\2026-03-26.jsonl"

Write-Output ("daily exists: " + (Test-Path $daily))
Write-Output ("jsonl exists: " + (Test-Path $jsonl))

if (Test-Path $daily) {
    Remove-Item $daily -Force
    Write-Output "daily deleted"
}
if (Test-Path $jsonl) {
    Move-Item $jsonl "C:\aya-expo-tools\logs\cv\2026-03-26-montagem.jsonl" -Force
    Write-Output "jsonl archived"
}

Write-Output "DONE"
