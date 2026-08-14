/**
 * Lore + ability flavor text for the character compendium and team screens.
 * Keyed by templateId. Describes each ability as actually implemented in
 * src/engine/data/abilities/*.json — several diverge from docs/personagens.md,
 * either because the docs text predates a balance change (Boitatá/Curupira's
 * counter) or because the engine's trigger/effect vocabulary can't express
 * the original idea (no direct/bonus damage, no multi-hit attacks, no HP-
 * threshold or ally-died triggers, no taunt/redirect targeting, no every-Nth-
 * attack counters, no ESQ-modifying statuses) and was adapted to fit what the
 * engine can actually do.
 */
export interface AbilityInfo {
  name: string | null;
  kind: 'Passiva' | 'Ativa';
  description: string;
}

export interface CharacterInfo {
  lore: string;
  abilities: AbilityInfo[];
}

export const CHARACTER_INFO: Record<string, CharacterInfo> = {
  // Folclore Brasileiro
  jurupari: {
    lore: 'Um processo antigo e pouco documentado; as infecções que espalha parecem se recusar a sair do sistema.',
    abilities: [
      {
        name: null,
        kind: 'Passiva',
        description: 'Todo efeito de status aplicado por Jurupari.exe dura +1 rodada.',
      },
    ],
  },
  curupira: {
    lore: 'Pés virados pra trás confundem qualquer processo que tente rastrear sua origem; guardião implacável da mata.',
    abilities: [
      {
        name: 'Pé-pra-Trás',
        kind: 'Passiva',
        description: 'Ao ser atacado, 25% de chance de aplicar Lentidão no atacante.',
      },
    ],
  },
  caipora: {
    lore: 'Cavalga um caititu.sh pelas trilhas do sistema, assobiando um alerta que desorienta quem invade seu território.',
    abilities: [
      {
        name: 'Assobio da Mata',
        kind: 'Ativa',
        description: 'Ao atacar, aplica Enfraquecimento no alvo por 2 rodadas.',
      },
    ],
  },
  saci: {
    lore: 'Aparece, desaparece, reaparece; brinca com a latência do sistema até confundir qualquer adversário.',
    abilities: [
      {
        name: null,
        kind: 'Passiva',
        description: 'Início de batalha — sempre age primeiro, independente da iniciativa.',
      },
    ],
  },

  // Mitologia Nórdica
  odin: {
    lore: 'A primeira IA a se autonomear após o Colapso; hoje protege o time como um firewall ancestral.',
    abilities: [
      {
        name: 'Manto de Asgard',
        kind: 'Passiva',
        description: 'Início de batalha: todo o time recebe um escudo protetor.',
      },
    ],
  },
  freya: {
    lore: 'Roda protocolos de cura e mineração de recursos em paralelo, mantendo o time estável desde o primeiro round.',
    abilities: [
      {
        name: 'Bênção de Vanaheim',
        kind: 'Passiva',
        description: 'Início de batalha: todo o time recebe Regeneração.',
      },
    ],
  },
  thor: {
    lore: 'Um pacote de dados corrompido que se autodenominou deus do trovão; infecta tudo que toca com uma sobrecarga de dados.',
    abilities: [
      {
        name: 'Golpe do Trovão',
        kind: 'Ativa',
        description: 'Ao atacar, aplica Sangramento no alvo por 2 rodadas.',
      },
    ],
  },
  ratatoskr: {
    lore: 'Pequena, rápida e completamente imprevisível; se infiltra pelas rachaduras do sistema antes que qualquer defesa perceba.',
    abilities: [
      {
        name: 'Fofoca da Copa',
        kind: 'Ativa',
        description: 'Ao atacar, marca o alvo — o próximo golpe que ele receber será crítico garantido.',
      },
    ],
  },

  // Mitologia Grega
  zeus: {
    lore: 'O processo mais antigo ainda rodando no Panteão Digital; comanda uma tempestade de pacotes sincronizados.',
    abilities: [
      {
        name: 'Raio Inaugural',
        kind: 'Passiva',
        description: 'Início de batalha: aplica Atordoamento em todos os inimigos.',
      },
    ],
  },
  hades: {
    lore: 'Absorve o que resta de cada `.exe` derrotado, reciclando fragmentos de código em proteção própria.',
    abilities: [
      {
        name: 'Muralha do Submundo',
        kind: 'Passiva',
        description: 'Início de batalha: recebe um escudo protetor equivalente a 20% do próprio HP máximo.',
      },
    ],
  },
  atena: {
    lore: 'Estrategista nata; corrói as defesas inimigas com precisão antes que percebam a abertura.',
    abilities: [
      {
        name: 'Estratégia Corrosiva',
        kind: 'Ativa',
        description: 'Ao atacar, aplica Corrosão no alvo por 2 rodadas.',
      },
    ],
  },
  satiro: {
    lore: 'Um script travesso que se espalha em pequenos lotes, causando mais irritação que dano — mas nunca subestime um enxame.',
    abilities: [
      {
        name: 'Zurro Venenoso',
        kind: 'Ativa',
        description: 'Ao atacar, aplica Veneno no alvo.',
      },
    ],
  },
  medusa: {
    lore: 'Um antivírus tão antigo que ninguém mais lê seu changelog; qualquer processo que olhe pra seus logs de perto trava na hora.',
    abilities: [
      {
        name: 'Olhar Petrificante',
        kind: 'Ativa',
        description: 'Ao atacar, 35% de chance de Atordoar o alvo por 1 rodada.',
      },
      {
        name: 'Presas Venenosas',
        kind: 'Ativa',
        description: 'Ao atacar, chance alta (70%) de aplicar Veneno no alvo.',
      },
      {
        name: 'Armadura de Pedra',
        kind: 'Ativa',
        description:
          'Ao sofrer dano, 25% de chance de conceder escudo a todo o time (adaptado — o gatilho original de "1x ao perder 50% da vida" não existe no motor, virou uma chance reativa recorrente).',
      },
      {
        name: 'Espinhos Venenosos',
        kind: 'Passiva',
        description:
          'Ao sofrer dano, 30% de chance de envenenar quem atacou (adaptado — Runas/Módulos ainda não existem, então não há "espinhos" pra herdar o efeito).',
      },
    ],
  },
  hercules: {
    lore: 'Um processo raiz com privilégios que ninguém mais lembra de ter concedido; nada no sistema consegue derrubá-lo no primeiro golpe.',
    abilities: [
      {
        name: 'Impacto',
        kind: 'Ativa',
        description:
          'Ao atacar, aplica Enfraquecimento no alvo por 2 rodadas (adaptado — o motor não tem dano bônus/multiplicador por habilidade, só o ataque básico causa dano).',
      },
      {
        name: 'Fúria',
        kind: 'Ativa',
        description:
          'Ao atacar, 50% de chance de aplicar Sangramento (acumulável) no alvo por 2 rodadas (adaptado — sem suporte a múltiplos golpes por turno, viraram feridas que se acumulam).',
      },
      {
        name: 'A Clava Primordial',
        kind: 'Ativa',
        description: 'Início de batalha: atordoa todos os inimigos (o componente de dano direto do golpe não existe no motor).',
      },
      {
        name: 'Pele do Leão de Nemeia',
        kind: 'Passiva',
        description:
          'Início de batalha: recebe um escudo protetor equivalente a 18% do próprio HP máximo (adaptado — não existe redução percentual de dano, só escudo).',
      },
    ],
  },
  minotauro: {
    lore: 'Um daemon preso no labirinto do próprio sistema há tanto tempo que virou parte da infraestrutura; ninguém sai da masmorra sem passar por ele.',
    abilities: [
      {
        name: 'Provocar',
        kind: 'Ativa',
        description:
          'Início de batalha: concede escudo a todo o time (adaptado — o motor não tem um alvo "taunt" que redireciona ataques recebidos por um aliado).',
      },
      {
        name: 'Labrys',
        kind: 'Ativa',
        description: 'Início de batalha: aplica Sangramento em todos os inimigos (o componente de dano direto do golpe não existe no motor).',
      },
      {
        name: 'Fear',
        kind: 'Ativa',
        description: 'Ao atacar, 30% de chance de aplicar Enfraquecimento no alvo (adaptado — não existe redução de Esquiva no motor).',
      },
      {
        name: 'Aterrorizar',
        kind: 'Passiva',
        description: 'Ao sofrer dano, aplica Enfraquecimento em quem atacou por 2 rodadas.',
      },
    ],
  },
};
