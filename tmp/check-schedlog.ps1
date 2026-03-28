$code = Get-Content "C:\aya-expo-tools\cv\counter.py" -Raw
# Find the Schedule print
$idx = $code.IndexOf("Schedule:")
if ($idx -ge 0) {
    Write-Output $code.Substring([Math]::Max(0,$idx-50), 200)
}
# Find is_expo_open call in main
$idx2 = $code.IndexOf("schedule_cfg")
Write-Output "`n--- schedule_cfg usage ---"
Write-Output $code.Substring($idx2, 200)
