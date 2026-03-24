# Audio Driver Quirk — SetMasterVolumeLevelScalar silently fails

**Descoberto:** 2026-03-24, durante montagem Beleza Astral (Farol Santander SP)  
**Media server:** AYA-BelezaAstral · Windows 11 · Creative Sound Blaster (VEN_1102)  
**Impacto:** volume do som ambiente ficava em 0% sem explicação aparente

---

## Sintoma

- `SetMasterVolumeLevelScalar(0.8f)` retorna `HR=0` (sucesso)
- `GetMasterVolumeLevelScalar()` retorna `0.0f` imediatamente após o set
- Volume travado em 0% em **todos** os endpoints (incluindo NVIDIA HDMI)
- Nenhum processo estava zerando — o próprio driver ignorava o comando
- Reiniciar serviços de áudio, desabilitar/reabilitar dispositivo e reboot não resolviam

## Causa raiz

O chip Creative/Sound Blaster (VEN_1102) reporta `QueryHardwareSupport` = `2`:

| Bit | Significado | Suportado |
|-----|-------------|-----------|
| 1   | Volume      | ❌ Não     |
| 2   | Mute        | ✅ Sim     |
| 4   | Meter       | ❌ Não     |

A API `SetMasterVolumeLevelScalar` (escalar 0.0–1.0) **depende do bit 1 (volume)**.  
Sem esse bit, o set é aceito silenciosamente mas **não tem efeito**.

## Solução

Usar `SetMasterVolumeLevel` (em dB, range -96dB a 0dB) em vez de `SetMasterVolumeLevelScalar`.  
Essa API funciona independente do `HardwareSupport` mask.

### Conversão porcentagem ↔ dB

```csharp
// Escala logarítmica (percepção humana de volume)
float PercentToDB(float pct) {
    if (pct <= 0) return -96.0f;
    if (pct >= 100) return 0.0f;
    return (float)(20.0 * Math.Log10(pct / 100.0));
}

float DBToPercent(float db) {
    if (db <= -96.0f) return 0.0f;
    if (db >= 0.0f) return 100.0f;
    return (float)(Math.Pow(10.0, db / 20.0) * 100.0);
}
```

### Referência rápida

| Porcentagem | dB     |
|-------------|--------|
| 100%        | 0 dB   |
| 80%         | -1.9 dB|
| 50%         | -6 dB  |
| 30%         | -10.5 dB|
| 10%         | -20 dB |
| 0%          | -96 dB |

## Diagnóstico

Para verificar se um dispositivo tem esse problema:

```powershell
# No PowerShell, via COM interop:
# QueryHardwareSupport → mask
# mask & 1 == 0 → SetMasterVolumeLevelScalar não funciona
# Usar SetMasterVolumeLevel (dB) como alternativa
```

Script de diagnóstico completo: `scripts/check-hw-vol.ps1`

## Arquivos corrigidos

| Arquivo | Mudança |
|---------|---------|
| `scripts/audio-volume.ps1` | `SetMasterVolumeLevelScalar` → `SetMasterVolumeLevel` (dB) |
| `server/audio.js` | Lê o .ps1 do disco (sempre versão atual) |

## Lições

1. **`HR=0` não significa que funcionou.** A API de áudio do Windows aceita silenciosamente comandos que não surtem efeito.
2. **Sempre verificar `QueryHardwareSupport`** antes de assumir que a API escalar funciona.
3. **`SetMasterVolumeLevel` (dB) é mais confiável** que `SetMasterVolumeLevelScalar` — funciona em todos os dispositivos testados.
4. **Não assumir que "volume zerado" é causado por um processo.** Pode ser a API falhando silenciosamente.
5. **O bit mask de hardware suporte varia por chip.** Testar em cada media server novo.
