# Workflow de Montagem — aya-expo-tools v2

## Pre-montagem (AYA Studio, antes de ir para o local)

### 1. Preparar documentos
- [ ] **Rider de equipamentos** — lista completa com modelos, quantidades, cabos
- [ ] **Esquematico de montagem** — planta com posicao de projetores, cameras, media server, rede
- [ ] **Plano de rede** — tabela de IPs pre-definidos para cada equipamento

### 2. Preparar midia de instalacao

**Dois dispositivos:**
- **Pendrive 64GB** — instalador. Vai e volta com o Ihon.
- **SSD externo 2TB** — dados. Fica conectado ao media server durante toda a expo.

Pendrive:
- [ ] `aya-expo-tools/` — codigo v2 completo
- [ ] `venv-pack/` — Python venv pre-empacotado (torch, ultralytics, onnxruntime) ~7GB
- [ ] `models/` — yolov8l.pt + osnet_x0_25.onnx
- [ ] `wireguard/` — config WireGuard pre-gerado (chave ja cadastrada no Unraid)
- [ ] `config/template-[expo].json` — config pre-preenchido
- [ ] `install.bat` — script com tratamento de erros (UAC, antivirus)
- [ ] `docs/FALLBACK.md` — o que fazer quando Pi nao estiver disponivel

SSD externo:
- [ ] Formatado NTFS, label `AYA-DATA`
- [ ] Pasta `arquivo/` criada
- [ ] Testado no media server (USB 3.0+ confirmado)

### 3. Gerar chave WireGuard
No Unraid (AYA Studio):
- Criar novo peer com IP `10.253.0.XX`
- Exportar config para `wireguard/wg0.conf` no pendrive
- Anotar IP WireGuard no plano de rede

### 4. Criar projeto no Portal
- Projeto com codigo, datas, slug
- Registrar expo-config no Portal (`lib/expo-config.ts`) com IP WireGuard

---

## No local — Dia de montagem

### Fase 1: Infraestrutura fisica (Ihon + equipe)

```
1. Descarregar equipamentos
2. Posicionar media server no rack/mesa tecnica
3. Ligar energia (media server, projetores, amplificador)
4. Montar rede:
   - Ligar roteador/switch
   - Cabear projetores (ethernet para PJLink)
   - Cabear cameras (ethernet)
   - Conectar media server ao switch
5. Cabear video:
   - GPU → matriz → projetores (HDMI/DP conforme esquematico)
   - GPU → monitor de controle
6. Cabear audio:
   - Media server P2 → splitter → amplificador → caixas
7. Posicionar e ligar cameras
8. Posicionar e ligar TVs (se houver)
```

### Fase 2: Instalar aya-expo-tools (Ihon, 15 min)

```
1. Espetar pendrive no media server
2. Conectar SSD externo (USB 3.0+)
   → Confirma que aparece como D: ou E:
3. Espetar pendrive
4. Executar install.bat (estimativa: 45-90min)
   → Copia aya-expo-tools para C:\aya-expo-tools
   → Instala Node.js portable (se nao tiver)
   → Descompacta venv Python (~7GB, 15-25min em USB 3.0)
   → Copia modelos YOLO + OSNet
   → Configura SSD externo como drive de dados (timelapse, logs)
   → Instala WireGuard e importa config
   → Inicia WireGuard
   → Confirma tunel ativo: "10.253.0.XX conectado ao AYA Studio ✓"
   → Cria Task Scheduler para auto-start
   → Inicia aya-expo-tools
   → Abre browser em http://localhost:3000/setup
   
   Se erro de UAC: "Execute como Administrador"
   Se antivirus bloqueia: "Adicione C:\aya-expo-tools\ as exclusoes"
```

### Fase 3: Wizard de configuracao (Ihon, guiado pelo sistema, 30 min)

O sistema guia passo a passo. Ihon so confirma.

