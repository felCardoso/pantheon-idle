# Tutorial — Status e Habilidades

Guia prático para adicionar **personagens**, **status** e **habilidades** ao motor de combate do Pantheon Idle.

Regra de ouro: **conteúdo é dado, não código.** Adicionar um personagem ou uma habilidade normalmente significa editar apenas JSON. Só se mexe em TypeScript ao criar um *tipo* novo de mecânica (um status inédito, um efeito inédito).

Referência de design: [`docs/combate.md`](./combate.md) (v3.1).

---

## 1. Visão geral da arquitetura

O motor vive em `src/engine/` e é dividido em duas camadas:

```
src/engine/
├── index.ts                 ← A API PÚBLICA (o único import permitido à view)
│
├── data/                    ← CONTEÚDO (JSON)
│   ├── index.ts             ← manifesto: a única lista do que existe
│   ├── characters/*.json    ← personagens jogáveis
│   ├── enemies/*.json       ← inimigos e bosses
│   ├── abilities/*.json     ← habilidades
│   └── constants.json       ← números globais (crítico, durações padrão, anti-loop)
│
└── core/                    ← REGRAS (TypeScript)
    ├── loader.ts            ← JSON → Combatant (aplica nível e sinergia)
    ├── battle.ts            ← o loop de tempo real (ticks de 0,1s)
    ├── damage.ts            ← pipeline de dano de um ataque
    ├── statusRegistry.ts    ← O QUE cada status é
    ├── statusEffects.ts     ← COMO os status são aplicados/tickados
    ├── abilityEngine.ts     ← QUANDO uma habilidade dispara (gatilhos)
    ├── targeting.ts         ← QUEM um efeito atinge
    ├── magnitude.ts         ← QUÃO FORTE o efeito é
    ├── effects.ts           ← O QUE o efeito faz
    └── context.ts           ← contratos compartilhados (quebra ciclo de import)

tools/battle-cli/            ← view de terminal, FORA do engine
```

### Como uma habilidade é executada

```
battle.ts (tick)
   └─> abilityEngine.fireTrigger('onAttack', ctx)
         ├─ filtra por escopo: Vanguarda usa 'active', banco usa 'bench', 'passive' sempre
         └─> effects.applyEffect(efeito, ctx, runtime)
               ├─> targeting.resolveTargets()  → quem
               ├─> magnitude.resolveMagnitude() → quanto
               └─> handler do tipo do efeito    → o quê
```

Cada módulo é uma **tabela de lookup**, não um `switch`. Adicionar uma variante é acrescentar uma entrada; o TypeScript acusa erro de compilação se você declarar o tipo e esquecer de registrar o comportamento (e vice-versa).

### A fronteira engine ↔ view

O motor é **puro e agnóstico de framework**: não importa nada fora de si mesmo, não toca em `window`/`process.env`, e não conhece cor, ícone, portrait ou texto de UI. É isso que permite o mesmo código rodar no navegador (PvE), em Deno (Edge Function de PvP) e no terminal (`tools/battle-cli`) sem adaptador.

**A view importa sempre de `src/engine` (a API pública), nunca de um caminho interno:**

```ts
// ✅ correto
import { runBattle, loadCharactersByIds, type Combatant } from '../engine';

// ❌ recusado pelo lint
import { runBattle } from '../engine/core/battle';
import { STATUS_REGISTRY } from '../engine/core/statusRegistry';
```

`src/engine/index.ts` declara o que é público. Tudo em `core/**` e `data/**` é interno — o interpretador de habilidades, o gerenciador de status e o pipeline de dano não são API, são *como* a simulação funciona.

**Para animar a batalha**, a view não inspeciona `Combatant` durante o combate. O fluxo é: `runBattle()` devolve o log completo → `createInitialReplayState()` + `applyReplayEntry()` transformam esse log em snapshots (`ReplayState`) que a UI percorre no ritmo do relógio real. Cada entrada carrega `at` (segundos), e `ReplayState` expõe `allyVanguardId`/`enemyVanguardId` para a UI saber quem animar.

