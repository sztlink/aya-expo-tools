# Dossie Tecnico — Beleza Astral

**Exposicao:** Samuel de Saboia — Introducao ao Infinito
**Local:** Farol Santander, 22o andar, Sao Paulo
**Periodo:** 27/03/2026 a 31/05/2026
**Horario:** 08h30 - 20h30 (ter-dom)
**Artista:** Samuel de Saboia
**Producao:** AYA Studio

---

## 1. Planta e fluxo

```
[Porta unica entrada/saida — 22o andar Farol Santander]
  |
  v
[Corredor + Salao em L — 12 quadros]              cam-2 (zona: corredor + entrada)
  |
  v (vao)
[Sala Imersiva — projecao 360]                     cam-1 (end A) + cam-3 (end B)
  |
  v (vao)
[Sala dos Fundos / Galeria]                        cam-4 (zona: galeria)
```

**Fluxo de visitantes:** entrada -> corredor -> sala imersiva -> galeria -> retorno pelo mesmo caminho.

---

## 2. Media Server

| Item | Detalhe |
|------|---------|
| Placa-mae | Gigabyte Z270X-Gaming 7 |
| CPU | Intel i7-7700K @ 4.20GHz (4C/8T) |
| RAM | 16GB DDR4 |
| GPU 0 | NVIDIA GTX 1080 Ti 11GB — Resolume Arena (display) |
| GPU 1 | NVIDIA GTX 1080 Ti 11GB — CV Pipeline (YOLO + ByteTrack + ReID) |
| Drive C | 233GB SSD (OS + aya-expo-tools) |
| Drive D | 1.86TB HDD (timelapse, logs, frames) |
| OS | Windows 11 |
| Software | Resolume Arena, aya-expo-tools, MSI Afterburner |
| Rede | Ethernet local 192.168.0.10, WireGuard 10.253.0.11 |
| Hostname | AYA-BelezaAstral |
| Operacao termica | 3fps CV, Afterburner fan 60-70%, GPU 0: 60C, GPU 1: 52C |

### Saidas de video

```
GPU 0 (GTX 1080 Ti) — Resolume Arena
  |-- DisplayPort -> HDMI -> Matriz 4K #1 (2x2) -> proj-1, proj-2, proj-3, proj-4
  |-- DisplayPort -> HDMI -> Matriz 4K #2 (2x2) -> proj-5, proj-6
  `-- HDMI -> Monitor de controle (desktop)

