# Pantheon Idle — Monetização e Guilda (v1)

Complementa o Documento de Game Design principal.

---

## 1. Monetização — "Root Access" (assinatura VIP)

Nome temático pensado pro conceito de hacking/permissões de sistema: assinar VIP é literalmente ganhar **acesso root** — o nível de permissão mais alto de um sistema.

### Estrutura

- **Assinatura mensal recorrente**, cobrada em dinheiro real
- Benefícios enquanto ativa:
  - Acesso aos **3 slots extras de `.cfg`** (já definidos no sistema de itens — hoje mencionados como "3 slots que VIP tem direito enquanto for VIP")
  - Bônus diário de Tokens (moeda hard) só por logar
  - **+X% de Créditos e XP** passivos (sugestão: 15%, calibrar depois nos testes) — separado e cumulativo com o bônus de guilda (seção 2)
  - **Acesso ao Mercado de Diagramas**: só assinantes de Root Access podem **publicar ofertas de venda ou comprar `.dat`** (fragmentos de personagens duplicados) de outros jogadores — sua ideia original, mantida como o "core" da monetização

### Por que gatear o Mercado de Diagramas especificamente

- Não é pay-to-win direto (não vende poder — vende **velocidade** de progressão, já que `.dat` acelera evolução de personagens que o jogador já tem)
- Cria uma razão orgânica pra manter a assinatura ativa além dos bônus passivos: quem quer negociar duplicados precisa estar com Root Access no momento da transação
- Gera um mini-mercado interno (jogadores non-VIP ainda acumulam `.dat` normalmente, só não podem comercializar — viram um incentivo natural de upgrade)

### Outras alavancas de monetização (secundárias, fora do escopo do MVP)

- Compra direta de Tokens (moeda hard) em pacotes
- Compra direta de `.sh` (boosts) sem precisar invocar
- Cosméticos (skins visuais pros `.exe`, sem efeito em stats) — boa forma de monetizar sem tocar em poder
- Season pass temático (sugestão de nome: **"Firmware Update"** — cada temporada é uma "atualização" com trilha gratuita + paga) — fica como ideia de Fase 2, não essencial pro MVP

---

## 2. Guilda — "Cluster"

Nome temático: um **Cluster** é um conjunto de máquinas trabalhando juntas como um sistema só — encaixa direto com o conceito de guilda. Membros de um Cluster são chamados de **Nodes**.

### Estrutura social

- Criar ou entrar em um Cluster (limite sugerido: 30 Nodes)
- Cargos: Líder + Oficiais (permissões de convidar/expulsar)
- Chat de guilda

### Moeda exclusiva — "Bandwidth"

- Só é possível **ganhar** Bandwidth participando de atividades de guilda (raids cooperativos, missões de Cluster)
- Só é possível **gastar** Bandwidth na Loja do Cluster (itens exclusivos: Módulos `.dll` especiais, `.sh` de guilda, cosméticos de Cluster)
- Não tem conversão com Créditos/Tokens em nenhuma direção — mantém o sistema de guilda como uma economia própria, sem virar outro jeito de comprar poder com dinheiro real

### Benefício passivo compartilhado

- Todo Node de um Cluster ativo recebe **+25% de Créditos e XP** (conforme pedido) — esse bônus é do próprio Cluster, cumulativo com o bônus pessoal de Root Access (seção 1)

### Conteúdo cooperativo — "DDoS Raid"

Nome temático direto: um **DDoS** (Distributed Denial of Service) é um ataque que soma a força de várias origens contra um único alvo — exatamente a mecânica de um raid de guilda.

- Um boss especial (pode ser uma versão fortalecida de um boss de mundo já existente, ou um boss exclusivo de Cluster) fica disponível por um período (sugestão: 48h)
- Cada Node contribui com suas próprias tentativas de batalha contra o boss; o dano causado por todos os Nodes **se acumula** num HP compartilhado do boss
- Ao derrotar o boss (ou ao fim das 48h, valendo o que foi feito), o Cluster inteiro recebe Bandwidth + recompensas — com bônus extra pra quem mais contribuiu individualmente (ranking interno de dano)

---

## 3. Resumo de nomes temáticos

| Sistema | Nome |
|---|---|
| Jogo | **Pantheon Idle** |
| Assinatura VIP | **Root Access** |
| Guilda | **Cluster** |
| Membro de guilda | **Node** |
| Moeda de guilda | **Bandwidth** |
| Conteúdo cooperativo de guilda | **DDoS Raid** |
| Season pass *(fase 2)* | **Firmware Update** |
