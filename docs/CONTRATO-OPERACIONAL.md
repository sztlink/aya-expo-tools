# Contrato Operacional — AYA Expo Tools Core

> Lapidação do manifesto original após os casos reais **Beleza Astral** e **Amano Rio**.
> Este documento responde menos à pergunta “o que o sistema pode virar?” e mais à pergunta:
>
> **o que a próxima expo pode exigir sem depender do szt.link?**

---

## Tese central

O `aya-expo-tools` deve permitir que uma exposição **abra, feche e se recupere localmente** sem depender de:

- internet
- Portal AYA
- intervenção remota do szt.link
- presença de Felipe para operação básica

O szt.link deve atuar como:
- auditor
- supervisor
- integrador
- ferramenta de diagnóstico e evolução

**Não como operador necessário para a expo funcionar.**

---

## Regra de arquitetura

### 1. Core — obrigatório, estável, entregável
Tudo aqui precisa funcionar em qualquer expo nova.
Se falhar, a expo ainda não está pronta.

O Core deve garantir:

- boot automático do media server
- subida automática do runtime local
- operação **100% offline**
- comando de **abrir** a expo
- comando de **fechar** a expo
- controle de projetores
- controle de TVs / cast / stop, quando houver
- controle de áudio
- status local básico dos equipamentos
- restart seguro do runtime
- persistência após reboot
- configuração por JSON, sem editar código da expo
- self-test / commissioning mínimo
- logs locais legíveis

### 2. Add-on — importante, mas não bloqueante
Agrega observabilidade e conforto operacional, mas a expo não pode depender disso para abrir.

Inclui:
- Portal AYA
- push de health
- monitoramento de servidor
- snapshots / preview remoto
- alertas
- comandos remotos
- dashboards consolidados

Se cair, a expo continua operando localmente.

### 3. Lab — pode existir, mas não pode bloquear abertura
É camada de experimentação, analytics ou inteligência avançada.

Inclui:
- CV avançado
- fusão geométrica
- ReID sofisticado
- heatmaps avançados
- deduplicação multi-câmera
- analytics ricos
- qualquer dependência delicada de Python/venv/modelos

Essas camadas podem rodar em produção.
Mas a expo **não pode deixar de abrir ou fechar** por causa delas.

---

## Princípio operacional

A unidade mínima a garantir não é “liga/desliga”.
É:

> **abre / fecha / reinicia / volta sozinho / mostra estado local**

Ou seja, o mínimo confiável para a próxima expo é:

- abrir
- fechar
- sobreviver a reboot
- recuperar o runtime
- mostrar se está saudável
- permitir diagnóstico local básico

Se isso estiver garantido, o szt.link sai da posição de operador necessário.

---

## Papel do CV

A partir desta lapidação, o CV deixa de ser parte obrigatória do coração operacional da expo.

### Regra
- se o CV estiver ativo e saudável: ótimo
- se o CV quebrar: a expo **continua abrindo e fechando normalmente**

Portanto:
- `open/close` não pode depender do pipeline Python
- preview remoto não pode ser a única prova de que a expo está operando
- analytics nunca podem ser pré-condição de operação

---

## Papel do Portal

O Portal é uma camada de presença, memória e supervisão.

Ele pode:
- observar
- alertar
- acionar remotamente
- registrar estado
- consolidar múltiplas expos

Mas ele não pode ser requisito para:
- abrir
- fechar
- recuperar
- continuar operando no local

---

## Critério de pronto para a próxima expo

Uma expo só é considerada pronta quando passar em todos os itens abaixo **sem auxílio do szt.link**:

### Instalação
- instala a partir do kit offline ou procedimento padrão
- sobe o runtime local
- carrega config correta

### Persistência
- reboot real da máquina
- runtime volta automaticamente
- rede local volta
- controles locais continuam operando

### Operação
- `open` funciona
- `close` funciona
- projetores respondem
- TVs respondem, quando houver
- áudio responde

### Diagnóstico local
- operador consegue ver status local
- operador consegue rodar self-test
- operador consegue reiniciar o runtime

### Não dependência
- expo continua operando sem internet
- expo continua operando sem Portal
- expo continua operando sem intervenção remota

---

## Regras de produto para próximas expos

### Regra 1 — expo nova não deve exigir patch de código em campo
Expo nova deve ser, idealmente:

- novo `config/<slug>.json`
- commissioning
- validação

Se exigir alteração de JS/Python para fechar a montagem, o sistema ainda não está suficientemente consolidado.

### Regra 2 — launcher nativo é conveniência, não fundamento
O caminho confiável de produção é o runtime local explícito.

Exemplo esperado:
- `run-<expo>.bat`
- `node index.js --config=<slug>`
- Task Scheduler no boot

### Regra 3 — Python/venv não pode comprometer o Core
Se o CV quebrar, o Core continua saudável.

### Regra 4 — o instalador precisa provar que instalou
“Instalação concluída” só vale com smoke test:
- runtime sobe?
- `/api/health` responde?
- config carregou?
- se CV estiver habilitado: Python e CUDA respondem?

### Regra 5 — cada expo precisa de commissioning verificável
A entrega não pode depender de memória oral.

---

## Definição prática do AYA Expo Tools Core

Se tivermos que congelar uma borda de produto hoje, ela é esta:

### AYA Expo Tools Core
- runtime local confiável
- config-driven
- open/close
- projetores / TVs / áudio
- status local
- self-test
- restart seguro
- persistência após reboot
- operação offline

### Fora do Core
- Portal como dependência de operação
- CV como pré-condição de abertura
- analytics como requisito de montagem

---

## Síntese final

O manifesto inicial permanece válido:
- local first
- conhecimento embutido
- Portal como camada secundária

A lapidação agora adiciona uma fronteira objetiva:

> **o szt.link não deve ser necessário para operar a próxima expo.**

Ele pode acompanhar, melhorar, auditar e expandir.
Mas a expo pronta precisa conseguir existir sem ele.