```
localhost:3000/setup

① EXPO
   Nome: Amano - Rio
   Local: CCBB Rio de Janeiro
   Artista: Amano Yoshitaka
   Abertura: 22/04/2026
   Slug: amano-rio
   [pre-preenchido do template — Ihon so confirma]

② REDE
   Scanning 192.168.X.0/24...
   Gateway: 192.168.X.1 (TP-Link) ✓
   Media server: 192.168.X.10 ✓
   Dispositivos encontrados: 14
   [sistema lista IPs detectados — Ihon identifica cada um]

③ PROJETORES
   192.168.X.101 → PJLink ativo → NEC PE506UL (lamp: 0h) ✓
   192.168.X.102 → PJLink ativo → NEC PE506UL (lamp: 0h) ✓
   [testa cada projetor — liga/desliga para confirmar]

④ CAMERAS
   192.168.X.107 → RTSP ativo → Intelbras iMD 3C ✓
   [mostra snapshot — Ihon confirma posicao e nomeia: "Sala Principal"]
   [Ihon desenha poligono de zona no frame: "Zona A"]

⑤ TVs
   192.168.X.201 → Chromecast detectado → Hisense 55" ✓
   [testa cast de video de teste]

⑥ AUDIO
   Saida analogica detectada ✓
   [testa tom de 440Hz — Ihon confirma que sai som em todas as caixas]

⑦ SMART PLUGS
   Tuya Cloud: 2 plugs encontrados ✓
   plug-1 → liga ✓ → desliga ✓
   [Ihon associa: "plug-1 controla TV-1"]

⑧ CV (se habilitado)
   YOLOv8m carregado na GPU 1 ✓
   cam-1: 3 pessoas detectadas no frame ✓
   [mostra frame anotado — Ihon valida que a deteccao faz sentido]

⑨ PORTAL
   WireGuard: 10.253.0.XX → AYA Studio ✓
   Push para Portal: aceito ✓
   Slug: amano-rio registrado ✓

⑩ SCHEDULE
   [calendario semanal — Ihon define horarios]
   Ter-Dom: 10:00-18:00
   Seg: fechado
   [preview: "Amanha 10:00 o sistema liga automaticamente"]

⑪ CHECKLIST FINAL
   ✓ Rede: gateway + 14 dispositivos
   ✓ 6 projetores: PJLink respondendo
   ✓ 4 cameras: RTSP + zonas desenhadas
   ✓ 2 TVs: Cast testado
   ✓ Audio: som confirmado
   ✓ 2 smart plugs: liga/desliga ok
   ✓ CV: deteccao funcionando
   ✓ Portal: push ativo
   ✓ Schedule: ter-dom 10-18h
   ✓ WireGuard: tunel ativo

   [GERAR CONFIG] → salva amano-rio.json
   "Sistema entendeu o espaco. Pronto para operar."
```

### Fase 4: Validacao (Ihon, 15 min)

```
1. Ligar tudo via scheduler manual: "Abrir expo"
   → projetores ligam
   → TVs ligam + cast inicia
   → audio volume restaurado
   → CV inicia deteccao
2. Caminhar pelo espaco e confirmar:
   - Projecoes alinhadas?
   - Cameras detectando pessoas?
   - Som em todas as caixas?
   - TVs com conteudo correto?
3. Acessar Portal AYA no celular
   → /dashboard/expo/amano-rio
   → dados chegando em tempo real?
4. Desligar via scheduler: "Fechar expo"
   → tudo desliga na ordem correta?
```

### Fase 5: Ihon vai embora

```
1. Sistema opera sozinho a partir daqui
2. Schedule liga/desliga automaticamente
3. Portal monitora remotamente
4. Felipe recebe relatorio diario as 7h
5. Se algo quebrar: equipe local acessa localhost:3000
```

---

## Pos-expo — Desmontagem

### Antes de desligar qualquer coisa:

