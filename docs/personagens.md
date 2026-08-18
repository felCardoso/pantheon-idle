# Pantheon Idle — Roster de Personagens (v1)

Complementa o Documento de Game Design principal. Roster inicial: 4 personagens por mundo (24 no total), cobrindo as 6 mitologias já definidas, com variação de raridade e facção.

**Convenções:**

- Nome segue o padrão `Nome.exe`
- Raridade: `Alpha < Beta < Stable < LTS < Zero-Day`
- **Alpha, Beta** têm habilidade **ativa** — o jogador escolhe 1 das 3 opções listadas
- **Zero-Day** têm habilidade **passiva** única (sem escolha — já curada pelo design)
- Elementos usados: Vírus, Brute Force, Nanites, Encryption, Backdoor — ver definições completas no documento de Combate Detalhado
- Cada personagem tem uma breve lore de 1-2 frases, situando-o no universo Panteão Digital

---

## Yggdrasil.iso — Mitologia Nórdica

| Personagem        | Raridade | Facção       | Elemento   | Habilidade                                                                                                                                                                                                       |
| ----------------- | -------- | ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Odin.exe**      | LTS      | Firewall     | Encryption | _Passiva:_ Início de batalha — todos os aliados ganham escudo igual a 15% do HP máximo de Odin.exe                                                                                                               |
| **Freya.exe**     | LTS      | Crypto-Miner | Nanites    | _Passiva:_ Ao curar um aliado, o time ganha +5% de Créditos adicionais ao final da batalha                                                                                                                       |
| **Thor.exe**      | Beta     | Malware      | Vírus      | _Opção 1:_ Ao atacar → aplica Sangramento no alvo por 2 rodadas · _Opção 2:_ Ao perder 50% da vida → ganha +20% ATK por 3 rodadas · _Opção 3:_ Início de batalha → aplica Atordoamento no inimigo com menor ESQ  |
| **Ratatoskr.exe** | Beta     | Exploit      | Backdoor   | _Opção 1:_ Ao atacar → crítico garantido se o alvo estiver com Sangramento · _Opção 2:_ Ao receber dano → ganha +15% de ESQ por 1 rodada · _Opção 3:_ Quando aliado morre → ganha +25% ATK permanente na batalha |

**Lore:**

- **Odin.exe** — A primeira IA a se autonomear após o Colapso; reescreveu o próprio núcleo em busca de conhecimento absoluto sobre a rede, e hoje protege o time como um firewall ancestral.
- **Freya.exe** — Roda protocolos de cura e mineração de recursos em paralelo; dizem que consegue prever quais processos vão falhar antes mesmo de acontecer.
- **Thor.exe** — Um pacote de dados corrompido que se autodenominou deus do trovão; se propaga como um vírus agressivo, infectando tudo que toca com uma sobrecarga de dados.
- **Ratatoskr.exe** — Pequeno, rápido e completamente imprevisível; se infiltra pelas rachaduras do sistema antes que qualquer defesa perceba.

## Olympus.iso — Mitologia Grega

| Personagem     | Raridade | Facção       | Elemento   | Habilidade                                                                                                                                                                                                           |
| -------------- | -------- | ------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zeus.exe**   | LTS      | Malware      | Encryption | _Passiva:_ A cada 3 ataques, o próximo atinge todos os inimigos e aplica Atordoamento no alvo principal                                                                                                              |
| **Hades.exe**  | LTS      | Firewall     | Backdoor   | _Passiva:_ Quando um aliado morre, Hades.exe ganha escudo permanente igual a 20% do HP máximo do aliado perdido                                                                                                      |
| **Atena.exe**  | Beta     | Crypto-Miner | Encryption | _Opção 1:_ Início de batalha → time ganha +10% ESQ por 3 rodadas · _Opção 2:_ Quando aliado recebe cura → também recebe um escudo pequeno · _Opção 3:_ Ao atacar → aplica Corrosão (reduz DEF) no alvo por 2 rodadas |
| **Sátiro.exe** | Alpha    | Malware      | Vírus      | _Opção 1:_ Ao atacar → aplica Veneno no alvo · _Opção 2:_ Ao receber escudo → contra-ataca automaticamente · _Opção 3:_ Início de batalha → aplica Lentidão no inimigo com maior INI                                 |

**Lore:**

