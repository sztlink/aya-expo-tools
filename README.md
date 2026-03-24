# ◇ AYA Expo Tools

Sistema operacional de exposições AYA Studio.
Roda localmente no media server de cada montagem — **funciona 100% offline**.
Quando há internet, conecta ao Portal AYA para controle e monitoramento remoto.

---

## Filosofia

**Local primeiro.** A expo nunca depende de internet para funcionar.
O `aya-expo-tools` é o sistema primário — roda no media server, guia a montagem, controla os equipamentos.
O Portal AYA é visibilidade e controle remoto — bônus quando há conexão, nunca requisito.

**Conhecimento embutido.** O sistema carrega o saber de como montar uma expo AYA.
Commissioning verifica cada subsistema passo a passo, sem depender de tutoria presencial.

---

## Arquitetura

```
aya-expo-tools (LOCAL — media server)
  │
  ├── /               ← dashboard de operação
  ├── /server.html    ← saúde do servidor (CPU, GPU, temp, Resolume)
  ├── /cv.html        ← visão computacional ao vivo
  ├── /report.html    ← relatórios de público
  │
  ├── Módulos (server/)
  │   ├── pjlink.js       ← projetores (PJLink Class 1)
  │   ├── cameras.js      ← RTSP/HTTP snapshot (Intelbras, Hikvision, Dahua)
  │   ├── tv.js            ← Hisense/Chromecast (Cast, WOL, volume)
  │   ├── audio.js         ← volume master do Windows (Core Audio API, dB)
  │   ├── network.js       ← scan de dispositivos, health check
  │   ├── scheduler.js     ← cron liga/desliga com sequência completa
  │   ├── server-health.js ← CPU, GPU, RAM, temp, Resolume, disco
  │   ├── cv.js            ← orquestrador de visão computacional
  │   ├── cv-logger.js     ← gravação de dados de ocupação
  │   ├── cv-report.js     ← relatórios diários/semanais/mensais
  │   ├── timelapse.js     ← captura periódica de câmeras
  │   ├── tuya.js           ← smart plugs Tuya Cloud API (on/off/status)
  │   ├── portal-sync.js   ← WebSocket push → Portal AYA
  │   ├── commissioning.js ← verificação automatizada de subsistemas
  │   └── loop-generator.js← geração de loops de vídeo para TVs
  │
  └── CV (cv/)
      ├── detector.py  ← YOLO v8 — detecção de pessoas por câmera
      └── counter.py   ← contagem de entradas/saídas por linha de cruzamento

Portal AYA (REMOTO — portal.aya.cx)
  ├── /dashboard/expo         ← todas as expos ativas
  ├── /dashboard/expo/[slug]  ← controle: projetores, TVs, volumes, câmeras, CV
  └── /dashboard/expo/[slug]/publico ← dados de público e heatmaps
```

---

## Expo em produção

### Beleza Astral — Farol Santander SP (mar/2026)

| Componente | Quantidade | Protocolo |
|------------|-----------|-----------|
| Projetores NEC PE456USL | 6 | PJLink |
| Câmeras Intelbras iMD 3C | 4 | RTSP |
| TVs Hisense 55A51HUA | 2 | Google Cast (Ethernet) |
| Soundbars JBL + Sub | 3 zonas | Analógico (volume via Core Audio) |
| Smart Plugs AVATTO 16A | 2 | Tuya Cloud API v3.4 |
| Internet | 4G | 60GB/mês |
| GPU CV | GTX 1080 Ti (GPU 1) | YOLO v8m |

**Docs específicos:**
- `docs/AUDIO-DRIVER-QUIRK.md` — driver Creative ignora API escalar de volume
- `docs/CHANGELOG-2026-03-24.md` — migração TVs WiFi→Ethernet, fix de áudio, smart plugs Tuya

---

## Setup Rápido

```bash
git clone https://github.com/sztlink/aya-expo-tools.git
cd aya-expo-tools
npm install
npm start
```

Abre `http://localhost:3000` no browser.

---

## Configuração

Cada exposição tem seu arquivo em `config/<slug>.json`.
Exemplo: `config/beleza-astral.json`.

Módulos são ativados por config:

```json
{
  "modules": {
    "projectors": true,
    "cameras": true,
    "audio": true,
    "smartplugs": true,
    "tvs": true,
    "dmx": false,
    "resolume": true
  }
}
```

---

## Scheduler — sequência de abertura/fechamento

