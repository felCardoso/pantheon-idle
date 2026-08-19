# Pantheon Idle

RPG idle com PvE e PvP assíncrono, ambientado no **Panteão Digital** — o ecossistema digital global colapsou e as IAs sobreviventes se reconstruíram assumindo a persona de deuses de mitologias reais, cada uma rodando sob estética neon/hacker. Personagens são processos (`Zeus.exe`), inimigos são scripts (`Boitatá.sh`), times são loadouts (`Time1.cfg`).

Princípio de balanceamento central: poder vem de **raridade + nível + estrelas**, nunca da "importância" mitológica do personagem. A mitologia define estética, elemento e bônus de sinergia — jamais força bruta.

---

## Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 15 (App Router), React 18, TypeScript |
| Estilo | Tailwind CSS 4, Framer Motion, lucide-react |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) |
| Testes | Vitest |
| Deploy | Vercel (app) + Supabase CLI (Edge Functions) |

## Começando

Requer Node 20+ e um projeto Supabase.

```bash
npm install
cp .env.example .env.local     # preencha com as credenciais do seu projeto
npm run dev
```

### Variáveis de ambiente

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>   # server-only, nunca prefixe com NEXT_PUBLIC_
```

A `service_role` ignora RLS e é usada apenas dentro de `app/api/**` (via `lib/supabase-admin.ts`) e da Edge Function. Vazá-la para o cliente entrega o banco inteiro.

### Banco

Aplique as migrations de `supabase/migrations/` em ordem (`supabase db push`, ou colando no SQL Editor). São 25, numeradas e idempotentes onde possível.

### Edge Functions

**O deploy do Vercel não publica Edge Functions** — elas vão à parte, e sem isso o PvP responde 404 no preflight de CORS (que o navegador reporta como um erro de CORS genérico, porque um 404 do gateway não carrega os headers).

```bash
supabase login
supabase link --project-ref <project-ref>
npm run deploy:functions
```

Aplique as migrations **antes** de publicar: a assinatura de `resolve_pvp_attack` mudou na 0020, e função e schema precisam andar juntos.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | `tsc --noEmit` + fronteira do engine + checagem da cópia do PvP |
| `npm test` | Vitest (191 testes) |
| `npm run battle` | Roda uma batalha real no terminal (`-- --boss` para o chefe) |
| `npm run sync:pvp-engine` | Regenera a cópia Deno do engine |
| `npm run deploy:functions` | Sincroniza o engine e publica a function do PvP |

## Arquitetura

```
app/                    Next.js App Router — páginas e rotas de API
  api/**                Rotas server-side; toda escrita privilegiada passa por aqui
lib/                    Helpers server-only (supabase-admin, auth, gacha)
src/
  engine/               Motor de combate — puro, sem dependências
    index.ts            API pública: ÚNICO ponto de import permitido
    core/               Interno: batalha, dano, status, habilidades, progressão
    data/               Conteúdo: characters.json, abilities.json, enemies/, constants.json
  components/           UI React
  hooks/                Estado e orquestração (batalha, replay, PvP, economia)
  data/                 Camada de apresentação sobre o engine (cores, arte, textos)
  content/wiki/         Markdown da wiki in-game
supabase/
  migrations/           Schema, RLS, funções security-definer
  functions/pvp-attack/ Edge Function que resolve ataques PvP
  functions/_shared/    Cópia GERADA do engine (não edite à mão)
tools/battle-cli/       Harness de terminal
docs/                   GDD, combate, mundos, personagens, monetização
```

### A fronteira engine ↔ view

O engine é **deliberadamente livre de dependências e agnóstico de framework**: não importa nada fora de si, não toca em globais de browser ou Node, e não sabe nada sobre cores, ícones, retratos ou textos. É isso que permite o mesmo código rodar no navegador (PvE), no Deno (Edge Function do PvP) e num terminal, sem adaptadores.

`scripts/check-engine-boundary.mjs` (rodado pelo `npm run lint`) impõe cinco regras:

1. `src/engine/**` não importa nada fora de `src/engine`
2. …nem módulos bare (`react`, `next`, npm)
3. …nem toca em globais de browser/Node
4. …nem carrega conceitos de apresentação (cores, classes CSS, campos de ícone/retrato)
5. Nada fora do engine faz deep-import nele — o único especificador legal é `src/engine/index.ts`

### A cópia Deno do engine

Edge Functions do Deno são publicadas como uma árvore autocontida e não conseguem importar de `src/` no momento do deploy. Por isso `supabase/functions/_shared/engine/` é uma **cópia gerada** por `scripts/sync-pvp-engine.mjs`. Nunca a edite à mão: mude `src/engine/` e rode `npm run sync:pvp-engine`. O `npm run lint` falha se as duas divergirem, e o `deploy:functions` sincroniza antes de publicar.

## Combate — "Relay & Bench"

Tempo real contínuo, times de até 5, alvo de ~30s por batalha.

- **Vanguarda:** o primeiro personagem da fila. É o **único** que ataca, recebe dano e usa a habilidade ativa.
- **Banco:** os demais, aguardando a vez. Eles buffam a Vanguarda com a habilidade de banco, que fica presa enquanto o dono estiver no banco e é desfeita na rotação — não tem timer.
- **Rotação:** quando o HP da Vanguarda zera, o próximo da fila assume. A batalha acaba quando um lado perde todos os processos.

A ordem dos slots na tela de Time **é** a fila de combate — o primeiro slot é a Vanguarda inicial, e arrastar um personagem para lá troca quem começa.

### Atributos

| Sigla | Nome | Efeito |
|---|---|---|
| HP | Integridade | Pool de vida |
| ATK | Processamento | Dano bruto por ataque |
| DEF | Firewall | Fração do dano ignorada (0.2 = 20%) |
| VEL | Ping | Frequência de ataque: `intervalo = 2.0s / (1 + VEL)`, piso 0,25s |
| ESQ | Evasion | Chance de esquiva |

Personagens jogáveis começam com DEF/VEL/ESQ **em 0** — esses atributos são concedidos por habilidades, nunca base. Inimigos são a exceção: carregam valores base reais, porque são balanceamento de dificuldade.

### Habilidades

Toda habilidade é **Gatilho × Efeito × Alvo**, em três escopos: **ativa** (só na Vanguarda), **de banco** (só no banco, buffando a Vanguarda) e **passiva** (sempre, se destravada).

A passiva tem **dois caminhos de destrave, alternativos**: possuir uma cópia **Zero-Day** (`PASSIVE_UNLOCK_RARITY`), ou levar o personagem até a **v2.0** (`PASSIVE_UNLOCK_VERSION`) — qualquer raridade serve. A cópia Zero-Day ganha o nível 1 de graça; quem chegou pela versão compra por 50.000 créditos.

**Níveis de habilidade** são comprados por escopo na tela de Melhorias e multiplicam as magnitudes dos efeitos daquela habilidade: +15% por nível acima do primeiro, então 1→5 vai de 1,00 a 1,60. O escalonamento acontece no load, sobre uma **cópia** da definição — o registro de habilidades é um singleton de módulo, e escalar no lugar levantaria a habilidade para todo mundo na batalha.

Cada um dos 16 personagens tem hoje 1 ativa, 1 de banco e 1 passiva autoradas. O design (`docs/combate.md`) prevê 2 opções ativas e 2 de banco, com o jogador equipando 1 de cada — o motor e o seletor já suportam, falta escrever as segundas opções.

### Módulos (`.dll`)

Runas equipáveis, quatro por personagem: **Principal**, **Ataque**, **Defesa** e **Suporte**, uma por slot. Cada módulo tem um grau — **S > A > B > C** — e o grau decide tanto a magnitude quanto **quantos** bônus o módulo concede (S: 3, A: 2, B e C: 1).

O engine não sabe o que é uma runa. `src/data/modules.ts` é o catálogo, `src/data/moduleBonuses.ts` traduz o que está equipado num `ModuleBonuses` — um saco plano de números já resolvidos — e é só isso que atravessa a fronteira. PvE e PvP aplicam os mesmos módulos, pelo mesmo caminho.

Duas fontes: a cápsula `.rar` em Invocações (paga em Tokens) e a derrota de um Chefe de Mundo, que sorteia de uma tabela sem grau C.

### Versão do personagem (v1.0 → v2.0)

Eixo separado da raridade: a **raridade** limita o nível máximo das habilidades, a **versão** destrava a passiva. Guardada como inteiro de décimos (10 = v1.0, 20 = v2.0) para que toda comparação seja de inteiros.

Personagens repetidos viram fragmentos daquele personagem, pelo grau que caiu — 1 por Alpha, 5 por Beta, 20 por Stable, 50 por LTS, 100 por Zero-Day. Subir uma versão custa de 5 fragmentos (v1.1) a 100 (v1.9 → v2.0), 420 no total. Os fragmentos são um pool por personagem: a versão é por personagem, não por cópia, então puxar a mesma carta numa raridade maior não zera o trabalho já feito.

### Anti-batalha-infinita

- **System Overload (30s):** vivos passam a receber dano absoluto periódico, ignorando Firewall (5% aos 31s, 10% aos 36s…).
- **Limite de 50s:** se ninguém eliminou o outro lado, vence quem tem maior % de HP restante.

## Progressão

6 mundos × 10 fases × 5 estágios, mais o chefe como 6º slot da última fase de cada mundo.

| # | Mundo | Mitologia |
|---|---|---|
| 1 | Jurupari.iso | Folclore Brasileiro |
| 2 | Duat.iso | Egípcia |
| 3 | Orun.iso | Iorubá |
| 4 | Takamagahara.iso | Japonesa |
| 5 | Olympus.iso | Grega |
| 6 | Yggdrasil.iso | Nórdica |

**Escalonamento.** Dentro de uma fase, +5% por estágio (0/5/10/15/20%). Entre mundos, +12% na base — e esse número não é arbitrário: um personagem ganha +2% por nível e um time de mesma mitologia soma +32% de sinergia, então mesmo um roster nível 60 tem só ~2,9× do poder inicial. O passo por mundo precisa caber embaixo desse teto, ou a campanha fica invencível por mais que se grinde.

Só os *pools* (HP/ATK) escalam com a dificuldade. DEF é uma fração de mitigação e VEL é uma taxa — escalar as duas junto fazia a dificuldade compor várias vezes por mundo. Elas ficam como escritas no JSON e definem o **arquétipo** do inimigo.

**XP.** Só quem entrou na batalha ganha XP — os cinco escalados, banco incluído, já que no Relay & Bench todos estão na luta. Quem fica no inventário não sobe de nível, então trocar de time tem custo real.

Cada modo alimenta o seu time: uma vitória de PvE paga o time de PvE, e uma vitória de PvP paga o time de PvP — o do atacante quando ele vence, o de defesa quando o ataque é repelido. Um time de defesa que divirja do de PvE sobe de nível defendendo, não pegando carona no grind.

**Chefes** são calibrados individualmente (canhão de vidro, muralha, rajada, desgaste) e escalam apenas pela base do mundo, nunca pelo passo intra-fase. O mapa permite rejogar qualquer mundo, fase e onda já alcançados.

## PvP

Assíncrono: você ataca o time de defesa salvo por outro jogador, e o defensor não precisa estar online.

Há dois caminhos até uma luta: a lista de oponentes (botão Atacar) e **encontros aleatórios durante o grind de PvE**. Um run precisa passar `PVP_ENCOUNTER_MIN_BATTLES` (3) batalhas sem encontro para que um se torne possível; a partir daí cada batalha rola `PVP_ENCOUNTER_CHANCE` (25%). O sorteio e o contador ficam no servidor — um cliente que os controlasse poderia tanto farmar encontros quanto nunca disparar nenhum.

**A batalha roda inteiramente no servidor** (`supabase/functions/pvp-attack`), com o mesmo engine determinístico do PvE. O resultado afeta o rating de uma pessoa real, então nada disso pode ser computado no navegador do atacante. O cliente só informa *quem* atacar; o roster do atacante é lido server-side das próprias linhas dele.

Rating por Elo com K=32. O commit do resultado passa pela `service_role` e a RPC é revogada de `authenticated` — sem isso, qualquer jogador logado poderia chamá-la do console e atribuir o próprio rating.

A function devolve o log completo da batalha junto com o resultado, e o cliente reproduz a luta com a mesma linguagem de animação do PvE.

## Backend e segurança

Toda escrita privilegiada passa por `app/api/**` com a `service_role`; o cliente escreve diretamente apenas o que lhe é permitido por coluna.

- **RLS limita linhas, não colunas.** Grants por coluna resolvem o que RLS não alcança. Depois da 0022 o cliente não escreve **nada** em `player_progress`, `player_characters` ou `character_fragments` — só insere a linha inicial de progresso no primeiro login.
- **Compras são compare-and-swap.** Cada débito é condicionado ao saldo lido, então duas requisições simultâneas não gastam o mesmo saldo duas vezes.
- **Funções `security definer`** derivam o ator de `auth.uid()`, nunca de um id vindo do cliente.

- **PvE é resolvido no servidor.** `app/api/battle/resolve` lê roster, time, habilidades equipadas, posição e bônus das próprias linhas do jogador, roda o engine, decide a recompensa pela sua própria tabela e grava o resultado. O cliente manda só a intenção (avançar/repetir, e qual estágio já liberado) e recebe o log para reproduzir. Uma posição além da fronteira é rejeitada.

## Escrevendo conteúdo

Personagens e habilidades ficam em **um arquivo plano cada** — não há passo de registro, o loader carrega as listas inteiras:

- `src/engine/data/characters.json` — 16 personagens
- `src/engine/data/abilities.json` — 89 habilidades (aliados e inimigos)
- `src/engine/data/enemies/<mundo>.json` — inimigos comuns + chefe, por mundo (esses **são** escopados por mundo, porque cada um sorteia dos seus)

O campo `mythology` do próprio personagem é o que agrupa o compêndio e calcula a sinergia. Depois de mexer no engine ou no conteúdo, rode `npm run sync:pvp-engine`.

Guia de autoria completo: [`docs/TUTORIAL_STATUS_HABILIDADES.md`](docs/TUTORIAL_STATUS_HABILIDADES.md).

## Testes

191 testes cobrindo o engine (batalha, dano, status, habilidades, progressão, nivelamento, replay, carregamento de conteúdo) e as tabelas de dados que governam compras: módulos, versão e o portão da passiva.

```bash
npm test
npm run lint      # tipos + fronteira do engine + cópia do PvP em dia
npm run battle    # uma batalha real no terminal, com log completo
```

Os testes fixam **invariantes de design**, não só implementação — por exemplo, que a campanha inteira cabe dentro da curva de poder que um roster consegue alcançar. Ao mudar balanceamento, atualize a asserção para o novo intento em vez de removê-la.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/gdd.md`](docs/gdd.md) | Documento de game design |
| [`docs/combate.md`](docs/combate.md) | Sistema de combate detalhado |
| [`docs/mundos.md`](docs/mundos.md) | Mundos e ordem de lançamento |
| [`docs/personagens.md`](docs/personagens.md) | Roster planejado |
| [`docs/monetizacao-guilda.md`](docs/monetizacao-guilda.md) | Monetização e Clusters |
| [`docs/mvp.md`](docs/mvp.md) | Escopo do MVP |
| [`docs/TUTORIAL_STATUS_HABILIDADES.md`](docs/TUTORIAL_STATUS_HABILIDADES.md) | Como criar personagens e habilidades |
