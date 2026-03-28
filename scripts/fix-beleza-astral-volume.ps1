$path = 'C:\Users\AYA\Documents\Resolume Arena\Compositions\BelezaAstral.avc'
$bak = $path + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item $path $bak -Force
$content = Get-Content $path -Raw
$content = $content.Replace('value="-192">' + "`r`n" + "`t`t`t`t`t" + '<PhaseSourceStatic name="PhaseSourceStatic" phase="0"/>', 'value="0">' + "`r`n" + "`t`t`t`t`t" + '<PhaseSourceStatic name="PhaseSourceStatic" phase="1"/>')
$content = $content.Replace('value="-2.8929823996598619986e-15">' + "`r`n" + "`t`t`t`t`t" + '<PhaseSourceStatic name="PhaseSourceStatic" phase="0.50118723362727224391"/>', 'value="0">' + "`r`n" + "`t`t`t`t`t" + '<PhaseSourceStatic name="PhaseSourceStatic" phase="1"/>')
Set-Content $path $content -Encoding UTF8
Write-Output ('BACKUP=' + $bak)
Get-Content $path | Select-String -Pattern 'Volume' | ForEach-Object { $_.Line.Trim() }