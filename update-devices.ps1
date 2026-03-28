$configPath = "C:\aya-expo-tools\config\beleza-astral.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Atualizar cam-4: .204 (nunca funcionou) -> .200 (nova camera Ihon)
$cam4 = $config.cameras | Where-Object { $_.id -eq "cam-4" }
$cam4.ip = "192.168.0.200"
$cam4.mac = "98:2A:0A:82:0A:9E"
$cam4.notes = "Instalada por Ihon em 20/03/2026"
Write-Output "cam-4: atualizada para 192.168.0.200"

# Adicionar plug-7 e plug-8
$plug7 = [PSCustomObject]@{
    id = "plug-7"
    name = "Smart Plug 7"
    ip = "192.168.0.126"
    mac = "D8:D6:68:E4:C7:31"
    model = "NovaDigital"
    controls = ""
}
$plug8 = [PSCustomObject]@{
    id = "plug-8"
    name = "Smart Plug 8"
    ip = "192.168.0.184"
    mac = "D8:D6:68:E4:BC:D9"
    model = "NovaDigital"
    controls = ""
}
$config.smartplugs += $plug7
$config.smartplugs += $plug8
Write-Output "plug-7: 192.168.0.126 adicionado"
Write-Output "plug-8: 192.168.0.184 adicionado"

# Salvar sem BOM
$content = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $content, $utf8NoBom)
Write-Output "Config salvo."

# Verificar
$verify = Get-Content $configPath -Raw | ConvertFrom-Json
$c4 = $verify.cameras | Where-Object { $_.id -eq "cam-4" }
Write-Output "Verificacao cam-4: $($c4.ip)"
Write-Output "Total smart plugs: $($verify.smartplugs.Count)"
