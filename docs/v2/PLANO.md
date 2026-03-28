# aya-expo-tools v2 — Plano Completo

## Decisao (28/03/2026)

- **v1 (branch `main`, tag `v1.0-beleza-astral`)**: congelada. Producao Beleza Astral ate 31/05. So hotfix.
- **v2 (branch `v2`)**: tudo novo. Primeira implantacao: Amano Rio (22/04/2026).
- **Migracao Beleza Astral**: 28/04 (segunda, expo fechada).
- **Metodo**: Kanban, WIP=2, sem cerimonia. Codigo todos os dias incluindo fim de semana.

## Timeline

```
28/03 ──S1──S2──S3──S4──S5──S6──S7── 22/04
  |    clust reid sched UI    wiz  arch  pen    |
  |    4d    3d   3d    4d    4d   3d    5d     |
  |    ↑     ↑    ↑     ↑     ↑    ↑     ↑     |
  |    Todos os dias incluindo fim de semana     |
  |    25 dias corridos = 25 dias de trabalho    |
  |                                              |
  22/04: Amano Rio abre
  28/04: migrar Beleza Astral
```

**Nota de realismo**: 25 dias corridos, trabalhando todos os dias. Sprints sao metas, nao promessas. Se um sprint atrasar, o seguinte absorve. A unica data rigida e 22/04 (abertura Amano Rio). Sprints 6-7 tem folga embutida (8 dias para 6 dias de trabalho estimado).

## Hardware

| | Beleza Astral (v1) | Amano Rio (v2) |
|---|---|---|
| CPU | i7-7700K (4C/8T) | i9 (8C/16T+) |
| GPU CV | GTX 1080 Ti (sem Tensor) | **RTX 3090** (328 Tensor, 24GB) |
| YOLO | yolov8m 960px 3fps | **yolov8l/x 1280px 10-15fps** |
| ReID | OSNet CPU 4.6ms | **OSNet GPU <1ms, FP16** |
| Implicacao | tracking fragmentado | tracking continuo, menos re-ID falso |

---

## Auditorias (28/03)

4 auditorias cruzadas antes de escrever codigo.

