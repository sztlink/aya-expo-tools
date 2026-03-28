# ◇ AYA Expo Tools

Sistema operacional de exposicoes AYA Studio.
Roda localmente no media server de cada montagem — **funciona 100% offline**.
Quando ha internet, conecta ao Portal AYA para controle e monitoramento remoto.

---

## Filosofia

**Local primeiro.** A expo nunca depende de internet para funcionar.
O `aya-expo-tools` e o sistema primario — roda no media server, controla equipamentos, coleta dados.
O Portal AYA e visibilidade e controle remoto — bonus quando ha conexao, nunca requisito.

---

## Arquitetura

```
aya-expo-tools (LOCAL — media server)
  |
  |-- server/              <- Node.js server (porta 3000)
  |   |-- index.js         <- Express app + rotas API
  |   |-- cv.js            <- CV Manager (spawna detectores + counter + reid)
  |   |-- cv-logger.js     <- Daily JSONL + consolidacao meia-noite
  |   |-- cv-report.js     <- Relatorio semanal/mensal
  |   |-- portal-sync.js   <- Push HTTP 30s para Portal AYA
  |   |-- timelapse.js     <- Captura adaptativa (1fps aberta / 1min fechada)
  |   |-- frame-capture.js <- [deprecated: substituido por timelapse adaptativo]
  |   |-- cameras.js       <- RTSP + HTTP snapshot (Intelbras)
  |   |-- pjlink.js        <- Controle de projetores
  |   |-- tv.js            <- TVs Hisense via Google Cast + WoL
  |   |-- scheduler.js     <- Liga/desliga automatico por horario
  |   |-- server-health.js <- GPU, CPU, RAM, disco, processos
  |   |-- tuya.js          <- Smart plugs
  |   |-- tuya.js          <- Smart plugs Tuya Cloud (projetores, som, iluminacao)
  |   `-- audio.js         <- Volume soundbar
  |
  |-- cv/                  <- Pipeline de visao computacional
  |   |-- detector.py      <- YOLOv8m + ByteTrack por camera (3fps)
  |   |-- counter.py       <- Contagem de fluxo (line crossing, cam-2)
  |   |-- reid.py          <- ReID cross-camera (OSNet-x0_25 Market-1501)
  |   |-- osnet_x0_25.onnx <- Modelo ReID (0.9MB, 4.6ms/inference CPU)
  |   |-- bytetrack-gallery.yaml <- Tracker customizado (track_buffer=90)
  |   |-- venv/            <- Python 3.11, torch 2.5.1+cu121, ultralytics, onnxruntime
  |   `-- output/          <- Estado vivo (detections.json, frame.jpg, heatmap.png por camera)
  |       |-- cam-1..4/    <- Deteccoes e frames por camera
  |       |-- counter/     <- count.json, count-preserved.json, fresh-start
  |       `-- reid/        <- state.json, reid-preserved.json
  |
  |-- config/              <- Configuracao por exposicao
  |   `-- beleza-astral.json
  |
  |-- logs/
  |   `-- cv/
  |       |-- YYYY-MM-DD.jsonl    <- Amostras por minuto (zona counts, counter, dwell)
  |       `-- daily/
  |           `-- YYYY-MM-DD.json <- Resumo diario (entries, zones, dwell, reid, peak)
  |
  |-- ui/                  <- Dashboards HTML locais (localhost:3000)
  |
  `-- D:\aya-expo-data\    <- Drive secundario
      |-- timelapse/       <- 1fps (expo aberta) / 1min (fechada), circular buffer
      |-- health-logs/     <- JSONL de saude (GPU, CPU, RAM) por dia
      `-- frames/          <- [reservado para captura dedicada]

Portal AYA (REMOTO — 10.253.0.1:3000 via WireGuard)
  |-- /dashboard/expo/beleza-astral   <- Status em tempo real
  |   |-- Cameras com feed 16:9      <- frame.jpg do detector (nao snapshot SD)
  |   |-- Heatmap por camera          <- Overlay por camera individual
  |   `-- PublicoCard                 <- 6 secoes de relatorio
  |       |-- Agora na sala + Entradas hoje
  |       |-- Visitantes unicos (ReID) + Permanencia real
  |       |-- Funil por zona (entrada -> corredor -> sala -> galeria)
  |       |-- Ocupacao + dwell por zona
  |       |-- Fluxo por hora
  |       |-- Tendencia dia a dia (7 dias)
  |       |-- Pico do dia (count + horario)
  |       `-- Qualidade do dado (fps, counter balance, ReID, staff filter)
  `-- SSE push a cada 30s (cv + reid + snapshots + heatmaps)
```