Estas regras são verificadas automaticamente por `npm run lint` (`scripts/check-engine-boundary.mjs`):

| Regra | O que impede |
| :--- | :--- |
| `engine-is-hermetic` | engine importar de fora de `src/engine` |
| `no-bare-imports` | engine importar `react`, `next` ou qualquer pacote |
| `no-host-globals` | `window`, `localStorage`, `process.env` no engine |
| `no-presentation` | cor hex, `className`, `portraitUrl` no engine |
| `no-deep-imports` | a view furar a API pública |

> **Por que `context.ts` existe:** um efeito de dano pode matar o alvo, o que precisa disparar `onDeath` — ou seja, `effects.ts` precisaria chamar `abilityEngine.ts`, que já importa `effects.ts`. Em vez de um ciclo, o `abilityEngine` injeta a si mesmo como um `EffectRuntime`. Efeito colateral útil: dá para testar um handler isolado passando um runtime falso.

### Os 3 escopos de habilidade

| Escopo | Quando dispara | Origem |
| :--- | :--- | :--- |
| `active` | Só enquanto o personagem é a **Vanguarda** | jogador escolhe 1 de 2 |
| `bench` | Só enquanto o personagem está no **banco**; buffa a Vanguarda aliada | jogador escolhe 1 de 2 |
| `passive` | **Sempre**, independente da posição | fixa, liberada por raridade |

Buffs de banco não têm timer: ficam presos ao dono (`benchSourceId`) e são removidos no instante em que ele entra como Vanguarda.

---

## 2. Criar um personagem novo

### Passo 1 — Definir os status base

Todos os personagens do jogo ficam numa lista só, em `src/engine/data/characters.json`. Adicione uma entrada nela:

```jsonc
// src/engine/data/characters.json — um item do array
{
  "id": "atena",                    // único no jogo inteiro; é a chave de tudo
  "name": "Atena.exe",
  "faction": "Firewall",            // Firewall | Malware | Crypto-Miner | Exploit
  "rarity": "Stable",               // Alpha → Beta → Stable → LTS → Zero-Day
  "mythology": "Mitologia Grega",   // controla a Sinergia de Cluster (§5)
  "stars": 0,
  "baseStats": {
    "hp": 950,                      // Integridade
    "atk": 85,                      // Processamento
    "def": 0,                       // Firewall   — SEMPRE 0 em personagens jogáveis
    "vel": 0,                       // Ping       — SEMPRE 0 em personagens jogáveis
    "esq": 0,                       // Evasion    — SEMPRE 0 em personagens jogáveis
    "ice": 0                        // ICE        — SEMPRE 0 em personagens jogáveis
  },
  "activeOptions": ["atena-escudo", "atena-contra-ataque"],
  "benchOptions":  ["atena-buff-def", "atena-buff-atk"]
}
```

**Atenção aos atributos ocultos.** `def`, `vel`, `esq` e `ice` **começam obrigatoriamente em 0** para personagens jogáveis (`docs/combate.md` §2: *"Iniciam em 0 e só são alterados por Habilidades, Banco ou Módulos"*). Se você quer um personagem rápido, não coloque `vel: 0.5` na base — dê a ele uma habilidade que concede `buffVel`. Inimigos são a exceção: eles têm valores base reais, porque são balanceamento de dificuldade, não build de jogador.

**Sobre `vel`:** o valor alimenta a fórmula `intervalo = 2.0s / (1 + VEL)`, com piso de 0,25s. Então `vel: 0` ataca a cada 2,0s e `vel: 1` a cada 1,0s. É uma *taxa*, não uma ordem de prioridade — valores acima de ~3 são inúteis (batem no piso).

### Passo 2 — Registrar (nada a fazer)