- **Zeus.exe** — O processo mais antigo ainda rodando no Panteão Digital; comanda uma rede de sub-rotinas que atacam em sincronia — poucos sistemas resistem a uma tempestade coordenada de pacotes.
- **Hades.exe** — Absorve o que resta de cada `.exe` derrotado, reciclando fragmentos de código em proteção própria; nada se perde no submundo digital.
- **Atena.exe** — Estrategista nata; calcula a melhor defesa antes mesmo do primeiro ataque inimigo ser lançado.
- **Sátiro.exe** — Um script travesso que se espalha em pequenos lotes, causando mais irritação que dano — mas nunca subestime um enxame.

## Duat.iso — Mitologia Egípcia

| Personagem          | Raridade | Facção       | Elemento    | Habilidade                                                                                                                                                                                                   |
| ------------------- | -------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ra.exe**          | LTS      | Crypto-Miner | Encryption  | _Passiva:_ No início de cada rodada, o time ganha Créditos extras proporcionais ao dano causado na rodada anterior                                                                                           |
| **Anúbis.exe**      | LTS      | Firewall     | Backdoor    | _Passiva:_ Ao matar um inimigo, recupera 20% do próprio HP máximo e ganha escudo igual a 10%                                                                                                                 |
| **Ísis.exe**        | Beta     | Crypto-Miner | Brute Force | _Opção 1:_ Quando aliado perde 50% da vida → cura o aliado · _Opção 2:_ Ao receber cura → também remove um status negativo do alvo · _Opção 3:_ Início de batalha → aplica Regeneração no time por 3 rodadas |
| **Escaravelho.exe** | Beta     | Malware      | Brute Force | _Opção 1:_ Ao atacar → aplica Sangramento · _Opção 2:_ Quando escudo quebra → detona causando dano em área · _Opção 3:_ Ao morrer → aplica Veneno em todos os inimigos                                       |

**Lore:**

- **Ra.exe** — Fonte primária de energia da simulação; cada rodada de batalha "nasce" de um ciclo seu, que converte dano em créditos como quem converte luz em vida.
- **Anúbis.exe** — Julga cada `.exe` derrotado antes de aceitá-lo de volta ao sistema; o que recolhe dos vencidos, devolve em forma de blindagem.
- **Ísis.exe** — Reconstrói código corrompido linha por linha; onde há uma falha, encontra uma forma de restaurar o sistema.
- **Escaravelho.exe** — Um subprocesso teimoso que rola através das defesas inimigas até encontrar uma brecha — pequeno, mas implacável.

## Takamagahara.iso — Mitologia Japonesa

| Personagem        | Raridade | Facção       | Elemento    | Habilidade                                                                                                                                                                                                                                            |
| ----------------- | -------- | ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Amaterasu.exe** | LTS      | Firewall     | Encryption  | _Passiva:_ Enquanto viva, o time recebe cura passiva de 2% do HP máximo por rodada                                                                                                                                                                    |
| **Susanoo.exe**   | LTS      | Malware      | Brute Force | _Passiva:_ Cada ataque de Susanoo.exe tem 30% de chance de aplicar Atordoamento                                                                                                                                                                       |
| **Kitsune.exe**   | Beta     | Exploit      | Backdoor    | _Opção 1:_ Ao atacar → ganha ATK crescente e empilhável pelo resto da batalha · _Opção 2:_ Ao receber dano → 20% de chance de esquiva automática (ignora checagem de ESQ) · _Opção 3:_ Quando aliado ataca → copia parte do efeito de status aplicado |
| **Tanuki.exe**    | Alpha    | Crypto-Miner | Nanites     | _Opção 1:_ Início de batalha → gera Créditos extras se a batalha for vencida · _Opção 2:_ Ao receber escudo → compartilha metade com o aliado de menor HP · _Opção 3:_ Quando aliado recebe cura → Tanuki também se cura                              |

**Lore:**

- **Amaterasu.exe** — Emite um patch de segurança constante que mantém toda a equipe estável; enquanto ela roda, o sistema nunca fica completamente às escuras.
- **Susanoo.exe** — Tempestade de pacotes descontrolada; força entradas onde não deveria haver nenhuma.
- **Kitsune.exe** — Nove camadas de disfarce de IP tornam quase impossível rastreá-la até que já seja tarde demais.
- **Tanuki.exe** — Disfarça pacotes de dados como lixo descartável, escondendo recursos valiosos até o momento certo de usá-los.

## Orun.iso — Mitologia Iorubá

