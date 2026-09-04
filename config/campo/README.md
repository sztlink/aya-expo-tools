# Configs de campo, higienizadas

O que existe aqui sao as configuracoes **reais** de exposicoes que subiram, com os
segredos retirados. Elas moravam so no disco de dev e nas maquinas das venues,
bloqueadas pela regra `config/*.json` do `.gitignore`, e por isso nao estavam em
repositorio nenhum.

O valor delas nao e o formato, e o **conhecimento de campo**: modelo de cada
projetor, endereco de cada camera, linha de cruzamento calibrada, zona de som,
horario de abertura e fechamento validado em temporada. Isso e o resultado de tres
montagens e nao se reconstroi lendo o template.

| arquivo | montagem | o que carrega |
|---|---|---|
| `beleza-astral.json` | Samuel de Saboia, Farol Santander SP, mar a jul/2026 | 6 projetores, 4 cameras, 2 TVs, 3 zonas de som, 2 tomadas |
| `player1-farol.json` | Player 1, Farol Santander SP, jun a set/2026 | 1 projetor, 3 cameras, CV desligado por contrato, portalSync |

## O que foi retirado

Dezessete campos: nove de `user`, sete de `password` e um `apiKey`. Cada um virou
`<<REMOVIDO: ver Vaultwarden>>`. Os valores reais ficam no Vaultwarden e nas
proprias maquinas.

**O `config/tuya-cloud.json` nao esta aqui, nem higienizado.** Ele e so credencial,
133 bytes de `clientId` mais `clientSecret`. Nao ha nada nele que valha versionar.

## A regra, e ela nao e minha

O manifesto do arquivo do Beleza Astral, no AYA ARCHIVE, ja dizia:

> A pasta `RESTRICTED_CONFIGS` pode conter configuracoes reais de operacao,
> inclusive credenciais locais de camera. Nao publicar nem espelhar no Drive.

Esta pasta e a forma de obedecer essa regra sem perder o conhecimento junto.

## Uma nota de codificacao

O `beleza-astral.json` tem mojibake de origem em alguns acentos, por exemplo
`SÃ£o Paulo`. **Esta assim no arquivo original que rodou em producao**, e foi
preservado fiel de proposito, para bater byte a byte com a copia da venue. Nao
corrigir sem conferir a copia de la.