### 1. Codigo real (code-auditor)
- index.js 1200+ linhas, 15 imports incondicionais
- cv.js → cameras.js sem fallback
- reid.py 6 constantes hardcoded
- Scheduler so liga projetores
- ~~config/*.json tracked~~ → **CORRIGIDO 28/03** (git rm --cached, .gitignore atualizado, TV certs removidos)

### 2. Forma vs comportamento (Casey Reas)
- 5 clusters, nao 3: equipamentos, cameras, cv, dados, comunicacao
- Scheduler = forma sem comportamento
- reid.py = comportamento sem forma

### 3. UI + ciclo de vida (Casey + Bourriaud)
- Vanilla JS + innerHTML → Preact
- Wizard como cerimonia de traducao
- Archiving obrigatorio; relatorio como historia visual
- Pendrive ida e volta

### 4. Viabilidade + seguranca (Claude.web)
- ~~Armazenamento 400GB~~ → **corrigido: 4 cameras = ~1TB** (ver calculo abaixo)
- ~~Pendrive 256GB~~ → **SSD externo 2TB** (comprar antes de 22/04)
- ~~install.bat 15min~~ → **45-90min realista** (venv 5-8GB, UAC, antivirus)
- Wizard precisa de **estado de retomada** (persistir progresso entre passos)
- "Pi" como dependencia precisa de **fallback humano documentado**
- Relatorio PDF precisa de puppeteer/playwright empacotado no pendrive
- Email de relatorio depende de 4G → fallback: **salvar local, enviar quando conectado**

---

## Calculo de armazenamento (corrigido)

```
4 cameras × 1fps × 8h/dia × 3600s/h = 115.200 frames/dia
115.200 × 150KB/frame = 16,5 GB/dia
16,5 GB/dia × 60 dias = ~990 GB

+ CV logs: ~200MB/dia × 60 = ~12 GB
+ Heatmaps: ~50MB/dia × 60 = ~3 GB
+ Config/docs: ~100MB

Total estimado: ~1 TB
```

**Decisao**: SSD externo 2TB USB 3.2 (~R$400). Pendrive so para install.bat + codigo + deps (~30GB).
Na pratica: **2 dispositivos**.
- **Pendrive 64GB**: instalador (ida). Sempre no bolso do Ihon.
- **SSD 2TB**: dados (volta). Fica conectado ao media server durante toda a expo.

Timelapse grava direto no SSD externo (nao no drive D interno). Archiving = desconectar o SSD e trazer.

---

## Arquitetura v2

```
aya-expo-tools/
  index.js                  <- boot condicional

  core/
    server.js               <- Express + middleware auth + Preact SSR
    config-loader.js        <- le JSON, valida schema, fallback para /setup
    scheduler.js            <- orquestra TODOS os clusters (open/close)

  clusters/
    equipment/              <- pjlink + tv + tuya + audio (MOVIDOS, nao reescritos)
    cameras/                <- cameras + timelapse (RTSP check porta 554)
    cv/                     <- detector + counter + reid (config-driven)
    data/                   <- cv-logger + cv-report + report-generator + archiver
    communication/          <- portal-sync + portal-commands

  ui/                       <- Preact JSX
    components/
    pages/
      dashboard.jsx         <- operacao diaria
      setup.jsx             <- wizard 10 passos (com estado de retomada)
      cv.jsx                <- CV + ReID + zones tempo real
      selftest.jsx          <- checklist verde/vermelho
      archive.jsx           <- ritual pos-expo

  config/
    template.json           <- schema documentado (versionado)
    [expo].json             <- especifico (gitignored)
```

### Contrato de cluster

```javascript
module.exports = {
  name: 'cv',
  requires: ['cameras'],
  register(app, config, clusters),
  onOpen(),
  onClose(),
  getStatus(),
}
```

---

## Sprints (25 dias corridos: 28/03 → 22/04)

### Sprint 1 — Clusters + migracao (28-31/03, 4 dias)

**Objetivo:** codigo reorganizado em clusters sem quebrar funcionalidade.

| Tarefa | Done |
|--------|------|
| Criar estrutura core/ + clusters/ no branch v2 | Pastas existem |
| Mover pjlink.js, tv.js, tuya.js, audio.js → clusters/equipment/ | Imports resolvidos |
| Mover cameras.js, timelapse.js → clusters/cameras/ | Imports resolvidos |
| Mover cv.js, cv-logger.js, cv-report.js → clusters/cv/ e clusters/data/ | Imports resolvidos |
| Mover portal-sync.js → clusters/communication/ | Imports resolvidos |
| Cada cluster exporta register(), onOpen(), onClose(), getStatus() | Contrato implementado |
| index.js faz boot condicional por config | npm start funciona |
| Nenhum modulo reescrito — so movido + register() adicionado | pjlink/tv/cameras identicos |

### Sprint 2 — ReID config-driven + staff (01-03/04, 3 dias)

**Objetivo:** reid.py le tudo do config JSON. Funciona em qualquer expo sem editar Python.

| Tarefa | Done |
|--------|------|
| Thresholds same/cross zone → config `cv.reid.thresholds` | reid.py le do JSON |
| Same-zone pairs → derivado automatico de zonas com strategy:max | Nao hardcoded |
| CAM_PRIMARY_ZONE → derivado automatico das zonas no config | Nao hardcoded |
| Staff filter color → config `cv.staffFilter.colorHSV` | Cor configuravel |
| Staff filter time → config `cv.staffFilter.timeMinutes` | Tempo configuravel |
| Feature gallery (5 features por reid_id) | Matching mais robusto |
| Spatial boost (mesma zona + tempo proximo) | Menos fragmentacao |
| Counter como ancora (unique/entries ratio no daily) | Indicador de qualidade |
| Perfil de hardware: `cv.hardware` (GPU model, VRAM) | Auto-ajusta fps/modelo |
| Amano Rio: yolov8l 1280px, 10fps, ReID GPU, FP16 | Config template pronto |

### Sprint 3 — Scheduler real (04-06/04, 3 dias)

**Objetivo:** scheduler orquestra abertura e fechamento de todos os clusters.

| Tarefa | Done |
|--------|------|
| Schedule por dia da semana (mon: null, tue: {open, close}) | Config-driven |
| Sequencia de abertura: equipment → cameras → cv → communication | Ordem correta |
| Sequencia de fechamento: inverso | Ordem correta |
| Abertura: projetores ON, TVs cast, plugs ON, audio restore, CV start | Todos os clusters |
| Fechamento: CV stop, projetores OFF, TVs stop, plugs OFF, audio mute | Todos os clusters |
| Override manual: POST /api/schedule/open e /close | Funciona |
| Log de cada passo com timestamp | Auditavel |

### Sprint 4 — Preact UI + CV dashboard + selftest (07-10/04, 4 dias)

**Objetivo:** UI local moderna com CV em tempo real e checklist de montagem.

| Tarefa | Done |
|--------|------|
| Setup Preact (htm + preact standalone, sem bundler) | Renderiza |
| Componentes base: Card, Badge, StatusDot, SimpleChart | Reutilizaveis |
| Dashboard: status de todos os clusters + botoes open/close | localhost:3000 |
| CV page: ReID uniqueVisitors, zones, dwell, staff tempo real | /cv |
| Selftest: checklist automatico (RTSP, PJLink, plugs, CV, Portal) | /selftest |
| Auth middleware: X-AYA-Token no .env | API protegida |
| System fonts offline | Offline-first |

### Sprint 5 — Installation wizard (11-14/04, 4 dias)

**Objetivo:** /setup guia montagem completa. Estado persiste entre passos.

| Tarefa | Done |
|--------|------|
| Rota /setup aparece quando nao tem config valido | Redirect auto |
| **Estado de retomada**: cada passo salva progresso em setup-state.json | Retomavel |
| **Pular e voltar**: passos com erro podem ser pulados e retomados | Nao bloqueia |
| Passo 1: Expo (nome, local, artista, datas) | Pre-preenchido |
| Passo 2: Rede (scan, lista dispositivos) | IPs detectados |
| Passo 3: Projetores (PJLink, modelo, lamp hours) | Testado |
| Passo 4: Cameras (RTSP, snapshot, **poligonos de zona**) | Zonas desenhadas |
| Passo 5: TVs (Cast, teste) | Testado |
| Passo 6: Audio (saida, volume) | Confirmado |
| Passo 7: Smart plugs (Tuya, liga/desliga) | Associado |
| Passo 8: CV (YOLO no frame, valida) | Detectando |
| Passo 9: Portal (WireGuard, push, slug) | Conectado |
| Passo 10: Schedule + checklist | Gera [expo].json |

**Nota sobre poligonos (passo 4):** canvas 2D com click-to-draw. Nao e editor de video — e poligono simples sobre snapshot estatico. Estimativa: 1 dia do sprint dedicado a isso.

### Sprint 6 — Archiving + relatorio (15-17/04, 3 dias)

**Objetivo:** archiving para SSD externo + relatorio narrativo.

| Tarefa | Done |
|--------|------|
| /archive: lista dados, calcula tamanho, verifica espaco no SSD | Funciona |
| Detecta SSD externo automaticamente | Nao precisa path manual |
| Estrutura: codigo-projeto/timelapse+logs+heatmaps+config+relatorio | Padronizado |
| Relatorio diario (7h email + salva local como fallback) | Funciona online e offline |
| Relatorio semanal (segunda 20h30) | Email ou local |
| Relatorio final (gerado no archiving, HTML standalone) | Nao depende de puppeteer |
| Formato narrativo: resumo, circulacao, picos, permanencia, saude | Legivel |
| Identidade visual AYA | Dark theme, tipografia limpa |

**Decisao relatorio**: HTML standalone (abre em qualquer browser) em vez de PDF. Elimina dependencia de puppeteer/playwright no pendrive.

### Sprint 7 — Pendrive + teste + deploy (18-22/04, 5 dias)

**Objetivo:** tudo testado, pendrive pronto, deploy Amano Rio.

| Tarefa | Done |
|--------|------|
| install.bat com tratamento de erros (UAC, antivirus, permissoes) | Mensagens claras |
| install.bat testado em maquina limpa (estimativa real: 45-90min) | Funciona do zero |
| Node.js portable empacotado | Offline |
| Python venv pre-empacotado (torch + ultralytics + onnx) | Offline |
| Modelos empacotados (yolov8l + osnet) | Offline |
| WireGuard config Amano Rio (peer criado no Unraid) | Tunel ativo |
| Template amano-rio.json | Pre-preenchido |
| Docs: esquematico, rider, plano de rede | No pendrive |
| **Fallback doc**: o que fazer se Pi nao estiver disponivel | Ihon sabe resolver |
| Teste em i9 + 3090 se disponivel (senao simular com config) | Validado |
| 22/04: Ihon instala no CCBB Rio | Amano Rio operando |

**Estimativa install.bat**:
- Descompactar codigo: 2min
- Instalar Node portable: 1min
- Descompactar venv Python (~7GB): 15-25min (USB 3.0)
- Copiar modelos: 1min
- Instalar WireGuard + importar config: 5min
- Configurar Task Scheduler: 2min
- Iniciar sistema + abrir browser: 1min
- **Total realista: 30-45min sem problemas, 60-90min com UAC/antivirus**

---

## Fallback humano (quando Pi nao esta disponivel)

"Pi" no workflow = automacao via szt.link. Quando falhar:

| Tarefa | Fallback |
|--------|----------|
| Preparar pendrive | Felipe copia manualmente (docs/PENDRIVE-MANUAL.md) |
| Gerar WireGuard peer | Felipe acessa Unraid UI e cria peer |
| Registrar expo no Portal | Felipe cria projeto via Portal UI |
| Relatorio diario | Salvo localmente, Felipe envia manualmente |
| Monitoramento remoto | Felipe acessa Portal no browser |

Documentar fallbacks no `docs/FALLBACK.md` dentro do repo.

---

## Pos-deploy

| Data | Acao |
|------|------|
| 22-27/04 | Validacao Amano Rio em producao (6 dias) |
| 28/04 (segunda) | Migrar Beleza Astral para v2 |
| 29/04+ | Ambas as expos na v2, codigo unificado |

---

## Compras antes de 22/04

| Item | Motivo | Estimativa |
|------|--------|-----------|
| SSD externo 2TB USB 3.2 | Armazenamento timelapse 4 cameras × 60 dias ≈ 1TB | ~R$400 |
| Pendrive 64GB USB 3.0 | Instalador (codigo + deps + docs) | ~R$40 |

---

## Regras

1. **v1 (main) so recebe hotfix.** Beleza Astral nao quebra.
2. **v2 (branch v2) recebe tudo.**
3. **NAO reescrever modulos que funcionam.** Mover + register().
4. **Merge v2 → main** so apos validacao Amano Rio.
5. **Beleza Astral migra em segunda-feira** (fechada, rollback possivel).
6. **Rollback**: `git checkout v1.0-beleza-astral`.
7. **Archiving obrigatorio** antes de desmontar qualquer expo.
8. **SSD externo 2TB** para dados. Pendrive 64GB para instalador.
9. **Fallback humano documentado** para quando Pi nao estiver disponivel.
10. **Wizard salva estado** entre passos — nunca perde progresso.

---

## Repo

- GitHub: `sztlink/aya-expo-tools`
- `main` = v1 producao (tag `v1.0-beleza-astral`)
- `v2` = branch ativo
- Secrets removidos do historico: `config/*.json`, `config/tv-certs/` (28/03)