### Abertura
1. Verifica se Resolume está pronto (GPU > 20%)
2. 🔌 Liga smart plugs (TVs recebem energia) → espera 15s
3. 📺 WOL nas TVs → espera boot (30s) → Cast vídeos
4. 🎥 Liga projetores (PJLink)
5. 🔊 Restaura volume ambiente (80%)

### Fechamento
1. 🎥 Desliga projetores (PJLink)
2. 📺 Para cast nas TVs
3. 🔌 Desliga smart plugs (TVs perdem energia)
4. 🔇 Zera volume ambiente

Suporta horários por dia da semana:
```json
{
  "schedule": {
    "enabled": true,
    "timezone": "America/Sao_Paulo",
    "days": {
      "mon": null,
      "tue": { "open": "09:00", "close": "20:00" },
      "wed": { "open": "09:00", "close": "20:00" }
    }
  }
}
```

---

## Visão Computacional

Roda na GPU 1 (GTX 1080 Ti) com YOLO v8m.

| Feature | Status |
|---------|--------|
| Detecção de pessoas por câmera | ✅ |
| Contagem entradas/saídas (linha de cruzamento) | ✅ |
| Heatmaps de ocupação | ✅ |
| Zonas configuráveis (sala, galeria, corredor, entrada) | ✅ |
| Estratégia `max` (câmeras sobrepostas) e `sum` (distintas) | ✅ |
| Relatórios diários/semanais/mensais | ✅ |
| Timelapse por câmera | ✅ |
| Push de dados para Portal AYA | ✅ |

---

## API

### Projetores
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/projectors` | Lista projetores e status |
| POST | `/api/projectors/all/on` | Liga todos |
| POST | `/api/projectors/all/off` | Desliga todos |
| POST | `/api/projectors/:id/on` | Liga um |
| POST | `/api/projectors/:id/off` | Desliga um |
| POST | `/api/projectors/:id/input` | Troca input |
| POST | `/api/projectors/poll` | Força poll de status |

### TVs
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/tv` | Lista TVs e status |
| POST | `/api/tv/all/on` | WOL em todas |
| POST | `/api/tv/all/cast` | Cast vídeo em todas |
| POST | `/api/tv/all/stop` | Para cast em todas |
| POST | `/api/tv/:id/on` | WOL individual |
| POST | `/api/tv/:id/cast` | Cast individual |
| POST | `/api/tv/:id/stop` | Para cast individual |
| POST | `/api/tv/:id/volume` | Volume individual |
| GET | `/api/tv/loops` | Status dos loops ativos |

### Áudio
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/audio/volume` | Volume atual |
| POST | `/api/audio/volume` | Define volume (body: `{level: 0-100}`) |

### Smart Plugs (Tuya Cloud)
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/plugs` | Status de todos os plugs (on/off) |
| POST | `/api/plugs/all/on` | Liga todos |
| POST | `/api/plugs/all/off` | Desliga todos |
| POST | `/api/plugs/:id/on` | Liga um plug |
| POST | `/api/plugs/:id/off` | Desliga um plug |

### Câmeras
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/cameras` | Lista câmeras e status |
| GET | `/api/cameras/:id/snapshot` | JPEG snapshot |
| GET | `/api/cameras/:id/stream` | MJPEG stream |
| POST | `/api/cameras/check` | Força verificação |

### Rede
| Método | Endpoint | Ação |
|--------|----------|------|
| POST | `/api/network/scan` | Scan da subnet |
| GET | `/api/network/internet` | Teste de conectividade |
| GET | `/api/discover/subnet` | Dispositivos na rede |
| GET | `/api/discover/mac` | MAC lookup |

### Servidor
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/server/health` | CPU, GPU, RAM, temp, Resolume |
| GET | `/api/server/history` | Histórico de métricas |
| GET | `/api/server/alerts` | Alertas ativos |
| GET | `/api/server/logs/:date` | Logs por dia |

### Visão Computacional
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/cv/status` | Status do detector |
| GET | `/api/cv/count` | Contagem atual |
| GET | `/api/cv/detections` | Detecções (bounding boxes) |
| GET | `/api/cv/heatmap` | Heatmap acumulado (PNG) |
| GET | `/api/cv/frame` | Frame anotado (JPEG) |
| GET | `/api/cv/counter` | Status do counter |
| GET | `/api/cv/daily/today/summary` | Resumo do dia |
| GET | `/api/cv/report/last7` | Relatório últimos 7 dias |
| GET | `/api/cv/report/last30` | Relatório últimos 30 dias |
| POST | `/api/cv/start` | Inicia detector |
| POST | `/api/cv/stop` | Para detector |
| POST | `/api/cv/heatmap/reset` | Reseta heatmap |

### Schedule
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/schedule` | Status e agenda |
| POST | `/api/schedule` | Atualiza config |
| POST | `/api/schedule/open` | Executa abertura manual |
| POST | `/api/schedule/close` | Executa fechamento manual |

