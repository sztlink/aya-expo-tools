---
tags: [arquitetura, expo, ferramentas, mediaserver, portal, pjlink, visao-computacional]
status: ativo
created: 2026-03-17
updated: 2026-04-19
relacionados: [[sistema/runbook-bots]], [[sistema/fonte-de-verdade]]
---

# AYA Expo Tools — Arquitetura e Visão

> **Estratégia de implementação completa:** `aya-expo-tools/docs/STRATEGY.md` (repo GitHub)
> **Lapidação operacional pós-campo:** `aya-expo-tools/docs/CONTRATO-OPERACIONAL.md`
> Auditada por Casey Reas (linguagem) e Case Mori (sistemas) em 2026-03-18.
> 4 ciclos: Presença → Sync → Controle → Escala.

## Problema

O conhecimento operacional de montagem de exposições AYA está **represado em pessoas**:
- Saber de rede: Jãozão + Mona (não participam mais das montagens)
- Saber de setup e mapeamento: Ihon (sobrecarregado, único ponto de falha)
- Resultado: cada expo é reinventada, setup depende de tutoria direta, sem documentação estruturada

## Solução

Um sistema em duas camadas complementares:

### Camada 1 — Local (aya-expo-tools)

Roda no **media server da expo**. Funciona **100% offline**.
É o sistema primário — a expo nunca depende de internet para funcionar.

**Repositório:** `github.com/sztlink/aya-expo-tools`
**Instalado em:** `C:\aya-expo-tools` no media server de cada expo

Responsabilidades:
- Setup wizard: guia qualquer membro da equipe pela montagem passo a passo
- Config estruturada: documenta o que foi configurado (rede, IPs, equipamentos)
- PJLink: controla projetores (liga, desliga, status, input)
- Câmeras: snapshots RTSP, status de conexão
- Network scanner: descobre dispositivos na subnet
- Scheduler: agenda ligar/desligar automático
- Monitor de servidor: CPU, GPU, temp, Resolume rodando?
- Smart plugs: controle de energia remoto (NovaDigital)
- DMX/ArtNet: iluminação (opcional, por expo)

### Camada 2 — Remoto (Portal AYA)

Roda no **portal.aya.cx** (Unraid). Requer internet.
É o sistema secundário — visibilidade e controle remoto.

**Seção:** `/dashboard/expo`

Responsabilidades:
- Visão centralizada de todas as expos ativas simultaneamente
- Controle remoto via comandos PJLink (websocket → aya-expo-tools)
- Câmeras ao vivo (snapshots a cada 5s via websocket)
- Alertas Telegram quando algo quebra (Ihon + Minhoso)
- Histórico de sessões e eventos
- Heatmap de público (futuro — CV na 4090)

## Contrato Operacional (lapidação abr/2026)

Depois dos casos reais **Beleza Astral** e **Amano Rio**, a pergunta deixou de ser apenas
**"o que o sistema pode virar?"** e passou a ser também:

**"o que a próxima expo pode exigir sem depender do szt.link?"**

A resposta é uma divisão explícita em 3 camadas:

### Core — obrigatório, estável, entregável
É o que precisa funcionar para a expo existir sem assistência remota.

Inclui:
- boot automático do media server
- subida automática do runtime local
- operação offline
- `open` / `close`
- projetores / TVs / áudio
- status local
- restart seguro
- persistência após reboot
- config por JSON
- self-test / commissioning mínimo

### Add-on — importante, mas não bloqueante
É a camada remota de observabilidade e conforto.

Inclui:
- Portal AYA
- push de health
- monitoramento de servidor
- snapshots remotos
- alertas
- comandos remotos

Se cair, a expo continua operando localmente.

### Lab — pode existir, mas não pode bloquear abertura
É a camada de analytics e inteligência avançada.

Inclui:
- CV avançado
- fusão geométrica
- ReID
- heatmaps avançados
- deduplicação multi-câmera
- qualquer dependência frágil de Python / venv / modelos

Essas camadas podem rodar em produção, mas a expo não pode deixar de abrir ou fechar por causa delas.

### Regra prática

A unidade mínima a garantir não é só **liga/desliga**.
É:

> **abre / fecha / reinicia / volta sozinho / mostra estado local**

Ou seja: o szt.link deve virar supervisor, auditor e integrador — **não operador necessário**.

Documento normativo desta lapidação:
- `aya-expo-tools/docs/CONTRATO-OPERACIONAL.md`

## Arquitetura de comunicação

```
Media Server (campo)                    Portal AYA (remoto)
────────────────────                    ──────────────────────
aya-expo-tools
  └── WebSocket client ──────────────→  /api/expo/ws
        ├── heartbeat 30s               ├── recebe status
        ├── snapshots câmera            ├── armazena no banco
        └── responde comandos  ←────────└── envia comandos PJLink
                                             envia diagnóstico
```

**Princípio crítico:** WebSocket é iniciado pelo media server (outbound).
O portal nunca tenta conectar no media server diretamente.
Funciona atrás de qualquer NAT (4G, Starlink, rede do venue).

