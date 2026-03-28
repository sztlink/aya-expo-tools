$date='2026-03-20'
$from='144500'
$to='173956'
$root="D:\aya-expo-data\timelapse\$date"
'=== Count synced-ish range ==='
'cam first last count'
'--------------------'
'cam-1','cam-2','cam-3' | ForEach-Object {
  $cam=$_
  $files=Get-ChildItem "$root\$cam" -File -Filter *.jpg | Where-Object { $_.BaseName -ge $from -and $_.BaseName -le $to } | Sort-Object BaseName
  $first=if($files){$files[0].BaseName}else{''}
  $last=if($files){$files[-1].BaseName}else{''}
  Write-Output "$cam $first $last $($files.Count)"
}
