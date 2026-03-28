Add-Type @'
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
'@
$keys = @{ 'MUTE'=0xAD; 'VOL_DOWN'=0xAE; 'VOL_UP'=0xAF; 'MEDIA_PLAY'=0xB3 }
foreach ($k in $keys.GetEnumerator()) {
  $state = [K]::GetAsyncKeyState($k.Value)
  $down = (($state -band 0x8000) -ne 0)
  Write-Output "$($k.Key) down=$down state=$state"
}
