# Pantheon Idle — Inimigos (v1)

Complementa o Documento de Game Design principal e o Sistema de Combate Detalhado. Cobre os inimigos comuns (reaproveitados entre mundos, com reskin temático) e o boss de cada mundo.

**Convenções:**
- Inimigos usam o mesmo motor de combate dos jogadores (mesmos atributos, elementos, efeitos de status — ver Combate Detalhado)
- Inimigos **não escolhem habilidade dinamicamente**: cada um tem um kit fixo
- Inimigo comum: **1 habilidade ativa fixa** (às vezes +1 passiva)
- Boss: **2 ou mais habilidades**
- Dentro de uma fase, os 5 estágios escalam count/stats dos mesmos arquétipos comuns; o boss aparece só no estágio final da última fase do mundo

---

## Arquétipos de inimigo comum (reskinados por mundo)

Reutilizados em todos os mundos com nome/visual adaptado à mitologia local, mas mesma função mecânica — acelera a criação de conteúdo sem parecer repetitivo (skin muda, função não).

| Arquétipo | Papel | Elemento típico | Habilidade |
|---|---|---|---|
| **Script Kiddie** | Populador de horda — aparece em grande quantidade nos primeiros estágios | Vírus | Ataque básico; chance pequena de aplicar Lentidão |
| **Firewall Turret** | Tanque comum | Encryption | Início de batalha → ganha escudo próprio (única exceção visível à regra de DEF 0, já que é um "posto fixo", não uma IA completa) |
| **Corrupted Daemon** | Dano contínuo | Vírus / Brute Force | Ao atacar → aplica Sangramento ou Corrosão (Brute Force) no alvo |
| **Rogue Process** | Rápido/evasivo | Backdoor | Alta INI/ESQ; ao atacar → chance de agir de novo na mesma rodada |

### Escalonamento por estágio (dentro de uma fase de 5 estágios)

| Estágio | Composição sugerida |
|---|---|
| 1 | 2–3 Script Kiddies |
| 2 | 3 Script Kiddies + 1 Firewall Turret |
| 3 | 2 Script Kiddies + 1 Corrupted Daemon + 1 Firewall Turret |
| 4 | 1 de cada arquétipo (mini-time completo) |
| 5 | Versão reforçada do estágio 4 (stats maiores) — ou o boss do mundo, se for a última fase |

---

## Bosses (um por mundo, aparece ao final da última fase)

Personagens antagonistas — não fazem parte do roster jogável. Ao serem derrotados, concedem o `.iso` do próximo mundo.

### Yggdrasil.iso — Fenrir.exe
**Lore:** O lobo que os nórdicos temiam devorar o próprio sistema solar digital — Fenrir.exe é um processo que nunca parou de crescer desde o Colapso, consumindo tudo que tenta contê-lo.
- **Habilidade 1:** Ao perder 30% da vida → ganha +30% ATK e +20% INI pelo resto da batalha (fica mais perigoso quanto mais fraco)
- **Habilidade 2:** A cada 4 rodadas → ataca todo o time inimigo, aplicando Sangramento

### Olympus.iso — Medusa.exe
**Lore:** Um exploit visual que "petrifica" qualquer processo que olhe direto pro seu código-fonte — Medusa.exe é temida menos pelo dano e mais pelo controle que exerce sobre a batalha.
- **Habilidade 1:** Início de batalha → aplica Atordoamento no personagem de maior ATK do time inimigo
- **Habilidade 2:** Ao ser atacado → 20% de chance de aplicar Atordoamento no atacante (contra-controle)

### Duat.iso — Set.exe
**Lore:** O caos que sempre rondou o painel egípcio — Set.exe corrompe deliberadamente os próprios aliados de Ra e Anúbis sempre que pode, e é o motivo pelo qual o mundo egípcio precisa de vigilância constante.
- **Habilidade 1:** Ao atacar → aplica Corrosão (Brute Force) no alvo, reduzindo a DEF por 3 rodadas
- **Habilidade 2:** Quando um aliado (dele) morre → Set.exe ganha um escudo grande e +ATK permanente (se alimenta do caos)

### Takamagahara.iso — Yamata-no-Orochi.exe
**Lore:** Uma serpente de oito processos paralelos rodando como se fossem um só — dizem que derrotar uma "cabeça" só faz as outras sete ficarem mais rápidas.
- **Habilidade 1:** Início de batalha → ataca todos os inimigos simultaneamente com dano reduzido (reflete as "8 cabeças")
- **Habilidade 2:** Ao perder 50% da vida → aplica Vírus em todo o time inimigo (a "serpente" se espalha)

### Orun.iso — Ogum.exe
**Lore:** Forjado em ferro digital, Ogum.exe é o processo de guerra mais antigo do painel Orun — direto, implacável, sem nenhuma habilidade "sutil".
- **Habilidade 1:** Ao atacar → dano aumentado contra o alvo com menor HP restante (executor)
- **Habilidade 2:** A cada 3 rodadas → ignora Encryption do alvo (Backdoor raro) e causa dano direto ao HP

### Jurupari.iso — Anhangá.exe
**Lore:** O espírito mais temido da mata digital — Anhangá.exe não ataca com força bruta, prefere corromper lentamente até que o time inimigo já não consiga se recuperar.
- **Habilidade 1:** Início de batalha → aplica Enfraquecimento em todo o time inimigo
- **Habilidade 2:** Ao curar (o próprio Anhangá se cura de dano recebido) → também aplica Vírus no atacante

---

## Notas de expansão

- Cada mundo pode receber inimigos exclusivos (não-reskin) conforme o roster crescer — os arquétipos acima cobrem o lançamento inicial
- Bosses de eventos (via `.key`, "chefe rotativo") podem reaproveisar os bosses de mundo acima com stats/drops ajustados, ou ganhar bosses exclusivos de evento no futuro
- Stats numéricos de inimigos (HP/ATK/DEF/INI/ESQ por estágio) ainda não foram calibrados — pendente de teste junto com a Planilha de Balanceamento