---

## CV Pipeline v2

```
Cameras RTSP (4x Intelbras iMD 3C, 1920x1080)
    |
    v
detector.py x4 (YOLOv8m, GPU 1, 3fps, bytetrack-gallery.yaml)
    |-- Deteccoes com trackId (ByteTrack intra-camera)
    |-- Classificacao por zona (point-in-polygon)
    |-- Heatmap acumulado por camera
    |-- Dwell time por zona (track-based)
    `-- frame.jpg + detections.json (a cada ~1s)
    |
    v
counter.py (cam-2, 4fps, line crossing)
    |-- Entradas / saidas por hora
    |-- Dwell time counter-based
    `-- count.json (a cada ~2.5s)
    |
    v
reid.py (OSNet-x0_25 Market-1501, CPU, polling 2s)
    |-- Extrai features 512-d de cada crop de pessoa
    |-- Match cross-camera: cam-1 <-> cam-3 (threshold 0.75, mesma sala)
    |-- Match cross-zona: threshold 0.82
    |-- Staff filter: teal uniform HSV + presenca > 3h
    |-- Visitantes unicos / dia (deduplicados, sem staff)
    |-- Dwell real (soma segmentos mesmo com interrupcoes)
    `-- state.json (a cada 2s)
```

### Zonas

| Zona | Cameras | Estrategia |
|------|---------|-----------|
| entrada | cam-2 | single |
| corredor | cam-2 | single |
| sala-imersiva | cam-1 + cam-3 | max (angulos opostos) |
| galeria | cam-4 | single |

**Fluxo fisico:** entrada (cam-2) -> corredor (cam-2) -> sala imersiva (cam-1/cam-3) -> galeria (cam-4)

### Configuracao termica

| FPS | GPU 0 (Resolume) | GPU 1 (CV) | Fan |
|-----|------------------|-----------|-----|
| 1fps | 66C | 59C | auto 35% |
| 3fps (producao) | 60C | 52C | user 61% |
| 6fps (testado) | 70C | 54C | user 70% |

**MSI Afterburner:** fan curve user-defined obrigatorio em producao.
Sem Afterburner, 1fps ja atingia 66C com fans em auto.

### Timelapse adaptativo

Modulo unico que substitui captura separada:
- **Expo aberta** (schedule): 1fps — serve como dado para validacao e documentacao
- **Expo fechada**: 1 frame/min — documentacao visual leve
- **Circular buffer**: quando D: < 100GB livres, deleta dia mais antigo
- **Monday pickup**: log automatico para Leonardo transferir via HD externo para 4090

### Staff filter

Monitores da exposicao (uniforme teal) sao detectados e excluidos:
- **Cor HSV**: H=75-115 (teal/cyan), area >= 10% do crop, 3 confirmacoes
- **Tempo**: presenca > 180 minutos = staff automatico
- `uniqueVisitors` e `avgDwellSeconds` excluem staff
- `staffCount` disponivel separadamente para monitoramento

### Safe restart

Para reiniciar durante horario de expo sem perder dados:
```
node C:\aya-expo-tools\safe-restart.js
```
Preserva counter (entries/exits) e reid state antes de matar processos.
Task Scheduler reinicia automaticamente. Counter restaura do preserved.

**NUNCA usar Stop-Process direto durante expo** — perde acumulado do dia.

---

## API

### Status geral
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/health` | Status de todos os modulos |
| GET | `/api/server/health` | GPU, CPU, RAM, disco, processos |

### Projetores (PJLink)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/projectors` | Lista projetores |
| POST | `/api/projectors/all/on` | Liga todos |
| POST | `/api/projectors/all/off` | Desliga todos |
| POST | `/api/projectors/:id/on` | Liga um |
| POST | `/api/projectors/:id/off` | Desliga um |

### Cameras
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/cameras` | Lista cameras |
| GET | `/api/cameras/:id/snapshot` | JPEG snapshot |

### TVs (Google Cast)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/tv` | Lista TVs |
| POST | `/api/tv/all/cast` | Cast video em todas |
| POST | `/api/tv/all/stop` | Para cast |
| POST | `/api/tv/:id/cast` | Cast individual |

### CV — Visao computacional
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/cv/status` | Status completo (cameras, zonas, counter, dwell) |
| POST | `/api/cv/start` | Inicia detectores |
| POST | `/api/cv/stop` | Para detectores |

### ReID — Visitantes unicos
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/reid` | Estado completo (active, visitors, staff) |
| GET | `/api/reid/today` | Resumo do dia (uniqueVisitors, staffCount, dwell) |

