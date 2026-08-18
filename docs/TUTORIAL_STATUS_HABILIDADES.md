# Tutorial — Status e Habilidades

Guia prático para adicionar **personagens**, **status** e **habilidades** ao motor de combate do Pantheon Idle.

Regra de ouro: **conteúdo é dado, não código.** Adicionar um personagem ou uma habilidade normalmente significa editar apenas JSON. Só se mexe em TypeScript ao criar um *tipo* novo de mecânica (um status inédito, um efeito inédito).

Referência de design: [`docs/combate.md`](./combate.md) (v3.1).

---

## 1. Visão geral da arquitetura

O motor vive em `src/engine/` e é dividido em duas camadas:

```
src/engine/
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

Abra (ou crie) o arquivo da mitologia em `src/engine/data/characters/`:

```jsonc
// src/engine/data/characters/olympus.json
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

### Passo 2 — Registrar a mitologia (só se for nova)

Se o arquivo já existia, **pule este passo** — o personagem já é carregado.

Para uma mitologia inédita, adicione uma entrada em `src/engine/data/index.ts`:

```ts
export const WORLD_CONTENT: Record<WorldId, WorldContent> = {
  // ...
  olympus: {
    characters: olympusCharacters as CombatantData[],
    enemies: olympusEnemies,
    abilities: [...(olympusAbilities as AbilityDefinition[]), ...(olympusEnemyAbilities as AbilityDefinition[])],
  },
};
```

É o **único** lugar que muda. O `loader.ts` deriva todos os registries daqui e nunca precisa ser tocado.

### Passo 3 — Conferir

```bash
npx tsc --noEmit && npx vitest run
npx tsx src/engine/cli/runBattle.ts   # batalha real no terminal
```

---

## 3. Criar uma habilidade nova

Habilidades ficam em `src/engine/data/abilities/<mitologia>.json`. A estrutura é sempre **Gatilho × Efeito × Alvo**.

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
npx tsc --noEmit          # tipos
npx vitest run            # 143 testes
npx tsx src/engine/cli/runBattle.ts   # sanidade: a batalha ainda resolve?
```

Armadilhas comuns:

- **Atributo oculto na base de um jogável.** `def`/`vel`/`esq`/`ice` devem ser `0`; use habilidades.
- **`vel` na escala antiga.** Valores como `60` eram *prioridade de iniciativa* no sistema v2. Hoje `vel` é taxa: use `0.4`–`1.0`.
- **Buff de banco com `durationSeconds` numérico.** Ignorado — o vínculo é com a posição, não com o tempo.
- **DOT/HOT em `magnitude`.** O valor é **por segundo**, não por tick.
- **Habilidade órfã.** Criar o JSON não basta; é preciso referenciá-la em `activeOptions`/`benchOptions`/`passiveAbilityId`.

### Aviso: o motor está duplicado

`supabase/functions/_shared/engine/` é uma **cópia manual** do motor, usada pela Edge Function de PvP (roda em Deno). Mudanças estruturais em `src/engine/` precisam ser espelhadas lá, ou PvE e PvP passam a rodar regras diferentes. Unificar isso é uma tarefa de infra pendente.
