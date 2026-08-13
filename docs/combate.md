# Pantheon Idle — Sistema de Combate Detalhado (v1)

Complementa o Documento de Game Design principal (seção 4 lá é só um resumo — este é o detalhamento completo). Contexto narrativo: cada batalha é uma **simulação de combate rodada pelas IAs**, e cada personagem é a persona `.exe` de uma IA lutando pelo seu time dentro dessa simulação — isso justifica tanto o vocabulário técnico (elementos como tipos de malware/segurança) quanto a mecânica de "morte" (um `.exe` derrotado é ejetado da simulação, não apagado).

---

## 1. Formato geral

- **Tempo real**, com velocidade 2x disponível para o jogador acelerar
- **PvP sempre roda em tempo real**, sem opção de acelerar (evita vantagem injusta de quem acelera contra quem não pode reagir)
- **Times de até 5 personagens** por lado
- **Duração alvo:** ~30s em fases fáceis, aumentando em fases mais difíceis conforme HP/DEF dos inimigos escalam

## 2. Atributos base

| Atributo | Função | Observações |
|---|---|---|
| **HP** | Vida | Reduzida a 0 = personagem ejetado da simulação (derrotado) |
| **ATK** | Dano base | Multiplicado por modificadores de habilidade, elemento e sinergia |
| **DEF** | Redução de dano | **Todos os personagens começam com DEF 0.** Só sobe via habilidade própria ou Módulos (`.dll`) — isso é proposital: DEF é um investimento ativo, não um stat passivo de todo personagem |
| **INI** | Iniciativa | Define a ordem de ação (quem "compila" primeiro). Se o personagem que iria agir depois for derrotado antes de sua vez, a ação dele é cancelada e não causa dano |
| **ESQ** | Esquiva | Chance percentual de desviar completamente de um ataque recebido. Melhorável via habilidade ou Módulos |

### Escudo (mecânica transversal, não é atributo)

Escudo é um valor temporário que absorve dano antes do HP. Não é um atributo permanente do personagem — só existe quando concedido por uma habilidade (própria, de aliado, ou de Módulo). Pontos relevantes:
- Escudo absorve dano até se esgotar; dano excedente "vaza" pro HP
- Gatilhos como "ao receber escudo" e "quando escudo quebra" (já definidos no design) disparam a partir dessa mecânica
- Vírus e Brute Force interagem com escudo de formas diferentes (ver seção 4)

## 3. Elementos (afinidade cyberpunk)

Repensados como **tipos de código malicioso ou defensivo**, coerente com o conceito de batalha-como-simulação — nada de "fogo" ou "água": cada elemento representa uma ação real que uma IA tomaria contra outra.

| Elemento | O que é | Efeito mecânico |
|---|---|---|
| **Vírus** | Malware que infecta o `.exe` alvo | Aplica dano por rodada (infecção que corrói o sistema aos poucos) |
| **Brute Force** | Malware que força a entrada quebrando proteções | Reduz a DEF do alvo (percentual ou valor mínimo) |
| **Nanites** | Antivírus fictício | Cura/repara o `.exe` — puro suporte, sem dano direto |
| **Encryption** | Camada de proteção do `.exe` | Bloqueia Backdoor por completo; dificulta (reduz efetividade de) Brute Force |
| **Backdoor** | Acesso oculto no código | Ignora escudo por completo ao causar dano — efeito raro, só em habilidades específicas |

### Relações de contraponto

Em vez de um ciclo genérico tipo pedra-papel-tesoura, os contrapontos seguem lógica literal de segurança da informação:

- **Nanites cura/limpa infecções de Vírus** — um antivírus combatendo malware é a relação mais direta possível
- **Encryption bloqueia Backdoor e resiste a Brute Force** — criptografia forte é a defesa natural contra acesso não autorizado e ataques de força bruta
- **Vírus e Brute Force são os dois ataques ofensivos "puros"**, sem contraponto direto entre si — competem só em dano bruto/valor de debuff

