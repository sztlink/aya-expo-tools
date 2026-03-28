$ping = Test-Connection -ComputerName 192.168.0.200 -Count 3 -ErrorAction SilentlyContinue
if ($ping) {
    Write-Output "ONLINE - latencia media: $(($ping | Measure-Object ResponseTime -Average).Average)ms"
} else {
    Write-Output "OFFLINE - sem resposta ao ping"
}
