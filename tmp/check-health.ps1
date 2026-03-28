$r = Invoke-WebRequest -Uri "http://localhost:3000/api/server-health" -UseBasicParsing
Write-Output $r.Content