Vantagem elemental concede bônus de dano (sugestão: +25%) quando um elemento tem contraponto natural contra o alvo (ex: um Vírus aplicado por quem tem alta afinidade Encryption pode causar um bônus adicional contra alvos sem proteção). Não é obrigatória pra montar um time competitivo — é uma camada extra de otimização.

## 4. Efeitos de status

| Efeito | Comportamento | Atributo afetado |
|---|---|---|
| **Vírus** *(status, ligado ao elemento)* | Dano por rodada (valor = dano do ataque que aplicou) | HP |
| **Sangramento** | Dano fixo por rodada, ignora DEF, empilhável (stacks) | HP |
| **Veneno** | Tira vida por rodada, ignorando escudos | HP |
| **Atordoamento** | Perde a próxima ação | Ação/turno |
| **Enfraquecimento** | Reduz ATK em X% por N rodadas | ATK |
| **Corrosão / Brute Force** | Reduz DEF em X% ou valor mínimo | DEF |
| **Lentidão** | Reduz INI em X% (atrasa a barra de ação) | INI |
| **Regeneração** | Cura fixa por rodada (Nanites) — contraponto de Sangramento/Veneno/Vírus | HP |
| **Marcado** | Próximo ataque recebido tem crítico garantido | — (sinergiza com gatilhos "ao atacar"/"quando aliado ataca") |

Cada efeito mexe diretamente em um dos 5 atributos base ou na ação/turno — mantém o sistema simples de expandir no futuro sem precisar criar novos atributos.

## 5. Sinergia mitológica

Bônus de atributos (HP/ATK) por quantidade de personagens da **mesma mitologia** no time (independe do elemento):

| Nº de personagens | Bônus |
|---|---|
| 2 | +5% |
| 3 | +12% |
| 4 | +21% |
| 5 | +32% |

## 6. Habilidades

- Personagens de raridade **Stable ou acima têm 1 habilidade passiva** única (curada pelo design, sem escolha do jogador)
- Personagens **Alpha, Beta ou RC têm habilidade ativa**, com **3 opções** que o jogador escolhe (fixa até redefinir)
- Geração das 3 opções: matriz de **Gatilho × Efeito × Alvo**, curada manualmente por personagem — não randômica pro jogador. Isso acelera o design (montar combinações a partir de peças já existentes) sem parecer genérico, porque o design escolhe quais combinações fazem sentido pra cada personagem

### Gatilhos disponíveis

Início de batalha · ao morrer · ao perder 50% da vida · ao receber escudo · ao atacar · quando aliado ataca · quando escudo quebra · quando aliado recebe escudo · quando recebe cura

### Efeitos disponíveis (pra combinar com os gatilhos acima)

Dano direto · aplicar status (Vírus, Sangramento, Atordoamento, Enfraquecimento, Corrosão/Brute Force, Lentidão, Marcado) · cura · escudo · buff de atributo (ATK/DEF/INI/ESQ) · debuff de atributo

### Alvos possíveis

Self · 1 aliado (menor HP / maior ATK / aleatório) · todos os aliados · 1 inimigo (menor ESQ / maior INI / aleatório) · todos os inimigos

## 7. PvE — anti-rodada-infinita

- Limite de rodadas (sugestão: 40–50)
- A partir de uma rodada de corte (sugestão: rodada 30), aplicar dano verdadeiro crescente por rodada em todos os personagens vivos (efeito "enrage") — cresce a cada rodada (ex: 2% do HP máximo na rodada 30, 4% na 31, 8% na 32...)
- Se o limite absoluto for atingido mesmo assim, vence o time com maior % de HP total restante — nunca um empate arbitrário

## 8. IA dos inimigos

- Usa o mesmo motor de combate dos jogadores (mesmos atributos, elementos, efeitos de status)
- **Não escolhe habilidades dinamicamente** — cada inimigo tem um kit fixo definido pelo design:
  - Inimigo comum: 1 habilidade ativa fixa (e talvez 1 passiva)
  - Boss: pode ter mais de uma habilidade
