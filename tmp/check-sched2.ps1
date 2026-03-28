Get-Content "C:\aya-expo-tools\server.log" | Select-Object -Last 30 |
    Where-Object { $_ -match "Schedule|Warm|Counter|entry|entries" }
