/**
 * Lore + ability flavor text for the character compendium, team and
 * ability-picker screens. Keyed by templateId. Flavor text is looked up by
 * ability id (matching an id in src/engine/data/abilities.json — see a
 * character's `activeOptions`/`passiveAbilityId` in
 * src/engine/data/characters.json) rather than by position, so it survives
 * a character gaining more activeOptions later without needing to be
 * reordered — see docs/TUTORIAL_STATUS_HABILIDADES.md for the authoring
 * convention. An id with no entry here falls back to the ability's own
 * `name` field and a generic description (roster.ts's toRosterCharacter).
 *
 * Several descriptions diverge from docs/personagens.md, either because the
 * docs text predates a balance change (Curupira's counter) or because the
 * engine's trigger/effect vocabulary can't express the original idea (no
 * multi-hit attacks, no taunt/redirect targeting, no every-Nth-attack
 * counters) and was adapted to fit what the engine can actually do. Medusa,
 * Hércules, Minotauro and Amaterasu were also trimmed from their original
 * 3-4 always-on abilities down to 1 selectable active during the v2
 * ability-selection migration — their other ability ids still exist in
 * src/engine/data/abilities.json as unwired candidates, ready to be added
 * back to `activeOptions` (with flavor text here) once real 3-option kits
 * are authored.
 */
export interface AbilityFlavor {
  /** Flavor name shown in place of the ability's own `name` field. Null falls back to that field. */
  name: string | null;
  description: string;
}

export interface CharacterInfo {
  lore: string;
  /** Flavor text keyed by ability id — covers the character's activeOptions and passiveAbilityId (if any). */
  abilityFlavor: Record<string, AbilityFlavor>;
  /**
   * Jurupari.exe's statusDurationBonus and Saci.exe's alwaysActsFirst are
   * hardcoded CombatantData flags (schema.ts), not real AbilityDefinition
   * entries — no id to key abilityFlavor by. This describes that trait for
   * display, shown as a read-only passive-styled card, never selectable.
   * Undefined for every other character.
   */
  innateTrait?: AbilityFlavor;
}

