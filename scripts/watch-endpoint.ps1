function Get-DefaultEndpointGuid {
  (Get-ItemProperty 'HKCU:\Software\Microsoft\Multimedia\Audio' -Name DefaultEndpoint -ErrorAction SilentlyContinue).DefaultEndpoint
}
$g1 = Get-DefaultEndpointGuid
Write-Output "START endpoint=$g1"
for ($i=0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 200
  $g = Get-DefaultEndpointGuid
  if ($g -ne $g1) { Write-Output "CHANGED at ${i}: $g1 -> $g"; $g1 = $g }
}
Write-Output "END endpoint=$g1"