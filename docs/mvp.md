# Pantheon Idle — MVP: Fórmula de Dano e Calibração (v1)

Complementa o Combate Detalhado. Define a fórmula final de dano (que faltava) e calibra números reais pra um recorte jogável: **Jurupari.iso** completo — os 4 personagens do mundo, os inimigos comuns reskinados e o boss Anhangá.exe. Escolhi esse mundo porque cobre as 4 facções, os dois tipos de habilidade (passiva/ativa) e testa a sinergia mitológica no time completo (4 personagens = +21%).

---

## 1. Stat oculto novo: Crítico

Os Módulos (`.dll`) já foram desenhados com bônus de "Crítico" (seção de progressão do GDD), mas o atributo nunca foi formalizado — fechando isso agora:

- **Chance de Crítico:** todo personagem começa com **5%** base
- **Multiplicador de Crítico:** dano crítico é **150%** do dano normal (fixo, não escala por enquanto)
- Aumentado apenas por Módulos (`.dll`) ou habilidades específicas

## 2. Fórmula de dano (ordem de resolução)

1. **Checagem de Esquiva:** rola contra o ESQ do alvo. Se acertar, o ataque erra completamente (dano final = 0) e nenhum efeito de status é aplicado
2. **Dano bruto:** `ATK do atacante × multiplicador da habilidade` (ataque básico = 100% ATK; habilidades podem valer mais ou menos, ex: "150% ATK")
3. **Mitigação por DEF:** `Dano_pós_DEF = Dano_bruto × (100 / (100 + DEF do alvo))` — fórmula de retornos decrescentes (mesmo princípio usado em MOBAs): com DEF 0 não há redução nenhuma; DEF 100 reduz o dano pela metade; nunca zera o dano completamente
4. **Checagem de Crítico:** rola contra a chance de Crítico do atacante. Se acertar, `× 1.5`
5. **Vantagem elemental:** se o elemento do atacante tem contraponto natural contra o alvo (ver Combate Detalhado, seção 3), `× 1.25`
6. **Destino do dano:** se o atacante tem a habilidade **Backdoor** usada nesse ataque, ignora escudo e vai direto pro HP; caso contrário, absorve escudo primeiro, e o excedente vai pro HP

*(Sinergia mitológica não entra aqui — ela já aumenta HP/ATK na origem, então seu efeito já está embutido no "ATK do atacante" usado no passo 2.)*

## 3. Durações padrão de efeito (preenchendo os "N rodadas" genéricos)

| Categoria | Duração padrão |
|---|---|
| Dano contínuo (Vírus, Sangramento, Veneno) | 3 rodadas |
| Debuff de atributo (Enfraquecimento, Corrosão/Brute Force, Lentidão) | 2 rodadas |
| Atordoamento | 1 rodada (perde a próxima ação) |
| Regeneração | 3 rodadas |
| Marcado | até o próximo ataque recebido (sem limite de rodada) |

## 4. Stats calibrados — Jurupari.iso

Direto da Planilha de Balanceamento (stats base por raridade, nível 1, 0 estrelas):

| Personagem | Raridade | Facção | Elemento | HP | ATK | DEF | INI | ESQ |
|---|---|---|---|---|---|---|---|---|
| **Jurupari.exe** | Quantum | Malware | Backdoor | 3000 | 300 | 0 | 110 | 10% |
| **Boitatá.exe** | LTS | Firewall | Vírus | 2200 | 220 | 0 | 100 | 9% |
| **Iara.exe** | RC | Crypto-Miner | Brute Force | 1300 | 130 | 0 | 90 | 7% |
| **Saci.exe** | Alpha | Exploit | Nanites | 800 | 80 | 0 | 80 | 5% |

## 5. Habilidades calibradas (valores reais em vez de placeholder)

### Jurupari.exe (passiva)
"Todo efeito de status aplicado por Jurupari.exe dura **+1 rodada**" — já concreto, sem alteração.

### Boitatá.exe (passiva)
"Ao ser atacado, **25%** de chance de aplicar Vírus no atacante" *(nota: o texto original mencionava "Fogo" — ajustado pra "Vírus", que é o status de dano por rodada equivalente no sistema atual)*, com duração padrão de 3 rodadas (regra da seção 3).

### Iara.exe (ativa — Opção 1 escolhida pro MVP)
"Ao atacar → aplica **Lentidão** no alvo, reduzindo INI em **20%** por **2 rodadas**"

### Saci.exe (ativa — Opção 1 escolhida pro MVP)
"Início de batalha → ganha **+30 INI** (30% acima do próprio valor base) pelo resto da batalha"

*(As outras 2 opções de cada personagem Alpha/Beta/RC continuam disponíveis conforme os documentos de Roster — aqui só fixei 1 de cada pra ter um build jogável imediato no MVP.)*

## 6. Inimigos comuns calibrados — Jurupari.iso

Usando os arquétipos do documento de Inimigos, com stats propostos pro Estágio 1 (fase 1) desse mundo, escalando +15% por estágio dentro da mesma fase:

| Arquétipo | HP | ATK | DEF | INI | ESQ | Habilidade |
|---|---|---|---|---|---|---|
| **Script Kiddie** (folclore: "Mula-sem-Cabeça.sh") | 200 | 30 | 0 | 60 | 3% | Ataque básico; 10% de chance de aplicar Lentidão (20%, 2 rodadas) |
| **Firewall Turret** (folclore: "Caipora.sh") | 600 | 20 | 30 | 40 | 2% | Início de batalha → ganha escudo igual a 20% do próprio HP máximo |
| **Corrupted Daemon** (folclore: "Curupira.sh") | 350 | 50 | 0 | 70 | 4% | Ao atacar → aplica Sangramento (dano fixo de 15/rodada, ignora DEF, 3 rodadas) |

*(Nomes com sufixo `.sh` aqui são só apelido temático de inimigo — não confundir com o item real `.sh`, que é exclusivamente consumível, conforme já definido no sistema de itens.)*

## 7. Boss calibrado — Anhangá.exe

| Stat | Valor |
|---|---|
| HP | 12.000 (equivalente a ~4x o HP de um personagem Quantum — pensado pra durar vários turnos contra um time de 5) |
| ATK | 250 |
| DEF | 50 |
| INI | 95 |
| ESQ | 6% |

- **Habilidade 1** (início de batalha): aplica Enfraquecimento em todo o time inimigo — reduz ATK em **15%** por 2 rodadas
- **Habilidade 2** (ao curar — Anhangá se cura 10% do HP máximo sempre que causa dano crítico): sempre que essa cura acontece, também aplica Vírus no atacante que causou o dano crítico

## 8. Próximos passos pra validar isso

- Simular 1 combate completo (time de 4 do jogador vs. os 3 inimigos comuns) manualmente ou em planilha, pra ver se a duração média fica perto dos ~30s alvo (em número de rodadas, não segundos reais — isso depende da velocidade de animação, que é decisão de implementação)
- Depois de validado nesse recorte, replicar a mesma lógica de calibração (stats base por raridade já está pronta na planilha) pros outros 5 mundos