export const CHARACTER_INFO: Record<string, CharacterInfo> = {
  // Folclore Brasileiro
  jurupari: {
    lore: 'Um processo antigo e pouco documentado; as infecções que espalha parecem se recusar a sair do sistema.',
    abilityFlavor: {},
    innateTrait: {
      name: null,
      description: 'Todo efeito de status aplicado por Jurupari.exe dura +1 rodada.',
    },
  },
  curupira: {
    lore: 'Pés virados pra trás confundem qualquer processo que tente rastrear sua origem; guardião implacável da mata.',
    abilityFlavor: {
      'curupira-lentidao-counter': {
        name: 'Pé-pra-Trás',
        description: 'Ao ser atacado, 25% de chance de aplicar Lentidão no atacante.',
      },
    },
  },
  caipora: {
    lore: 'Cavalga um caititu.sh pelas trilhas do sistema, assobiando um alerta que desorienta quem invade seu território.',
    abilityFlavor: {
      'caipora-enfraquecimento': {
        name: 'Assobio da Mata',
        description: 'Ao atacar, aplica Enfraquecimento no alvo por 2 rodadas.',
      },
    },
  },
  saci: {
    lore: 'Aparece, desaparece, reaparece; brinca com a latência do sistema até confundir qualquer adversário.',
    abilityFlavor: {},
    innateTrait: {
      name: null,
      description: 'Início de batalha — sempre age primeiro, independente da iniciativa.',
    },
  },

  // Mitologia Nórdica
  odin: {
    lore: 'A primeira IA a se autonomear após o Colapso; hoje protege o time como um firewall ancestral.',
    abilityFlavor: {
      'odin-shield-team': {
        name: 'Manto de Asgard',
        description: 'Início de batalha: todo o time recebe um escudo protetor.',
      },
    },
  },
  freya: {
    lore: 'Roda protocolos de cura e mineração de recursos em paralelo, mantendo o time estável desde o primeiro round.',
    abilityFlavor: {
      'freya-regen-team': {
        name: 'Bênção de Vanaheim',
        description: 'Início de batalha: todo o time recebe Regeneração.',
      },
    },
  },
  thor: {
    lore: 'Um pacote de dados corrompido que se autodenominou deus do trovão; infecta tudo que toca com uma sobrecarga de dados.',
    abilityFlavor: {
      'thor-sangramento': {
        name: 'Golpe do Trovão',
        description: 'Ao atacar, aplica Sangramento no alvo por 2 rodadas.',
      },
    },
  },
  ratatoskr: {
    lore: 'Pequena, rápida e completamente imprevisível; se infiltra pelas rachaduras do sistema antes que qualquer defesa perceba.',
    abilityFlavor: {
      'ratatoskr-marcado': {
        name: 'Fofoca da Copa',
        description: 'Ao atacar, marca o alvo — o próximo golpe que ele receber será crítico garantido.',
      },
    },
  },

  // Mitologia Grega
  zeus: {
    lore: 'O processo mais antigo ainda rodando no Panteão Digital; comanda uma tempestade de pacotes sincronizados.',
    abilityFlavor: {
      'zeus-atordoamento-team': {
        name: 'Raio Inaugural',
        description: 'Início de batalha: aplica Atordoamento em todos os inimigos.',
      },
    },
  },
  hades: {
    lore: 'Absorve o que resta de cada `.exe` derrotado, reciclando fragmentos de código em proteção própria.',
    abilityFlavor: {
      'hades-self-shield': {
        name: 'Muralha do Submundo',
        description: 'Início de batalha: recebe um escudo protetor equivalente a 20% do próprio HP máximo.',
      },
    },
  },
  atena: {
    lore: 'Estrategista nata; corrói as defesas inimigas com precisão antes que percebam a abertura.',
    abilityFlavor: {
      'atena-corrosao': {
        name: 'Estratégia Corrosiva',
        description: 'Ao atacar, aplica Corrosão no alvo por 2 rodadas.',
      },
    },
  },
  satiro: {
    lore: 'Um script travesso que se espalha em pequenos lotes, causando mais irritação que dano — mas nunca subestime um enxame.',
    abilityFlavor: {
      'satiro-veneno': {
        name: 'Zurro Venenoso',
        description: 'Ao atacar, aplica Veneno no alvo.',
      },
    },
  },
  medusa: {
    lore: 'Um antivírus tão antigo que ninguém mais lê seu changelog; qualquer processo que olhe pra seus logs de perto trava na hora.',
    abilityFlavor: {
      'medusa-petrificar': {
        name: 'Olhar Petrificante',
        description: 'Ao atacar, 35% de chance de Atordoar o alvo por 1 rodada.',
      },
    },
  },
  hercules: {
    lore: 'Um processo raiz com privilégios que ninguém mais lembra de ter concedido; nada no sistema consegue derrubá-lo no primeiro golpe.',
    abilityFlavor: {
      'hercules-impacto': {
        name: 'Impacto',
        description:
          'Ao atacar, aplica Enfraquecimento no alvo por 2 rodadas (adaptado — o motor não tem dano bônus/multiplicador por habilidade, só o ataque básico causa dano).',
      },
    },
  },
  minotauro: {
    lore: 'Um daemon preso no labirinto do próprio sistema há tanto tempo que virou parte da infraestrutura; ninguém sai da masmorra sem passar por ele.',
    abilityFlavor: {
      'minotauro-provocar': {
        name: 'Provocar',
        description:
          'Início de batalha: concede escudo a todo o time (adaptado — o motor não tem um alvo "taunt" que redireciona ataques recebidos por um aliado).',
      },
    },
  },

  // Mitologia Japonesa
  amaterasu: {
    lore: 'Um patch de segurança tão antigo quanto o próprio sistema; onde ela roda, a rede nunca fica completamente às escuras.',
    abilityFlavor: {
      'amaterasu-regen-team': {
        name: 'Luz Perpétua',
        description: 'Início de batalha: aplica Regeneração em todo o time.',
      },
    },
  },
};