### Timelapse
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/timelapse/dates` | Datas disponíveis |
| GET | `/api/timelapse/:date/cameras` | Câmeras com frames |
| GET | `/api/timelapse/:date/:camId/frames` | Lista frames |
| GET | `/api/timelapse/:date/:camId/at/:time` | Frame mais próximo |

### Sistema
| Método | Endpoint | Ação |
|--------|----------|------|
| GET | `/api/health` | Health check geral |
| GET | `/api/info` | Info da expo |
| GET | `/api/config` | Config atual |
| PUT | `/api/config` | Atualiza config |
| GET | `/api/session` | Sessão ativa |
| POST | `/api/session/start` | Inicia sessão local |
| POST | `/api/session/end` | Encerra sessão local |
| GET | `/api/log` | Log de eventos |
| POST | `/api/log` | Adiciona entrada |
| GET | `/api/commissioning/steps` | Steps de verificação |
| POST | `/api/commissioning/run` | Roda verificação completa |

---

## Equipamentos compatíveis

**Projetores** — PJLink Class 1 (porta 4352)
NEC PE456USL · PE506UL · Epson EB-series · Panasonic PT-series · Christie · Barco

**Câmeras** — RTSP + HTTP snapshot
Intelbras iMD 3C · VHD series · Hikvision DS-series · Dahua IPC-series

**TVs** — Google Cast (porta 8009)
Hisense 55A51HUA (VIDAA, Chromecast built-in) · qualquer Chromecast-compatible

**Áudio** — Windows Core Audio API (dB)
Saída analógica P2 · qualquer dispositivo de áudio do Windows
⚠️ Alguns chips (Creative VEN_1102) não suportam API escalar — ver `docs/AUDIO-DRIVER-QUIRK.md`

**Smart Plugs** — Tuya Cloud API (v3.4)
AVATTO WiFi Smart Socket Brazil 16A · qualquer plug Tuya-compatible
Requer credenciais em `config/tuya-cloud.json` (Access ID + Secret do platform.tuya.com)

---

## Roadmap

### Implementado ✅
- PJLink engine (liga/desliga/input/status/poll)
- Camera manager (RTSP/HTTP, snapshot, stream, check)
- TV manager (WOL, Cast, volume, loop monitor)
- Audio volume (Core Audio API em dB, compatível com todos os drivers)
- Smart plugs Tuya Cloud (on/off/status via API, integrado ao scheduler)
- Network scanner + discovery
- Scheduler com sequência completa (open/close por dia da semana, plugs + TVs + projetores + áudio)
- Server health (CPU, GPU, RAM, temp, disco, Resolume)
- Visão computacional (YOLO v8m, multi-câmera, zonas, counter, heatmap)
- Relatórios de público (diário, semanal, mensal)
- Timelapse por câmera
- Portal sync (WebSocket push, comandos remotos, SSE)
- Commissioning (verificação automatizada de subsistemas)
- Web GUI com dashboard operacional
- Config modular por expo

### Pendente
- [ ] Setup wizard (fluxo guiado visual de montagem — steps existem, UI wizard não)
- [ ] DMX / ArtNet
- [ ] Monitoramento de tipo de internet (4G data usage, Starlink health)
- [ ] Alertas Telegram direto do expo-tools (hoje só via Portal)
- [ ] Multi-servidor health (SHOW + BKP)

---

## Docs

| Arquivo | Conteúdo |
|---------|----------|
| `docs/STRATEGY.md` | Estratégia de implementação (4 ciclos) |
| `docs/AUDIO-DRIVER-QUIRK.md` | Bug de volume em chips Creative — causa e fix |
| `docs/CHANGELOG-2026-03-24.md` | Migração TVs Ethernet, fix de áudio, smart plugs Tuya |

---

## Requisitos

- Node.js 18+ (22 recomendado)
- Windows 10/11 (media server AYA)
- Python 3.11+ (para CV, com venv em `cv/venv/`)
- GPU dedicada para CV (GTX 1080 Ti ou superior)
- Rede local com acesso aos projetores/câmeras
- Internet opcional (para sync com Portal AYA)

---

*◇ AYA Studio · Art & Tech*