GPU 1 (GTX 1080 Ti) — CV (sem saida de video)
```

### Matrizes de video

| # | Modelo | Tipo | Entrada | Saidas | Uso |
|---|--------|------|---------|--------|-----|
| 1 | Video Wall Controller 2x2 4K (generico) | HDMI matrix | 1x HDMI (via DP->HDMI do GPU 0) | 4x HDMI | proj-1 a proj-4 |
| 2 | Video Wall Controller 2x2 4K (generico) | HDMI matrix | 1x HDMI (via DP->HDMI do GPU 0) | 2x HDMI | proj-5 e proj-6 |

---

## 3. Projecao

| ID | Modelo | IP | Protocolo | Uso |
|----|--------|-----|-----------|-----|
| proj-1 | NEC PE456USL | 192.168.0.101 | PJLink | Sala Imersiva |
| proj-2 | NEC PE456USL | 192.168.0.102 | PJLink | Sala Imersiva |
| proj-3 | NEC PE456USL | 192.168.0.103 | PJLink | Sala Imersiva |
| proj-4 | NEC PE456USL | 192.168.0.104 | PJLink | Sala Imersiva |
| proj-5 | NEC PE456USL | 192.168.0.105 | PJLink | Sala Imersiva |
| proj-6 | NEC PE456USL | 192.168.0.106 | PJLink | Sala Imersiva |

**Total:** 6 projetores NEC PE456USL para projecao imersiva 360.
**Controle:** PJLink Class 1, porta 4352. Liga/desliga via schedule ou Portal.

---

## 4. TVs

| ID | Modelo | IP | MAC | Controle | Conteudo |
|----|--------|-----|-----|----------|----------|
| tv-1 | Hisense 55A51HUA | 192.168.0.202 | C4:08:26:9A:E7:EB | Google Cast + WoL | Samuel_4K_entrevista_h264 |
| tv-2 | Hisense 55A51HUA | 192.168.0.201 | C4:08:26:9A:E8:88 | Google Cast + WoL | Samuel_4K_estudio |

**Smart Plugs:** cada TV controlada por plug Tuya (plug-tv1, plug-tv2).
**Loop:** video servido pelo aya-expo-tools em loop 12h via Cast.

---

## 5. Cameras (CFTV + CV)

| ID | Modelo | IP | Local | Zona CV |
|----|--------|-----|-------|---------|
| cam-1 | Intelbras iMD 3C Black | 192.168.0.107 | Sala Imersiva (extremidade A) | sala-imersiva |
| cam-2 | Intelbras iMD 3C Black | 192.168.0.108 | Corredor + Salao L | corredor + entrada |
| cam-3 | Intelbras iMD 3C Black | 192.168.0.181 | Sala Imersiva (extremidade B) | sala-imersiva |
| cam-4 | Intelbras iMD 3C Black | 192.168.0.200 | Sala dos Fundos / Galeria | galeria |

**Resolucao:** 1920x1080 (16:9) via RTSP main stream.
**cam-1 e cam-3:** pontos de vista opostos da mesma sala — ReID com threshold 0.75 (mais permissivo).
**cam-2:** camera do counter (line crossing para entradas/saidas), dois poligonos de zona.

---

## 6. Audio

| Item | Modelo | Qtd | Nota |
|------|--------|-----|------|
| Amplificador | Frahm (modelo a confirmar) | 1 | Amplificacao central |
| Caixas passivas | Yamaha (2x kits 5.1 combinados) | 8 | Distribuidas pelo espaco |
| Subwoofer | JBL SW8A-MS Slim Sub 8pol 200W RMS | 1 | Graves — sala imersiva |
| Splitter | P2 (3.5mm) | 1 | Saida do media server -> amplificador |

**Sinal:** saida analogica P2 do media server -> splitter -> amplificador Frahm -> 8 caixas Yamaha + sub JBL.
**Controle:** volume via Windows (nao ha interface de audio dedicada).
**Caixas:** originalmente 2 kits Yamaha 5.1 — combinados para cobrir o espaco.

---

## 7. Rede

| Equipamento | Modelo | IP | MAC | Funcao |
|-------------|--------|-----|-----|--------|
| Roteador/AP | TP-Link Archer AX1500 (Wi-Fi 6) | 192.168.0.1 | 3C:6A:D2:5E:0D:50 | Gateway + WiFi + DHCP |
| Switch | TP-Link (pequeno, nao gerenciavel) | — | — | Concentra cameras + projetores |
| Media Server | Gigabyte Z270X | 192.168.0.10 | — | Server principal |
| WireGuard peer | — | 10.253.0.11 | — | Tunel para AYA Studio |

**Subnet:** 192.168.0.0/24
**Internet:** via rede do Farol Santander (nao controlada pela AYA)
**WireGuard:** conecta ao Unraid AYA Studio (10.253.0.1) para Portal sync

### Mapa de IPs

| IP | Equipamento | MAC |
|----|-------------|-----|
| 192.168.0.1 | TP-Link Archer AX1500 | 3C:6A:D2:5E:0D:50 |
| 192.168.0.10 | Media Server | — |
| 192.168.0.101 | NEC PE456USL proj-1 | 14:50:51:AD:B4:16 |
| 192.168.0.102 | NEC PE456USL proj-2 | 14:50:51:AD:8F:2E |
| 192.168.0.103 | NEC PE456USL proj-3 | 14:50:51:AD:6A:58 |
| 192.168.0.104 | NEC PE456USL proj-4 | 14:50:51:AD:6A:55 |
| 192.168.0.105 | NEC PE456USL proj-5 | 14:50:51:AD:7C:24 |
| 192.168.0.106 | NEC PE456USL proj-6 | 8C:52:19:44:9F:B3 |
| 192.168.0.107 | Intelbras iMD 3C cam-1 | 80:85:44:6C:68:C6 |
| 192.168.0.108 | Intelbras iMD 3C cam-2 | 98:2A:0A:82:0A:C5 |
| 192.168.0.181 | Intelbras iMD 3C cam-3 | 98:2A:0A:82:0A:8B |
| 192.168.0.200 | Intelbras iMD 3C cam-4 | (via DHCP) |
| 192.168.0.201 | Hisense 55A51HUA tv-2 | C4:08:26:9A:E8:88 |
| 192.168.0.202 | Hisense 55A51HUA tv-1 | C4:08:26:9A:E7:EB |

---

## 8. Cabeamento

### Video
| Qtd | Tipo | Marca/Modelo | De | Para | Comprimento |
|-----|------|--------------|----|------|-------------|
| 2 | DisplayPort -> HDMI (adaptador ou cabo) | — | GPU 0 | Matrizes 4K #1 e #2 | curto |
| 6 | HDMI AOC (fibra optica) | Ugreen | Matrizes 4K | Projetores NEC | ~30m cada |
| 1 | HDMI | — | GPU 0 | Monitor de controle | curto |

**Nota:** cabos HDMI AOC Ugreen de 30m escolhidos por disponibilidade. Fibra optica necessaria nesse comprimento.

### Audio
| Qtd | Tipo | De | Para |
|-----|------|----|------|
| 1 | P2 (3.5mm) | Saida audio media server | Splitter P2 |
| 1 | Splitter P2 | Splitter | Amplificador Frahm |
| 8 | Cabo de caixa | Amplificador Frahm | 8x Yamaha passivas |
| 1 | Cabo de caixa/RCA | Amplificador Frahm | Sub JBL SW8A-MS |

### Rede
| Qtd | Tipo | De | Para |
|-----|------|----|------|
| 1 | Ethernet Cat5e | TP-Link AX1500 | Media Server |
| 4 | Ethernet Cat5e | Switch TP-Link | Cameras Intelbras |
| 6 | Ethernet Cat5e | Switch TP-Link | Projetores NEC (PJLink) |
| 1 | Ethernet (uplink) | TP-Link AX1500 | Switch TP-Link |

**Switch:** TP-Link (modelo pequeno, nao gerenciavel) — concentra cameras + projetores.

### Energia
| Qtd | Tipo | Alimenta |
|-----|------|----------|
| 2 | Smart Plug Tuya | TVs Hisense |
| 1 | Regua/filtro | Media Server + amplificador + matrizes |
| 6 | Tomada direta | Projetores NEC |

---

## 9. Energia / Smart Plugs

| ID | Nome | Controle | Protocolo |
|----|------|----------|-----------|
| plug-tv1 | Smart Plug TV-1 | TV-1 | Tuya Cloud |
| plug-tv2 | Smart Plug TV-2 | TV-2 | Tuya Cloud |

**Schedule automatico:** liga 08h30, desliga 20h30 (ter-dom).

---

## 10. CV Pipeline

| Componente | Configuracao |
|------------|-------------|
| Modelo | YOLOv8m (960px) |
| FPS | 3fps (interval=0.33s) |
| Tracker | ByteTrack gallery (track_buffer=90 = 30s) |
| ReID | OSNet-x0_25 Market-1501 (ONNX, 0.9MB, 4.6ms CPU) |
| Counter | Line crossing cam-2, 4fps |
| Staff filter | Teal HSV (H=75-115) + tempo > 180min |
| Timelapse | 1fps aberta / 1min fechada, circular buffer D: |
| Dados | JSONL/min + daily JSON + reid state |

---

## 11. Conexao com Portal AYA

| Item | Valor |
|------|-------|
| URL Portal | http://10.253.0.1:3000 (via WireGuard) |
| Slug | beleza-astral |
| Push interval | 30s |
| Dados enviados | CV status, counter, reid, snapshots 16:9, heatmaps 4 cameras |
| Pagina Portal | /dashboard/expo/beleza-astral |

---

## 12. Operacao diaria

**Abertura (automatica 08h30):**
- Scheduler liga projetores (PJLink) + smart plugs (TVs)
- Resolume carrega composicao automaticamente (shell:startup)
- CV detectores iniciam a 3fps
- Timelapse entra em modo 1fps
- TVs recebem cast automatico dos videos

**Fechamento (automatico 20h30):**
- Scheduler desliga projetores + smart plugs
- CV continua (timelapse 1min para documentacao)
- Daily summary consolidado a meia-noite

**Restart mid-expo:**
```
node C:\aya-expo-tools\safe-restart.js
```
Preserva counter + reid. NUNCA usar Stop-Process direto.

**Se TVs pararem:**
```
schtasks /run /tn "AYA Expo Tools"    # reinicia servidor
curl -X POST http://localhost:3000/api/tv/all/cast   # relanca cast
```

---

## 13. Equipe no local

| Pessoa | Papel | Contato |
|--------|-------|---------|
| Leonardo Primo | Assistente de producao | No local durante expo |
| Monitores | 2-3 por turno (uniforme teal) | Detectados automaticamente pelo CV |

**Leonardo — segunda-feira:** transferir D:\aya-expo-data\timelapse para HD externo -> 4090 AYA Studio.
