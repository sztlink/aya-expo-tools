$countFile = "C:\aya-expo-tools\cv\output\counter\count.json"
$zero = '{"entries":0,"exits":0,"occupancy":0,"activeTrackers":0,"activeVisitors":0,"dwellTime":null,"hourly":{},"date":"2026-03-26","timestamp":"2026-03-26T13:00:00.000000+00:00"}'
[System.IO.File]::WriteAllText($countFile, $zero)
Write-Output ("count.json zeroed: " + [System.IO.File]::ReadAllText($countFile).Substring(0,30))

$jsonlFile = "C:\aya-expo-tools\logs\cv\2026-03-26.jsonl"
$archiveFile = "C:\aya-expo-tools\logs\cv\2026-03-26-montagem.jsonl"
if (Test-Path $jsonlFile) {
  [System.IO.File]::Copy($jsonlFile, $archiveFile, $true)
  [System.IO.File]::Delete($jsonlFile)
  Write-Output "JSONL archived and cleared"
} else {
  Write-Output "JSONL not found"
}

$dailyFile = "C:\aya-expo-tools\logs\cv\daily\2026-03-26.json"
if (Test-Path $dailyFile) {
  Remove-Item $dailyFile
  Write-Output "daily summary cleared"
}

Write-Output "DONE"
