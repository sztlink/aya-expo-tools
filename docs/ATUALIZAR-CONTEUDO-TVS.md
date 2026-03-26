# Como atualizar o conteúdo das TVs

## O que você precisa

- Pen drive com os novos vídeos (MP4)
- Acesso físico ao media server (o computador preto na sala técnica)

## Passo a passo

### 1. Copiar os vídeos pro media server

Espete o pen drive no media server. Copie os vídeos para:

```
C:\aya-expo-tools\media\
```

Use nomes descritivos, sem espaço e sem acento. Exemplo:
- `Samuel_4K_entrevista.mp4`
- `Samuel_4K_estudio.mp4`

⚠️ **Regra importante:** o Cast das TVs Hisense aceita bem **4K em H.264 (AVC)**. Arquivos **H.265/HEVC** podem ficar em loading infinito.

⚠️ **Outra regra:** evitar nomes com extensão duplicada, tipo `.mp4.mp4`.

### 2. Parar os vídeos atuais

Abra o navegador no media server e acesse:

```
http://localhost:3000
```

No dashboard, clique em **STOP** nas TVs (ou use o Portal).

### 3. Atribuir os novos vídeos

Na mesma interface (`http://localhost:3000`), vá na seção de **Mídia**.

Ou faça direto pela API: abra o **Prompt de Comando** (cmd) e cole:

**Para a TV-1:**
```
curl -X POST http://localhost:3000/api/media/assign -H "Content-Type: application/json" -d "{\"tvId\":\"tv-1\",\"videoUrl\":\"/media/Samuel_4K_entrevista.mp4\"}"
```

**Para a TV-2:**
```
curl -X POST http://localhost:3000/api/media/assign -H "Content-Type: application/json" -d "{\"tvId\":\"tv-2\",\"videoUrl\":\"/media/Samuel_4K_estudio.mp4\"}"
```

⚠️ Troque o nome do arquivo pelo nome real do vídeo que você copiou.

### 4. Iniciar os novos vídeos

Clique em **PLAY** no dashboard, ou via cmd:

```
curl -X POST http://localhost:3000/api/tv/all/cast
```

### 5. Verificar

Confirme que os vídeos estão rodando nas duas TVs sem travamento.

---

## Onde ficam os arquivos

| O quê | Caminho |
|-------|---------|
| Vídeos originais | `C:\aya-expo-tools\media\` |
| Loops gerados | `D:\aya-expo-data\loops\` |
| Config das TVs | `C:\aya-expo-tools\config\beleza-astral.json` |

## Se algo der errado

- **TV não aparece:** verificar se a TV está ligada (smart plug) e na rede (cabo Ethernet)
- **Vídeo trava:** primeiro verificar se o codec é **H.264**. Se estiver em **H.265/HEVC**, transcodar para H.264 mantendo 4K, se necessário.
- **Loading infinito em uma TV:** fazer power cycle no smart plug da TV e recastar o vídeo.
- **Erro no assign:** verificar se o nome do arquivo está exatamente igual ao que está na pasta `media`
- **Precisa de ajuda:** mandar mensagem no grupo que o Pi resolve remotamente
