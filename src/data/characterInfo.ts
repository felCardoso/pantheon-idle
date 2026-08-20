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
    abilityFlavor: {
      'jurupari-fragmentacao': {
        name: 'Ritual Fragmentado',
        description: 'Ao atacar, 40% de chance de aplicar Fragmentação no alvo.',
      },
      'jurupari-banco-vigilia': {
        name: 'Vigília Ancestral',
        description: 'Enquanto estiver no banco, concede +12% de Firewall ao Vanguarda aliado.',
      },
      'jurupari-passiva-lei': {
        name: 'Lei do Silêncio',
        description: 'Ao eliminar um inimigo, ganha +10% de Processamento pelo resto da batalha.',
      },
    },
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
      'curupira-banco-rastro': {
        name: 'Rastro Invertido',
        description: 'Enquanto estiver no banco, concede +10% de Evasion ao Vanguarda aliado.',
      },
      'curupira-passiva-pes': {
        name: 'Pés ao Contrário',
        description: 'Ao esquivar de um ataque, ganha +8% de Ping por 4 rodadas.',
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
      'caipora-banco-guarda': {
        name: 'Guarda da Mata',
        description: 'Enquanto estiver no banco, concede +10% de Processamento ao Vanguarda aliado.',
      },
      'caipora-passiva-caca': {
        name: 'Chamado da Caça',
        description: 'Ao atacar, 20% de chance de causar dano direto adicional equivalente a 30% do próprio ataque base.',
      },
    },
  },
  saci: {
    lore: 'Aparece, desaparece, reaparece; brinca com a latência do sistema até confundir qualquer adversário.',
    abilityFlavor: {
      'saci-redemoinho': {
        name: 'Redemoinho',
        description: 'Ao atacar, 35% de chance de aplicar Throttling no alvo por 4 rodadas.',
      },
      'saci-banco-assobio': {
        name: 'Assobio Zombeteiro',
        description: 'Enquanto estiver no banco, concede +12% de Ping ao Vanguarda aliado.',
      },
      'saci-passiva-uma-perna': {
        name: 'Uma Perna Só',
        description: 'Início de batalha: ganha +12% de Evasion pelo resto da luta.',
      },
    },
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
      'odin-banco-hlidskjalf': {
        name: 'Trono de Hlidskjalf',
        description: 'Enquanto estiver no banco, concede +12% de Processamento ao Vanguarda aliado.',
      },
      'odin-passiva-corvos': {
        name: 'Huginn e Muninn',
        description: 'Ao eliminar um inimigo, recupera 8% do próprio HP máximo.',
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
      'freya-banco-folkvangr': {
        name: 'Campos de Fólkvangr',
        description: 'Enquanto estiver no banco, concede +11% de Firewall ao Vanguarda aliado.',
      },
      'freya-passiva-brisingamen': {
        name: 'Colar de Brísingamen',
        description: 'Ao receber cura, o Vanguarda aliado ganha +6% de Processamento por 4 rodadas.',
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
      'thor-banco-megingjord': {
        name: 'Cinto Megingjörð',
        description: 'Enquanto estiver no banco, concede +14% de Processamento ao Vanguarda aliado.',
      },
      'thor-passiva-mjolnir': {
        name: 'Mjölnir Retorna',
        description: 'Ao acertar um golpe crítico, causa dano direto adicional equivalente a 35% do próprio ataque base.',
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
      'ratatoskr-banco-recado': {
        name: 'Recado da Copa',
        description: 'Enquanto estiver no banco, concede +14% de Ping ao Vanguarda aliado.',
      },
      'ratatoskr-passiva-fofoca': {
        name: 'Chegada Ligeira',
        description: 'Ao entrar na Vanguarda, ganha +12% de Ping pelo resto da batalha.',
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
      'zeus-banco-egide': {
        name: 'Égide do Olimpo',
        description: 'Enquanto estiver no banco, concede +13% de Firewall ao Vanguarda aliado.',
      },
      'zeus-passiva-raio': {
        name: 'Faísca Olímpica',
        description: 'Ao atacar, 12% de chance de Atordoar o alvo por 1 rodada.',
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
      'hades-banco-obolo': {
        name: 'Óbolo do Barqueiro',
        description: 'Enquanto estiver no banco, concede +12% de ESP ao Vanguarda aliado.',
      },
      'hades-passiva-ceifa': {
        name: 'Ceifa do Submundo',
        description: 'Quando um aliado é eliminado, ganha +15% de Processamento pelo resto da batalha.',
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
      'atena-banco-taticas': {
        name: 'Táticas de Guerra',
        description: 'Enquanto estiver no banco, concede +13% de Processamento ao Vanguarda aliado.',
      },
      'atena-passiva-estrategia': {
        name: 'Estratégia Superior',
        description: 'Início de batalha: ganha +10% de Firewall pelo resto da luta.',
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
      'satiro-banco-siringe': {
        name: 'Siringe Inquieta',
        description: 'Enquanto estiver no banco, concede +11% de Ping ao Vanguarda aliado.',
      },
      'satiro-passiva-embriaguez': {
        name: 'Embriaguez Contagiosa',
        description: 'Ao atacar, 15% de chance de aplicar Trojan no alvo.',
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
      'medusa-banco-olhar': {
        name: 'Olhar de Esguelha',
        description: 'Enquanto estiver no banco, concede +14% de ESP ao Vanguarda aliado.',
      },
      'medusa-passiva-escamas': {
        name: 'Escamas de Górgona',
        description: 'Ao sofrer dano, 25% de chance de reduzir o Ping do atacante em 8% por 3 rodadas.',
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
      'hercules-banco-forca': {
        name: 'Força de Doze Trabalhos',
        description: 'Enquanto estiver no banco, concede +15% de Processamento ao Vanguarda aliado.',
      },
      'hercules-passiva-nemeia': {
        name: 'Pele de Nemeia',
        description: 'Ao cair abaixo de 50% de HP, recebe um escudo protetor equivalente a 15% do próprio HP máximo (uma vez por batalha).',
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
      'minotauro-banco-labirinto': {
        name: 'Eco do Labirinto',
        description: 'Enquanto estiver no banco, concede +15% de Firewall ao Vanguarda aliado.',
      },
      'minotauro-passiva-furia': {
        name: 'Fúria do Labirinto',
        description: 'Ao sofrer dano, ganha +5% de Processamento por 4 rodadas.',
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
      'amaterasu-banco-espelho': {
        name: 'Espelho Yata',
        description: 'Enquanto estiver no banco, concede +12% de Evasion ao Vanguarda aliado.',
      },
      'amaterasu-passiva-alvorada': {
        name: 'Alvorada Eterna',
        description: 'Ao entrar na Vanguarda, recupera 10% do próprio HP máximo.',
      },
    },
  },
};
