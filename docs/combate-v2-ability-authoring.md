# Guia de autoria de habilidades (combate v2)

Referência técnica para escrever entradas em `src/engine/data/abilities/*.json`
e ligá-las a um personagem em `src/engine/data/characters/*.json`. Complementa
`docs/combate.md` (o design doc) — este arquivo é sobre a forma exata dos
dados, não sobre balanceamento ou lore.

O motor interpreta toda habilidade pelo padrão **Gatilho × Efeito × Alvo**:
um `AbilityDefinition` tem um `trigger` (quando dispara) e uma lista de
`effects`, cada um com seu próprio `target` (quem é afetado). Não existe
lógica hardcoded por personagem — adicionar uma habilidade é só adicionar
dados.

## Convenção `activeOptions` / `passiveAbilityId`

Cada personagem em `characters/*.json` tem:

```json
{
  "id": "medusa",
  "activeOptions": ["medusa-petrificar"],
  "passiveAbilityId": null
}
```

- **`activeOptions`** — lista de ids de habilidades `"kind": "active"` que o
  personagem pode equipar. O jogador equipa exatamente uma por vez (ver
  `CharacterDetailModal.tsx`'s picker); o motor resolve para
  `selectedAbilityId` se ele apontar pra um id realmente presente em
  `activeOptions`, senão cai pro primeiro (`activeOptions[0]`) — ver
  `loader.ts`'s `resolveCombatantAbilities`. **Hoje todo personagem tem no
  máximo 1 entrada** (a migração do v1 pro v2 preservou a habilidade única de
  cada um, ou a trimmou pra 1 no caso de Medusa/Hércules/Minotauro/Amaterasu,
  que tinham várias sempre-ativas). Adicionar mais candidatas é só apendar
  mais ids nessa lista — a UI de seleção já suporta qualquer quantidade.
- **`passiveAbilityId`** — id de uma habilidade `"kind": "passive"`, opcional.
  Só fica ativa para o jogador se o exemplar possuído tiver rarity **LTS ou
  Zero-Day** (`PASSIVE_UNLOCK_RARITY` em `engine/schema.ts`); inimigos
  ignoram esse gate e sempre a usam se definida. Nenhum personagem tem uma
  hoje — é infraestrutura pronta pra quando você autorar a primeira.

Depois de adicionar/editar `activeOptions`/`passiveAbilityId`, registre a
descrição em `src/data/characterInfo.ts`'s `abilityFlavor`, chaveada pelo
**id da habilidade** (não por posição):

```ts
medusa: {
  lore: '...',
  abilityFlavor: {
    'medusa-petrificar': { name: 'Olhar Petrificante', description: '...' },
    'medusa-veneno': { name: 'Presas Venenosas', description: '...' }, // nova opção
  },
},
```

Um id sem entrada em `abilityFlavor` ainda funciona — a UI cai pro `name` da
própria `AbilityDefinition` e uma descrição genérica — mas vale sempre
preencher pra uma boa experiência.

## Tabela de gatilhos (`AbilityTrigger`)

| id (`schema.ts`) | rótulo do doc | quando dispara | campos extras em `TriggerContext` |
| --- | --- | --- | --- |
| `battleStart` | Boot Sequence | uma vez, início da batalha | — |
| `roundStart` | Loop Start | início de cada clash (line-up vs line-up), pra todos os vivos dos dois lados | — |
| `roundEnd` | Loop End | fim de cada clash, pra todos os vivos | — |
| `constant` | Background Service | não é um evento real — equivale a `battleStart` com efeitos `duration: 'permanent'` | — |
| `preAttack` | Pre-Execution | antes do ataque básico de `self` resolver | `defender` |
| `onAttack` | Execution | depois do ataque básico de `self` resolver (não o substitui) | `defender`, `attackResult` |
| `postAttack` | Post-Execution | logo após `onAttack`, mesmo contexto | `defender`, `attackResult` |
| `onCounter` | Counter | quando `self` é atacado (chamado no defensor, não no atacante) | `attacker`, `attackResult` |
| `onWounded` | Data Loss | quando `self` perde HP, qualquer origem | — |
| `onHalfHp` | Critical Sector | primeira vez que o HP de `self` cruza 50% do máximo (dispara uma vez só) | — |
| `onDeath` | System Failure | quando `self` morre | — |
| `onKill` | Process Terminated | quando o ataque de `self` mata o alvo | `defender` |
| `onShieldReceived` | Firewall Active | quando `self` recebe escudo | — |
| `onShieldBreak` | Firewall Breach | quando o escudo de `self` é zerado por dano | — |
| `onHealReceived` | Nanites Received | quando `self` recebe cura | — |
| `onAllyAttack` | Co-op Processing | quando um aliado de `self` ataca | — |
| `onFrontAllyWounded` | Proxy Defense | quando o aliado na frente de `self` na fila perde HP | — |
| `onAllyWounded` | Network Breach | quando qualquer aliado de `self` perde HP | — |
| `onAllyDeath` | Node Offline | quando qualquer aliado de `self` morre | — |
| `onAllyShieldReceived` | Network Firewall | quando qualquer aliado de `self` recebe escudo | — |
| `onAllyShieldBreak` | Network Breach (Escudo) | quando o escudo de um aliado de `self` é zerado | — |
| `onAllySpawned` | Instance Spawned | inerte — sem mecânica de invocação implementada ainda | — |
| `onAllyAppliedTrojan` / `onAllyAppliedLeak` / `onAllyAppliedCrash` | Echoes | quando um aliado de `self` aplica esse status com sucesso em alguém | — |
| `onDodge` | Ghosting | quando `self` esquiva de um ataque | `attacker` |
| `onPingAdvantage` | Ping Advantage | quando `self` vence a prioridade de Ping no próprio clash | — |
| `onCriticalHit` | — (só motor, sem equivalente no doc v2) | quando o próprio ataque de `self` critica | `defender`, `attackResult` |

`self`, `allies`, `enemies`, `rng` e `log` sempre existem em todo
`TriggerContext`. `allies`/`enemies` são as filas vivas do próprio lado de
`self`, já reordenadas pelos clashes (`allies[0]` é sempre quem está na
frente) — é o que os targets `frontAlly`/`onFrontAllyWounded` usam.

## Tabela de alvos (`TargetSelector`)

| id | resolve para |
| --- | --- |
| `self` | o próprio `self` |
| `attacker` | `context.attacker` (só existe em `onCounter`/`onDodge`) |
| `defender` | `context.defender` (só existe em `onAttack`/`postAttack`/`onKill`/`onCriticalHit`) |
| `allEnemies` | todos os inimigos vivos |
| `allAllies` | todos os aliados vivos (inclui `self`) |
| `lowestHpAlly` | aliado vivo com menor HP atual |
| `highestAtkAlly` | aliado vivo com maior ATK |
| `frontAlly` | `allies[0]` — quem está na frente da fila |
| `randomAlly` | um aliado vivo aleatório |
| `lowestEsqEnemy` | inimigo vivo com menor Evasion |
| `highestIniEnemy` | inimigo vivo com maior Ping |
| `randomEnemy` | um inimigo vivo aleatório |

Um selector que não tem contexto disponível (ex.: `defender` num trigger que
não passa `defender`) resolve pra lista vazia — o efeito simplesmente não
aplica em ninguém, sem erro.

## Referência de efeitos (`AbilityEffect`)

Todo efeito tem `type`, `target`, e (exceto `dispel`) `magnitude`.

### `Magnitude`

```ts
{ kind: 'flat'; value: number }                                    // valor fixo
{ kind: 'percent'; value: number }                                 // % — uso varia por efeito
{ kind: 'percentOfMaxHp'; percent: number }                        // % do HP máximo do ALVO
{ kind: 'percentOfBaseAtk'; basePercent: number; perStarBonus?: number } // % do ATK base de quem tem a habilidade, +perStarBonus por estrela
{ kind: 'triggeringDamage' }                                       // reusa o dano do attackResult que causou o gatilho
```

### `applyStatus`

```ts
{
  type: 'applyStatus',
  target: TargetSelector,
  status: StatusType,           // 'leak'|'trojan'|'crash'|'fragmentation'|'nanites'|'throttling'|'lag'|'target'|'buffAtk'|'buffDef'|'buffIni'|'buffEsq'|'buffIce'
  duration: number | 'default', // 'default' usa statusDefaultDurations (constants.json)
  magnitude: Magnitude,
  ignoresDef?: boolean,
  ignoresShield?: boolean,
  stacks?: boolean,
}
```

### `heal`

```ts
{ type: 'heal', target: TargetSelector, magnitude: Magnitude }
```

### `grantShield`

```ts
{ type: 'grantShield', target: TargetSelector, magnitude: Magnitude }
```

### `directDamage`

Dano independente do ataque básico — sempre acerta (sem rolagem de esquiva).

```ts
{
  type: 'directDamage',
  target: TargetSelector,
  magnitude: Magnitude,
  ignoresDef?: boolean,
  ignoresShield?: boolean, // estilo Backdoor: ignora escudo, vai direto no HP
}
```

### `buffAttribute`

```ts
{
  type: 'buffAttribute',
  target: TargetSelector,
  attribute: 'atk' | 'def' | 'ini' | 'esq' | 'ice',
  duration: number | 'default' | 'permanent',
  magnitude: Magnitude, // % — negativo = debuff (ex.: reduzir Firewall de um inimigo)
}
```

### `dispel`

Quebra status ativos do alvo em vez de aplicar um novo.

```ts
{
  type: 'dispel',
  target: TargetSelector,
  statuses?: StatusType[], // omitido = remove o bucket inteiro (debuffs OU buffs, o que o alvo tiver)
}
```

## Exemplo completo trabalhado

Uma habilidade nova, usando uma combinação ainda não usada por nenhum
personagem hoje: gatilho `onWounded` + efeito `grantShield` em `self`. Pronta
pra colar em `src/engine/data/abilities/<mundo>.json` (mais o mirror em
`supabase/functions/_shared/engine/data/abilities/<mundo>.json`):

```json
{
  "id": "exemplo-protocolo-emergencial",
  "name": "Protocolo Emergencial",
  "kind": "active",
  "trigger": "onWounded",
  "chance": 0.3,
  "effects": [
    {
      "type": "grantShield",
      "target": "self",
      "magnitude": { "kind": "percentOfMaxHp", "percent": 0.15 }
    }
  ]
}
```

Leitura: toda vez que este personagem perde HP (`onWounded`), 30% de chance
(`chance: 0.3`) de conceder a si mesmo um escudo equivalente a 15% do próprio
HP máximo. Pra equipar num personagem, adicione o id em `activeOptions`:

```json
{ "id": "meu-personagem", "activeOptions": ["exemplo-protocolo-emergencial"] }
```

E registre a flavor text em `characterInfo.ts`:

```ts
'exemplo-protocolo-emergencial': {
  name: 'Protocolo Emergencial',
  description: 'Ao sofrer dano, 30% de chance de conceder um escudo equivalente a 15% do próprio HP máximo.',
},
```

Depois de adicionar uma habilidade nova: espelhe o arquivo JSON em
`supabase/functions/_shared/engine/data/abilities/` (mesmo conteúdo, os dois
engines leem o mesmo formato), rode `npx tsc --noEmit` e `npx vitest run`, e
teste numa batalha via CLI (`npx tsx src/engine/cli/runBattle.ts`) ou no
navegador.