Não há passo de registro para personagens nem para habilidades: os dois arquivos são listas planas que o `loader.ts` carrega inteiras. Uma mitologia nova também não precisa de registro — o campo `mythology` do próprio personagem é o que agrupa o compêndio e calcula a Sinergia de Cluster.

O único conteúdo ainda registrado por mundo são os **inimigos**, em `WORLD_ENEMIES` (`src/engine/data/index.ts`), porque cada mundo sorteia os seus.

### Passo 3 — Conferir

```bash
npm run lint     # tipos + fronteira engine/view + cópia do PvP
npm test         # 144 testes
npm run battle   # batalha real no terminal
```

---

## 3. Criar uma habilidade nova

Todas as habilidades do jogo — de aliados e de inimigos — ficam em `src/engine/data/abilities.json`. A estrutura é sempre **Gatilho × Efeito × Alvo**.

### Exemplo A — Habilidade ativa (dano + status)

```jsonc
{
  "id": "atena-contra-ataque",
  "name": "Égide Reativa",
  "scope": "active",              // active | bench | passive
  "trigger": "onCounter",         // dispara ao ser atingida
  "chance": 0.35,                 // opcional: 35% de chance. Omitir = sempre
  "effects": [
    {
      "type": "directDamage",
      "target": "attacker",
      "magnitude": { "kind": "percentOfBaseAtk", "basePercent": 0.6 }
    },
    {
      "type": "applyStatus",
      "target": "attacker",
      "status": "throttling",
      "magnitude": { "kind": "percent", "value": 0.15 },
      "durationSeconds": 4        // ou "default" p/ usar constants.json
    }
  ]
}
```

### Exemplo B — Habilidade de banco (buff contínuo)

```jsonc
{
  "id": "atena-buff-def",
  "name": "Protocolo de Retaguarda",
  "scope": "bench",
  "trigger": "constant",          // buffs de banco usam sempre 'constant'
  "effects": [
    {
      "type": "buffAttribute",
      "target": "ownVanguard",    // buffa a Vanguarda aliada
      "attribute": "def",
      "durationSeconds": "permanent",
      "magnitude": { "kind": "percent", "value": 0.20 }
    }
  ]
}
```

> Em escopo `bench`, o campo `durationSeconds` é ignorado: o buff dura exatamente enquanto o dono estiver no banco.

### Exemplo C — Boss com cooldown

```jsonc
{
  "id": "fenrir-mordida",
  "name": "Mordida do Fim",
  "scope": "active",
  "trigger": "constant",
  "cooldownSeconds": 4,           // "a cada 4 segundos" (docs §7B)
  "effects": [
    { "type": "applyStatus", "target": "allEnemies", "status": "leak",
      "magnitude": { "kind": "flat", "value": 20 }, "durationSeconds": 6 }
  ]
}
```

### Passo final — Atribuir ao personagem

Referencie o `id` da habilidade no personagem:

```jsonc
"activeOptions": ["atena-escudo", "atena-contra-ataque"],
"benchOptions":  ["atena-buff-def", "atena-buff-atk"],
"passiveAbilityId": "atena-passiva"     // opcional
```

Se você errar o id, o `loader.ts` lança `Unknown ability id: ...` já no carregamento — falha rápido e explícita, não silenciosa.

### Referência rápida

**Gatilhos** (`trigger`) — os mais usados:

| Gatilho | Dispara quando |
| :--- | :--- |
| `battleStart` | a simulação começa |
| `constant` | sempre ativo (use com `cooldownSeconds` para repetir) |
| `onAttack` | logo após o próprio ataque básico |
| `onCounter` | ao receber um acerto direto |
| `onWounded` | ao perder HP |
| `onHalfHp` | na primeira vez que o HP cai abaixo de 50% |
| `onKill` / `onDeath` | ao ejetar um inimigo / ao ser ejetado |
| `onVanguardEnter` / `onVanguardExit` | ao assumir / deixar a Vanguarda |

