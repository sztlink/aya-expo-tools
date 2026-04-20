# Changelog — 2026-04-19 (validação final de campo)

## ops(projector): `proj-2` do Amano validado após ajuste onsite

O projetor `proj-2` (`10.0.0.102`) tinha histórico de desaparecer da rede após desligar.
Depois do ajuste onsite de standby/rede, foi feita validação remota em duas etapas.

### Etapa 1 — reteste passivo
- ping OK
- ARP OK
- PJLink (`4352`) OK
- HTTP (`80`) OK
- `/api/projectors/poll` retornando `online: true`, `power: "on"`, `input: "HDMI1"`

### Etapa 2 — power cycle destrutivo controlado
- `POST /api/projectors/proj-2/off` → comando aceito
- projetor permaneceu acessível desligado
- `/api/projectors/poll` retornou `online: true`, `power: "off"`
- `POST /api/projectors/proj-2/on` → comando aceito
- novo poll confirmou `online: true`, `power: "on"`, `input: "HDMI1"`

### Conclusão
O problema não era do Portal nem do stack PJLink.
Era realmente condição de standby/rede do projetor.
Após o ajuste local, o `proj-2` passou a permanecer controlável mesmo desligado.

---

## ops(persistence): reboot controlado do Amano validou o stack ponta a ponta

Foi executado reboot remoto no media server `AYA-AmanoCCBB`.

### Validado após o boot
- WireGuard voltou automaticamente
- SSH voltou automaticamente
- `AYA Expo Tools Node` voltou automaticamente
- `/api/health` voltou com `status: ok`
- `/api/server/health` voltou preenchido
- `/api/cv/status` voltou com 2 detectores + counter ativos
- Portal voltou a receber o Amano por `source: "push"`

### Conclusão
A persistência ponta a ponta do Amano foi validada em produção:
- boot
- VPN
- SSH
- runtime
- CV
- push no Portal

---

## docs(status): mudança de status operacional

Com as validações de 2026-04-19, deixam de ser pendências abertas:
- reteste do `proj-2`
- reboot controlado para validar persistência

Pendências remanescentes passam a ser majoritariamente de **calibração**, não mais de infraestrutura crítica:
- linha do counter da `cam-2`
- homografias da fusão geométrica
- revisão final do kit offline / Python base

---

## docs(manifesto): visão original lapidada em contrato operacional

A visão original do projeto foi mantida, mas passou a ganhar uma fronteira operacional explícita.

Novos artefatos/ajustes:
- `ARQUITETURA.md` atualizado com a lapidação pós-campo
- `docs/CONTRATO-OPERACIONAL.md` criado como documento normativo

Tese consolidada:
- o szt.link deixa de ser operador necessário
- a próxima expo deve conseguir **abrir, fechar e se recuperar localmente**
- CV avançado, analytics e outras camadas podem existir, mas não podem bloquear a operação do Core


## 2026-04-20 — Amano Rio
- Playback estabilizado em campo com **Resolume Composition FPS = 30** e **NVIDIA default**.
- Leituras anteriores de tuning fino no painel NVIDIA deixaram de ser hipótese principal; o achado mais forte foi alinhar a cadência do Resolume à chain física operando em 30 Hz.
- Counter religado após estabilização do playback.