### Smart Plugs (Tuya Cloud)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/plugs` | Lista plugs e status (on/off) |
| POST | `/api/plugs/all/on` | Liga todas |
| POST | `/api/plugs/all/off` | Desliga todas |
| POST | `/api/plugs/:id/on` | Liga uma |
| POST | `/api/plugs/:id/off` | Desliga uma |
| POST | `/api/plugs/:id/toggle` | Alterna estado |

### Schedule
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/schedule` | Horarios de abertura/fechamento |
| POST | `/api/schedule` | Atualiza horarios |

---

## Logs e dados

### Diarios (cv-logger)
```
logs/cv/2026-03-28.jsonl        <- 1 amostra/min (zonas, counter, dwell)
logs/cv/daily/2026-03-28.json   <- Resumo consolidado a meia-noite
```

O daily JSON inclui:
- `counter`: entries, exits, hourly breakdown
- `zones`: occupancyRate, minutesOccupied por zona
- `dwell`: avgSeconds, maxSeconds por zona
- `peak`: count + horario
- `reid`: uniqueVisitors, completedVisits, avgDwellSeconds (quando disponivel)

### Health (server-health)
```
D:\aya-expo-data\health-logs\2026-03-28.jsonl   <- 1 amostra/30s (GPU, CPU, RAM)
```

### Timelapse
```
D:\aya-expo-data\timelapse\2026-03-28\cam-1\HHMMSS.jpg
```

---

## Utilitarios

| Script | Uso |
|--------|-----|
| `safe-restart.js` | Restart sem perder dados (preserva counter + reid) |
| `set-interval.js <s>` | Muda FPS do detector (ex: `0.33` = 3fps) |
| `set-fans.js <pct\|auto>` | Configura fan speed (requer Afterburner GUI) |

---

## Hardware — Beleza Astral

| Componente | Detalhe |
|---|---|
| CPU | i7-7700K @ 4.20GHz, 4 cores / 8 threads |
| RAM | 16GB |
| GPU 0 | GTX 1080 Ti — Resolume Arena |
| GPU 1 | GTX 1080 Ti — CV (YOLO + ByteTrack) |
| Drive C | 233GB (OS + aya-expo-tools) |
| Drive D | 1.86TB (timelapse, health logs, frames) |
| Cameras | 4x Intelbras iMD 3C (1920x1080, RTSP) |
| TVs | 2x Hisense 55A51HUA (Google Cast) |
| Rede | WiFi local 192.168.0.x, WireGuard para AYA Studio |

---

## Roadmap

### v1.0 — entregue
- [x] PJLink engine (controle de projetores NEC, Epson, Panasonic)
- [x] Camera manager (RTSP/HTTP snapshot, Intelbras iMD 3C)
- [x] Network scanner (ARP, deteccao de dispositivos)
- [x] Scheduler (liga/desliga automatico por horario e dia da semana)
- [x] Smart Plugs Tuya Cloud (on/off, status, controle por projetor)
- [x] TVs Hisense via Google Cast (cast video, volume, WoL)
- [x] Server health (GPU temp, CPU, RAM, disco, Resolume status)
- [x] Audio manager (volume de soundbar)
- [x] Web GUI com tema AYA (dashboards HTML locais)
- [x] Portal Sync (push HTTP 30s para Portal AYA via WireGuard)
- [x] SSE broadcast para browsers conectados ao Portal
- [x] Timelapse (1 frame/min, 4 cameras, drive D)
- [x] Health logs JSONL (GPU/CPU/RAM a cada 30s)
- [x] CV basico: YOLOv8m deteccao de pessoas, contagem por zona
- [x] Counter: line crossing com ByteTrack (entradas/saidas por hora)
- [x] Heatmap acumulado por camera

### v2.0 — entregue (hackathon 27-28/03/2026)
- [x] CV Pipeline v2: 3fps com ByteTrack gallery-optimized (track_buffer=90)
- [x] ReID cross-camera: OSNet-x0_25 Market-1501, matching cam-1<->cam-3
- [x] Visitantes unicos por dia (deduplicados via aparencia)
- [x] Dwell real (soma segmentos, sobrevive a oclusao)
- [x] Staff filter: deteccao de uniforme teal (HSV) + threshold de tempo (3h)
- [x] Timelapse adaptativo: 1fps (expo aberta) / 1min (fechada)
- [x] Circular buffer no drive D (auto-cleanup < 100GB livres)
- [x] Monday pickup log para transferencia HD externo -> 4090
- [x] Timezone fix: UTC -> America/Sao_Paulo em todos os logs
- [x] Counter restart fix: fresh-start flag + preserved state
- [x] Safe restart: preserva counter + reid ao reiniciar mid-expo
- [x] Portal: 6 secoes de relatorio no PublicoCard
  - Agora na sala + Entradas (sempre visiveis)
  - Visitantes unicos ReID + Permanencia real
  - Funil por zona (entrada -> corredor -> sala -> galeria)
  - Ocupacao + dwell por zona
  - Fluxo por hora + Tendencia 7 dias + Pico do dia
  - Qualidade do dado (fps, counter balance, ReID, staff)
- [x] Portal: heatmap per-camera (cada camera com seu proprio heatmap)
- [x] Portal: camera feed 16:9 (frame.jpg do detector em vez de snapshot SD)
- [x] Daily summary com ReID (uniqueVisitors, avgDwell persistidos em disco)
- [x] portal-sync: URL WireGuard + API key + reid no payload
- [x] Contagem filtrada por poligono (pessoas fora das zonas nao contam)
- [x] MSI Afterburner fan control para operacao termica segura

### v2.1 — generalizacao (pre-Amano Rio, abril/2026)

O aya-expo-tools deve funcionar em qualquer expo similar sem editar Python.
Tudo especifico da expo vive no config JSON. O codigo le do config.

- [ ] **reid.py config-driven**: mover para config JSON:
  - `cv.reid.thresholdSameZone` / `cv.reid.thresholdCrossZone` (hoje hardcoded 0.75/0.82)
  - `cv.reid.sameZonePairs` derivado automaticamente de zonas com `strategy: max`
  - `cv.reid.camPrimaryZone` derivado automaticamente das zonas no config
  - `cv.staffFilter.colorHSV` (min/max H, S, V — hoje fixo teal)
  - `cv.staffFilter.timeMinutes` (hoje fixo 180)
- [ ] **Template de config**: `config/template.json` com todos os campos documentados
  - Gerar `amano-rio.json` a partir do template
- [ ] **Checklist pos-montagem**: endpoint `/api/selftest` que verifica:
  - Cameras respondem RTSP?
  - Projetores respondem PJLink?
  - Smart plugs acessiveis?
  - Rede: gateway pingavel? internet? WireGuard?
  - CV: detector iniciou? primeiro frame recebido?
- [ ] **Documentacao de deploy**: passo a passo para montar do zero num novo local
  - Pré-montagem: o que trazer, o que configurar antes
  - No local: rede, cameras, projetores, audio, config JSON
  - Validacao: selftest, primeiro dia de dados
- [ ] **Hot-reload de config**: aplicar mudancas em `beleza-astral.json` sem restart
  - Hoje: qualquer mudanca exige `safe-restart.js` (risco de perda durante ajuste)
  - Meta: endpoint `POST /api/config/reload` que re-le o JSON sem matar processos

### v3.0 — planejado
- [ ] Validacao 4090: replay de frames 1fps no 4090 com FastReID (modelo maior)
- [ ] Calibracao de thresholds ReID por expo (iluminacao e espaco especificos)
- [ ] Heatmap espacial: homografia camera -> planta baixa do espaco
- [ ] Mapa de calor unificado projetado na planta (N cameras -> 1 vista top-down)
- [ ] Setup wizard (fluxo guiado de montagem para equipe sem experiencia)
- [ ] DMX / ArtNet (iluminacao programavel)
- [ ] Monitoramento de tipo de internet (4G, Starlink, venue)
- [ ] Alerta Telegram quando anomalia detectada (camera offline, GPU quente, counter zerado)
- [ ] Multi-expo simultaneo: rodar Beleza Astral + Amano Rio no mesmo Portal

### Backlog (nao priorizado)
- [ ] Gaussian Splatting: digital twin 3D do espaco expositivo
- [ ] Multi-servidor: health de SHOW + BKP
- [ ] Audio zone control (multiplas zonas de som independentes)
- [ ] Relatorio PDF exportavel direto do Portal
- [ ] Integracao com sistema de ingressos (validar contagem CV vs tickets)
- [ ] Config wizard web (gerar JSON pelo browser em vez de editar manualmente)

---

## Requisitos

- Node.js 20+
- Python 3.11 com venv (torch 2.5.1+cu121, ultralytics 8.4, onnxruntime 1.24)
- Windows 10/11
- 2x GPU NVIDIA (1 para display, 1 para CV)
- MSI Afterburner (fan control obrigatorio em producao)
- Rede local com cameras RTSP
- WireGuard (opcional, para sync com Portal AYA)

---

*◇ AYA Studio · Art & Tech — sistema desenvolvido com Pi · Claude Code*