## Módulos — ativação por expo

```json
{
  "modules": {
    "projectors":  { "enabled": true,  "protocol": "pjlink" },
    "cameras":     { "enabled": true,  "protocol": "rtsp" },
    "internet":    { "enabled": true,  "type": "4g" },
    "audio":       { "enabled": true,  "type": "soundbar" },
    "dmx":         { "enabled": false },
    "smartplugs":  { "enabled": true,  "protocol": "novadigital" },
    "mediaserver": { "enabled": true }
  }
}
```

## Tipos de exposição suportados

| Tipo | Contexto | Módulos |
|------|----------|---------|
| Sala imersiva fixa | Beleza Astral, Farol Santander | PJLink + câmeras + soundbar + smart plugs |
| Expo mobile | Sombras Milenares POA | PJLink + câmeras + DMX + interface áudio + 4G |
| Itinerante Starlink | Farol Viajante | PJLink + câmeras + Starlink monitoring |
| Multi-servidor | grandes instalações | SHOW01 + BKP01 health |

## Setup Wizard — fluxo de montagem

```
localhost:3000/setup

① Expo          → seleciona ou cria config
② Rede          → scan automático, confirma IPs, identifica gateway
③ Projetores    → testa PJLink um a um, confirma modelo e input
④ Câmeras       → verifica RTSP, mostra snapshot de confirmação
⑤ Áudio         → soundbar / interface; testa conexão
⑥ DMX           → se aplicável: ArtNet, universos, dispositivos
⑦ Smart Plugs   → tomadas inteligentes, confirma controle
⑧ Internet      → 4G / Starlink / venue; mede latência
⑨ Servidor      → specs do media server, versões de SW
⑩ Checklist     → tudo verde? expo pronta para abrir
```

## Visão do portal `/dashboard/expo`

```
/dashboard/expo
┌─────────────────────────────┬──────────────────────────────┐
│ BELEZA ASTRAL               │ FAROL VIAJANTE               │
│ Farol Santander · SP        │ Itinerante                   │
│ ● Online                    │ ● Online                     │
│ 6/6 projetores ✓            │ 4/4 projetores ✓             │
│ Internet: 4G ✓              │ Internet: Starlink ✓         │
│ [Abrir] [Fechar] [Diagnose] │ [Abrir] [Fechar] [Diagnose] │
└─────────────────────────────┴──────────────────────────────┘

/dashboard/expo/beleza-astral
┌──────────────┬────────────────────────────────────────────┐
│ Câmeras      │ Projetores                                 │
│ [cam1 jpeg]  │ P1 ● P2 ● P3 ● P4 ● P5 ● P6 ●            │
│ [cam2 jpeg]  │ [⏻ Ligar Todos] [⏻ Desligar Todos]        │
├──────────────┼────────────────────────────────────────────┤
│ Servidor     │ Rede                                       │
│ CPU 32% ✓   │ Internet: 4G · 18ms ping ✓                │
│ GPU 67% ✓   │ Switch: 14 dispositivos                   │
│ Temp 71°C ✓ │ [Escanear] [Diagnose]                     │
└──────────────┴────────────────────────────────────────────┘
```

## Roadmap

### v1.0 — ✅ construído e em campo (Beleza Astral, mar/2026)
- PJLink engine + camera manager + network scanner + scheduler + GUI

### v2.0 — em desenvolvimento
- Setup wizard
- Config modular por tipo de expo
- Monitor de saúde do servidor
- Smart plugs NovaDigital
- WebSocket sync com Portal AYA
- Comandos remotos via portal
- `/dashboard/expo` no Portal AYA

### v3.0 — planejado
- DMX / ArtNet
- Monitoramento de tipo de internet
- Visão computacional via 4090 (contagem de público, heatmap)
- Relatórios de sessão comparativos entre expos

## Usuários

| Pessoa | Papel | Uso |
|--------|-------|-----|
| Ihon Yadoya | Produtor Técnico | Montagem, setup wizard, operação remota |
| Minhoso | Equipe técnica | Monitoramento durante temporada |
| Leonardo Curti | Equipe | Operação e diagnóstico |
| Felipe | Direção | Visão remota via portal |

## Expos piloto

- **Beleza Astral** — Farol Santander SP — em montagem mar/2026
- **Farol Viajante** — itinerante — em operação mar/2026

## Decisões de design (influência Casey Reas)

1. **Duas camadas com temporalidades distintas:**
   - Operação (tempo real, binário, urgente) → aya-expo-tools local
   - Presença/inteligência (acumulativa, relacional) → portal remoto

2. **Local primeiro** — a expo nunca depende do portal

3. **Setup wizard como repositório de conhecimento** — carrega o saber do Jãozão e do Ihon de forma acessível a qualquer membro da equipe

4. **Módulos ativados por config** — poucas regras fortes, variação estruturada por expo

5. **WebSocket outbound** — funciona atrás de qualquer NAT sem configuração extra

6. **O szt.link não é operador necessário** — a próxima expo precisa abrir, fechar e se recuperar localmente sem depender de intervenção remota
