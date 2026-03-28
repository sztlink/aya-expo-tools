# Test nvidia-smi directly
$result = & nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>&1
Write-Output ("nvidia-smi result: " + $result)

# Test from the path that Node would use
$env:PATH += ";C:\Windows\System32"
$result2 = & "nvidia-smi" "--query-gpu=index,name" "--format=csv,noheader,nounits" 2>&1
Write-Output ("nvidia-smi2: " + $result2)
