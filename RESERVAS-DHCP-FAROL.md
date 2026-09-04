# Reservas DHCP — Player 1 / Farol Santander (TP-Link AX12)

Configurar em http://192.168.0.1 -> DHCP -> Address Reservation.
Reservar cada dispositivo no IP atual (verificado por ARP em 2026-06-14).
Objetivo: parar o reembaralhamento de IP em reboot do roteador (causou a confusao da manobra de 14/06).

| Dispositivo | IP | MAC | Funcao |
|---|---|---|---|
| DRIFT-PC | 192.168.0.205 | B4:2E:99:A1:AA:1F | media server (obra DRIFT) |
| Projetor NEC PE456USL | 192.168.0.101 | 14:50:51:AD:B4:16 | projecao DRIFT (PJLink) |
| Camera 1 Intelbras iMD 3C | 192.168.0.107 | 80:85:44:6C:68:C6 | CV / Portal |
| Camera 3 Intelbras iMD 3C | 192.168.0.181 | 98:2A:0A:82:0A:8B | CV / Portal |
| Camera 4 Intelbras iMD 3C | 192.168.0.200 | 98:2A:0A:82:0A:9E | CV / Portal |
| RUSH-1 totem PC1 | 192.168.0.19 | 50:EB:F6:37:24:E1 | obra RUSH |
| RUSH-2 totem PC2 | 192.168.0.241 | 7C:10:C9:BB:F8:29 | obra RUSH |
| TRACE-1 Raspberry Pi 4 | 192.168.0.81 | E4:5F:01:DB:91:87 | kiosk TRACE |
| TRACE-2 Raspberry Pi 4 | 192.168.0.157 | 88:A2:9E:BD:C0:5A | kiosk TRACE |

Gateway: 192.168.0.1 (TP-Link, MAC 3C:6A:D2:5E:0D:50) - nao precisa reserva.
3a camera ainda nao instalada (cam-2): adicionar quando instalar.
