# Check current count
Write-Output "=== count.json ==="
Get-Content "C:\aya-expo-tools\cv\output\counter\count.json"

# Check if new JSONL exists and has data
Write-Output "`n=== today JSONL ==="
$jsonl = "C:\aya-expo-tools\logs\cv\2026-03-26.jsonl"
if (Test-Path $jsonl) {
    $lines = Get-Content $jsonl
    Write-Output ("Lines: " + $lines.Count)
    if ($lines.Count -gt 0) {
        Write-Output ("First: " + $lines[0].Substring(0, [Math]::Min(100, $lines[0].Length)))
        Write-Output ("Last:  " + $lines[-1].Substring(0, [Math]::Min(200, $lines[-1].Length)))
    }
} else {
    Write-Output "JSONL not found"
}

# Check live sync data
Write-Output "`n=== live sync (publico endpoint) ==="
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/cv/status" -UseBasicParsing -ErrorAction SilentlyContinue
if ($r) { Write-Output $r.Content.Substring(0, [Math]::Min(400, $r.Content.Length)) }

Write-Output "`n=== detector output cam-1 ==="
Get-Content "C:\aya-expo-tools\cv\output\cam-1\detections.json" -ErrorAction SilentlyContinue |
    Select-Object -First 1
