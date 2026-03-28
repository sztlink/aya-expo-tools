$log = Get-Content "C:\aya-expo-tools\server.log" -Tail 50
$log | Where-Object { $_ -match "health|nvidia|smi|poll|Error|error|crash|exception" }
