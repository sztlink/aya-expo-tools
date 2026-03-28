# Check what API routes exist for server/resolume
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/status" -UseBasicParsing -ErrorAction SilentlyContinue
Write-Output ("status: " + $r.Content.Substring(0, [Math]::Min(300, $r.Content.Length)))

$r2 = Invoke-WebRequest -Uri "http://localhost:3000/api/sync" -UseBasicParsing -ErrorAction SilentlyContinue
Write-Output ("sync snippet: " + $r2.Content.Substring(0, [Math]::Min(500, $r2.Content.Length)))