**Alvos** (`target`): `self`, `attacker`, `defender`, `ownVanguard`, `enemyVanguard`, `benchAllies`, `allAllies`, `allEnemies`, `lowestHpAlly`, `highestAtkAlly`, `randomAlly`, `lowestEsqEnemy`, `highestAtkEnemy`, `lowestHpEnemy`, `randomEnemy`.

**Efeitos** (`type`): `directDamage`, `applyStatus`, `heal`, `grantShield`, `buffAttribute`, `dispel`.

**Magnitudes** (`magnitude.kind`): `flat`, `percent`, `percentOfMaxHp`, `percentOfBaseAtk` (aceita `perStarBonus`), `triggeringDamage`.

---

## 4. Criar um status novo

Só necessário para uma mecânica realmente inédita — buffs/debuffs de atributo já são cobertos por `buffAttribute` com magnitude negativa (é assim que "Corrosão" funciona: um `buffDef` negativo).

### Passo 1 — Declarar o tipo

```ts
// src/engine/schema.ts
export type StatusType =
  | 'leak'
  | 'trojan'
  // ...
  | 'overclock';   // ← novo
```

### Passo 2 — Descrever o comportamento

Este é o único lugar que define o que o status *é*:

```ts
// src/engine/core/statusRegistry.ts
export const STATUS_REGISTRY: Record<StatusType, StatusDescriptor> = {
  // ...
  overclock: {
    kind: 'buff',                                      // bucket de dispel
    tick: 'none',                                      // 'damage' | 'heal' | 'none'
    modifies: { attribute: 'vel', mode: 'multiplier' }, // opcional
    stacksByDefault: false,                            // opcional
  },
};
```

O `Record<StatusType, ...>` garante compilação vermelha se você declarar o tipo e esquecer o descritor.

### Passo 3 — Duração padrão

```jsonc
// src/engine/data/constants.json
"statusDefaultDurations": {
  "overclock": 5
}
```

Pronto — o tick, o dispel, a matemática de atributo e as regras de escudo passam a funcionar automaticamente. **Não existe passo 4:** `statusEffects.ts` deriva tudo do registry.

Se o status precisar de exibição na UI, adicione também o ícone e a cor em `src/data/theme.ts`.

---

## 5. Checklist e armadilhas

Antes de abrir PR:

```bash
npm run lint     # tipos + fronteira engine/view + cópia do PvP em dia
npm test         # 144 testes
npm run battle   # sanidade: a batalha ainda resolve?
```

Armadilhas comuns:

- **Atributo oculto na base de um jogável.** `def`/`vel`/`esq`/`ice` devem ser `0`; use habilidades.
- **`vel` na escala antiga.** Valores como `60` eram *prioridade de iniciativa* no sistema v2. Hoje `vel` é taxa: use `0.4`–`1.0`.
- **Buff de banco com `durationSeconds` numérico.** Ignorado — o vínculo é com a posição, não com o tempo.
- **DOT/HOT em `magnitude`.** O valor é **por segundo**, não por tick.
- **Habilidade órfã.** Criar o JSON não basta; é preciso referenciá-la em `activeOptions`/`benchOptions`/`passiveAbilityId`.

### A cópia do PvP é gerada, não editada

`supabase/functions/_shared/engine/` é uma **cópia gerada** de `src/engine/`, necessária porque a Edge Function de PvP roda em Deno e não consegue importar de `src/` no deploy.

Depois de qualquer mudança no motor:

```bash
npm run sync:pvp-engine
```

O script (`scripts/sync-pvp-engine.mjs`) recria a árvore aplicando as duas diferenças do Deno: extensão `.ts` explícita nos imports e `with { type: 'json' }` nos JSON. **Nunca edite os arquivos gerados à mão** — eles têm um cabeçalho `AUTO-GENERATED` e serão sobrescritos.

O `npm run lint` roda `--check` e falha se a cópia estiver defasada, então uma divergência entre PvE e PvP é pega antes do deploy.
