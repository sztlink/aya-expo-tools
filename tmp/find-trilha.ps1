Get-ChildItem -Path D:\ -Recurse -Include *.wav,*.mp3,*.aiff,*.flac -ErrorAction SilentlyContinue | Select-Object FullName, @{N='MB';E={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
