$base = "C:\aya-expo-tools\cv\output"
Get-ChildItem $base -Recurse -Include "heatmap.png","frame.jpg","heatmap_raw.npy" | 
  Select-Object @{N='File';E={$_.FullName}}, @{N='SizeKB';E={[math]::Round($_.Length/1KB,1)}} |
  Format-Table -AutoSize

Write-Output "---config publicName check---"
$cfg = Get-Content "C:\aya-expo-tools\config\beleza-astral.json" | ConvertFrom-Json
Write-Output ("publicName: " + $cfg.exhibition.publicName)
Write-Output ("city: " + $cfg.exhibition.city)
Write-Output ("name: " + $cfg.exhibition.name)
