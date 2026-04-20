# Changelog — 2026-04-18 (Amano Rio + hardening pós-campo)

## feat(amano-rio): segunda expo operacional no stack v2.1

O `aya-expo-tools` passou a operar também no **Amano Rio — CCBB Rio**.
A configuração consolidada inclui:

- 9 projetores PJLink (`proj-1` a `proj-9`)
- 2 câmeras RTSP (`cam-1`, `cam-2`)
- `portalSync` ativo
- monitoramento de servidor e áudio via push
- CV ativo nas duas câmeras
- zona única `sala-imersiva`
- counter oficial em `cam-2`

Arquivo-chave:
- `config/template-amano-rio.json`

---

## fix(runtime): boot e configuração remota do v2.1

Hotfixes aplicados para o runtime v2.1 funcionar de forma confiável em campo:

- `index.js`
  - corrigido wiring da rota `/api/config`
  - runtime passou a chamar `core.start(config, { app, server }, managers)` com managers corretos
  - `portalSync` passou a receber dependências reais (`scheduler`, `session`, `readLog`, `serverHealth`)
- `core/server.js`
  - ordem de inicialização ajustada para levantar `serverHealth` antes de `portalSync`
- `core/routes/config.js`
  - adicionadas guards para `reload` / `updateConfig`

Resultado:
- `/api/config` voltou a responder corretamente
- health/config/info ficaram operáveis para setup e Portal
- monitoramento push passou a subir de forma consistente

---

## fix(cameras): rota de snapshot corrigida

A rota de snapshot chamava métodos incorretos no manager de câmeras.

Arquivo alterado:
- `clusters/cameras/routes.js`

Correção:
- troca de `cameras.getById` / `cameras.getSnapshot(cam)` por `cameras.get(req.params.id)` / `cam.getSnapshot(hd)`

Resultado:
- `/api/cameras/:id/snapshot` voltou a servir JPEG corretamente

---

## fix(cv): Amano usava venv inválido e preview SD no Portal

O problema visual do Amano não era apenas CSS.
O Portal estava recebendo snapshot SD (`640x480`) porque o CV não subia.

Diagnóstico de campo:
- o pendrive levava apenas `python-venv/`
- não havia Python base válido instalado no destino
- `pyvenv.cfg` apontava para um caminho inexistente

Correções relacionadas ao runtime:
- `clusters/cv/cv-manager.js`
  - `_getConfigPath()` corrigido para buscar `config/` no nível certo
- `clusters/communication/portal-sync.js`
  - push passou a preferir `cvManager.getFrame(camId)`
  - snapshot bruto ficou como fallback

Resultado:
- previews de `cam-1` e `cam-2` no Portal passaram a usar frame HD do CV (`1920x1080`)
- Amano adotou a mesma estratégia operacional da Beleza Astral

---

## feat(cv): estratégia `fused` com fallback seguro

Foi implantado um MVP de fusão geométrica para zonas com câmeras sobrepostas.

Arquivo alterado:
- `clusters/cv/cv-manager.js`

Entregue:
- suporte a `zone.strategy = "fused"`
- projeção por homografia para plano comum
- merge espacial usando `bottom-center` da bbox
- matching guloso bipartido
- fallback automático para `max` quando:
  - `cv.fusion.enabled = false`
  - não houver calibração suficiente
  - a zona não estiver em formato compatível

Debug exposto em `/api/cv/status`:
- `fusion.enabled`
- `fusion.zones[zoneId].usable`
- `fallback`
- `reason`
- `rawCounts`
- `matches`
- `projectedCounts`
- `sampleMatches`

---

## feat(portal-sync): payload mais completo para Portal

Arquivo alterado:
- `clusters/communication/portal-sync.js`

Novo comportamento:
- loader de `.env` corrigido
- payload passou a incluir `audio`
- payload passou a incluir `fusion`
- payload passou a incluir `heatmapPerCamera`
- scheduler passou a ser reportado com base no estado real do runtime

Resultado:
- Portal passou a mostrar health por push com servidor + áudio
- heatmap por câmera passou a ser mantido corretamente
- Amano ficou observável no Portal de forma equivalente à Beleza Astral

---

## feat(ui): calibração preparada para `fused`

Arquivo alterado:
- `ui/cv-calibrate.html`

Mudanças:
- strategy options incluem `fused`
- hints da UI atualizados para `max`, `sum`, `single` e `fused`

---

## ops(installer): limitações descobertas em campo

No Amano Rio, o instalador/launcher mostrou duas limitações operacionais importantes:

1. o fluxo não pode depender cegamente do launcher `.exe`
2. copiar apenas `python-venv/` não garante CV funcional no destino

Consequências operacionais documentadas:
- o caminho confiável de produção passou a ser subir `node index.js --config=<slug>`
- o kit offline precisa incluir Python base válido ou procedimento explícito de reparo do venv

---

## estado atual

### Amano Rio
- online no Portal
- monitoramento push ativo
- preview de câmera em HD via CV
- heatmap por câmera ativo
- `cam-2` como counter oficial
- `sala-imersiva` preparada para `fused`, hoje em fallback para `max`

### Pendências remanescentes
- calibrar homografias e ligar `cv.fusion.enabled = true`
- refinar a linha do counter da `cam-2`
- formalizar no kit offline a dependência do Python base

**Nota:** a validação final do `proj-2` e o reboot/persistência ponta a ponta ficaram registrados em `docs/CHANGELOG-2026-04-19.md`.
