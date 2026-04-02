# aya-expo-tools — contexto local

## O que é
Ferramenta de gestão de exposições da AYA. Tauri app (v2.1, concluído).
Instalador MSI 4.5MB / Inno Setup 2MB. Testado com Beleza Astral e Amano Rio.

## Stack
Node.js + Tauri + Express. Entry point servidor: `server/index.js`.
Config: `config/`. Core logic: `core/`. Scripts utilitários: `scripts/`.

## Dev
```bash
node index.js          # inicia servidor local
node pack-and-serve.js # empacota e serve para instalação
```

## Build / instalador
Requer Tauri CLI instalado. Não rodar build sem verificar:
```bash
npx tauri --version   # confirmar que está disponível
```
Instaladores ficam em `installer/`.

## Estrutura relevante
```
core/           — lógica principal (câmeras, timelapse, monitores)
server/         — API Express
config/         — configurações de exposição
scripts/        — utilitários
logs/           — não commitar
media/          — não commitar arquivos grandes
```

## Cautelas
- `logs/` e `media/` não commitar
- v2.1 está concluída — novas features via BMAD (novo epic)
- Timelapse material: `D:\beleza-astral\` no PC Felipe (não neste repo)