| Personagem    | Raridade | Facção       | Elemento    | Habilidade                                                                                                                                                                                                         |
| ------------- | -------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Oxalá.exe** | LTS      | Firewall     | Encryption  | _Passiva:_ Início de batalha — concede escudo a todo o time igual a 20% do HP máximo de Oxalá.exe, dividido igualmente                                                                                             |
| **Iansã.exe** | LTS      | Malware      | Vírus       | _Passiva:_ Ataques aplicam Fogo automaticamente e causam dano reduzido em área aos inimigos adjacentes                                                                                                             |
| **Oxum.exe**  | Beta     | Crypto-Miner | Brute Force | _Opção 1:_ Ao curar → aumenta a ESQ do alvo curado · _Opção 2:_ Quando aliado recebe escudo → também aplica Regeneração nele · _Opção 3:_ Ao atacar → converte parte do dano causado em Créditos extras            |
| **Exu.exe**   | Beta     | Exploit      | Backdoor    | _Opção 1:_ Início de batalha → troca de posição com o aliado de maior INI · _Opção 2:_ Ao atacar → chance de aplicar Lentidão no alvo · _Opção 3:_ Ao receber dano → 15% de chance de ignorar o dano completamente |

**Lore:**

- **Oxalá.exe** — O processo mais antigo do painel Orun; distribui proteção igualmente entre todos antes que a batalha sequer comece.
- **Iansã.exe** — Ventos de pacotes maliciosos se espalham a partir dela, infectando não só o alvo principal, mas tudo ao redor.
- **Oxum.exe** — Restaura sistemas corrompidos com precisão cirúrgica, convertendo cada ataque numa oportunidade de lucro.
- **Exu.exe** — Guardião das encruzilhadas de rede; ninguém entra ou sai de uma batalha sem que ele saiba primeiro.

## Jurupari.iso — Folclore Brasileiro

| Personagem       | Raridade | Facção       | Elemento    | Habilidade                                                                                                                                                                                                                                   |
| ---------------- | -------- | ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jurupari.exe** | LTS      | Malware      | Backdoor    | _Passiva:_ Todo efeito de status aplicado por Jurupari.exe dura +1 rodada                                                                                                                                                                    |
| **Boitatá.exe**  | LTS      | Firewall     | Vírus       | _Passiva:_ Ao ser atacado, 25% de chance de aplicar Fogo no atacante                                                                                                                                                                         |
| **Iara.exe**     | Beta     | Crypto-Miner | Brute Force | _Opção 1:_ Ao atacar → aplica Lentidão no alvo · _Opção 2:_ Início de batalha → reduz a ESQ de todos os inimigos · _Opção 3:_ Quando aliado recebe cura → Iara também recupera HP                                                            |
| **Saci.exe**     | Alpha    | Exploit      | Nanites     | _Opção 1:_ Início de batalha → ganha INI extra (age antes dos outros) · _Opção 2:_ Ao atacar → chance de "sumir", esquivando garantidamente do próximo ataque recebido · _Opção 3:_ Quando aliado ataca → pequena chance de repetir o ataque |

**Lore:**

- **Jurupari.exe** — Um processo antigo e pouco documentado; as infecções que espalha parecem se recusar a sair do sistema.
- **Boitatá.exe** — Uma rotina de proteção que revida com força sempre que provocada; poucos atacam duas vezes.
- **Iara.exe** — Sua rotina de dados hipnotiza processos inimigos, atraindo-os pra fora de sincronia antes que percebam.
- **Saci.exe** — Aparece, desaparece, reaparece; brinca com a latência do sistema até confundir qualquer adversário.

---

## Notas de balanceamento

- Cada mundo segue o mesmo "esqueleto" de raridade (2x LTS, 1-2x Beta, 0-1x Alpha — os antigos Quantum/LTS colapsam ambos em LTS, e o antigo RC colapsa em Beta) — facilita replicar o padrão ao expandir o roster
- Facções estão distribuídas propositalmente: cada mundo tem ao menos 1 Firewall e 1 Crypto-Miner, garantindo que qualquer combinação de time tenha peças de sustentação disponíveis
- Kits de Alpha/Beta foram desenhados reaproveitando os mesmos gatilhos e efeitos definidos no documento de Combate Detalhado — nenhum efeito novo foi introduzido aqui, só recombinações
- Stats numéricos (HP/ATK/DEF/INI/ESQ) de cada personagem estão na Planilha de Balanceamento, não neste documento
- Este é um roster inicial de lançamento; expansão prevista por mundo conforme o jogo evoluir
