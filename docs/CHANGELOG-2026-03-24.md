# Changelog — 2026-03-24 (Montagem Beleza Astral)

## fix(audio): driver não suportava SetMasterVolumeLevelScalar

O chip de áudio Creative (VEN_1102) do media server ignora silenciosamente
a API `SetMasterVolumeLevelScalar`. O volume ficava travado em 0% sem erro.

**Causa:** `QueryHardwareSupport` retorna mask=2 (só mute, sem volume escalar).  
**Fix:** `audio-volume.ps1` agora usa `SetMasterVolumeLevel` (dB) com escala logarítmica.  
**Detalhe completo:** `docs/AUDIO-DRIVER-QUIRK.md`

Arquivos alterados:
- `scripts/audio-volume.ps1` — reescrito para usar API em dB
- `scripts/check-hw-vol.ps1` — novo, diagnóstico de hardware support
- `server/audio.js` — lê .ps1 do disco (sempre versão atualizada)

---

## feat(network): TVs migradas de WiFi para Ethernet

Leonardo Curti conectou ambas as TVs Hisense 55A51HUA via adaptador USB-Ethernet.

### Antes (WiFi)

| TV | IP | MAC |
|----|-----|-----|
| TV-1 | 192.168.0.115 | E0:3E:CB:E2:60:4C |
| TV-2 | 192.168.0.210 | E0:3E:CB:E2:61:56 |

### Depois (Ethernet)

| TV | IP | MAC | Adaptador |
|----|-----|-----|-----------|
| TV-1 | 192.168.0.202 | C4:08:26:9A:E7:EB | USB-Ethernet (OUI C4:08:26) |
| TV-2 | 192.168.0.201 | C4:08:26:9A:E8:88 | USB-Ethernet (OUI C4:08:26) |

### DHCP

Reservas criadas no roteador TP-Link AX12 (192.168.0.1) com os novos MACs Ethernet.
Reservas antigas (MACs WiFi E0:3E:CB) removidas.

### Resultado

Ambas as TVs com 13mbps por cabo. Cast via Google Cast (porta 8009) funcionando.
Vídeos em loop sem perda de quadro (confirmado por Leonardo no local).

Arquivo alterado:
- `config/beleza-astral.json` — IPs e MACs atualizados

---

## Notas operacionais

- **Não usar `taskkill /f` no Arena.exe** enquanto ele estiver com sessão WASAPI ativa.
  O kill forçado pode corromper o estado de volume do Windows Audio.
  Preferir fechar o Arena pelo GUI ou pelo scheduler (close sequence).

- **Após reboot do media server**, o Arena abre automaticamente via atalho
  na Startup (`BelezaAstral.avc`). O aya-expo-tools inicia via Task Scheduler.

- **Composição BelezaAstral.avc** tinha AudioTrack com volume salvo em -192dB (zero).
  Corrigido para 0dB. Backup em `.avc.bak-20260324-132726`.