```
localhost:3000/archive

1. Verificar dados acumulados no SSD externo
   "60 dias de timelapse (4 cameras), 60 dailies, heatmaps, config"
   "Total: 1.02 TB — SSD 2TB: 980GB livre ✓"

2. Gerar relatorio final
   → HTML standalone (abre em qualquer browser, sem dependencia)
   → Salvo no SSD: arquivo/[codigo-projeto]/relatorio-final.html

3. Verificar integridade
   → Contagem de arquivos vs esperado
   → Checksum dos dailies
   → "Todos os dados verificados ✓"

4. Copiar config final para o SSD
   → C:\aya-expo-tools\config\amano-rio.json → SSD
   → C:\aya-expo-tools\logs\ → SSD
   → Dossie tecnico → SSD

5. Desconectar SSD
   "Dados seguros. Hardware pode ser desmontado."

6. Ihon traz SSD de volta para AYA Studio
   → dados entram no 4090/Unraid para arquivo permanente
   → ~1TB transferido fisicamente, nao por rede
```

**Por que SSD externo e nao internet:**
4 cameras × 1fps × 8h/dia × 150KB/frame = 16,5 GB/dia.
60 dias = ~990 GB. Inviavel por 4G (60-120GB/mes compartilhados).
SSD fica conectado ao media server durante toda a expo. Timelapse grava direto nele.

---

## O pendrive — ida e volta

O pendrive e o unico objeto fisico que viaja entre AYA Studio e o local da expo.
Na ida leva o sistema. Na volta traz os dados.

### Ida (AYA Studio → local)

```
pendrive/
  install.bat                    <- script principal
  aya-expo-tools/                <- codigo v2 completo
  deps/
    node-v20-win-x64.zip         <- Node.js portable (se nao instalado)
    venv-pack.zip                <- Python venv com torch+ultralytics+onnxruntime
    models/
      yolov8m.pt
      osnet_x0_25.onnx
  wireguard/
    wireguard-installer.exe      <- instalador WireGuard (se nao instalado)
    wg0.conf                     <- config pre-gerado para este media server
  config/
    template-amano-rio.json      <- pre-preenchido com dados conhecidos
  docs/
    esquematico-montagem.pdf     <- planta com posicoes
    rider-equipamentos.pdf       <- lista completa
    plano-rede.pdf               <- IPs pre-definidos
```

### Volta (local → AYA Studio)

```
pendrive/
  [tudo da ida permanece intacto]
  arquivo/
    202612_AMANORIO_CCBB/
      timelapse/                 <- frames 1fps de toda a temporada
      health-logs/               <- JSONL de saude por dia
      cv-logs/                   <- JSONL + dailies com counter + reid
      heatmaps/                  <- por camera, por dia
      config/
        amano-rio.json           <- config final da expo
        dossie-tecnico.md        <- documentacao completa
      relatorio-final.pdf        <- gerado automaticamente no archiving
```

**Requisito de armazenamento (calculo real):**
```
4 cameras × 28.800 frames/dia × 150KB = 16,5 GB/dia
16,5 GB/dia × 60 dias = ~990 GB
+ logs + heatmaps + config ≈ 15 GB
Total: ~1 TB
```
**Pendrive 64GB**: instalador (ida). Codigo + deps + docs ≈ 15GB.
**SSD 2TB USB 3.2**: dados (toda a temporada). Fica no media server.

---

## Quem faz o que

| Etapa | Quem | Onde | Quando |
|-------|------|------|--------|
| Preparar pendrive | Pi + Felipe | AYA Studio | 1 semana antes |
| Gerar WireGuard peer | Pi | Unraid | 1 semana antes |
| Registrar expo no Portal | Pi | Portal AYA | 1 semana antes |
| Montar infraestrutura | Ihon + equipe | Local da expo | Dia de montagem |
| Instalar aya-expo-tools | Ihon | Media server | Dia de montagem (15 min) |
| Wizard de config | Ihon (guiado pelo sistema) | localhost:3000/setup | Dia de montagem (30 min) |
| Validacao | Ihon | Local | Dia de montagem (15 min) |
| Monitoramento diario | Felipe (via Portal) | Remoto | Durante temporada |
| Relatorios | Pi (automatico) | Email | Diario 7h + semanal |
| Archiving + verificar SSD | Ihon | localhost:3000/archive | Ultimo dia |
| Desconectar SSD + trazer | Ihon | SSD → AYA Studio | Pos-desmontagem |
| Ingerir dados no arquivo | Pi + Felipe | SSD → 4090/Unraid | AYA Studio |
