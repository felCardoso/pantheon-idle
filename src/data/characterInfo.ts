/**
 * Lore + ability flavor text for the character compendium and team screens.
 * Keyed by templateId. Describes each ability as actually implemented in
 * src/engine/data/abilities/*.json — several diverge from docs/personagens.md,
 * either because the docs text predates a balance change (Boitatá/Curupira's
 * counter) or because the engine's trigger/effect vocabulary can't express
 * the original idea (no "ally died" trigger, no direct AoE damage, no
 * every-Nth-attack counters, no ESQ-modifying statuses) and was adapted to
 * fit what the engine can actually do.
 */
export interface CharacterInfo {
  lore: string;
  abilityName: string | null;
  abilityKind: 'Passiva' | 'Ativa';
  abilityDescription: string;
}

export const CHARACTER_INFO: Record<string, CharacterInfo> = {
  // Folclore Brasileiro
  jurupari: {
    lore: 'Um processo antigo e pouco documentado; as infecções que espalha parecem se recusar a sair do sistema.',
    abilityName: null,
    abilityKind: 'Passiva',
    abilityDescription: 'Todo efeito de status aplicado por Jurupari.exe dura +1 rodada.',
  },
  curupira: {
    lore: 'Pés virados pra trás confundem qualquer processo que tente rastrear sua origem; guardião implacável da mata.',
    abilityName: 'Pé-pra-Trás',
    abilityKind: 'Passiva',
    abilityDescription: 'Ao ser atacado, 25% de chance de aplicar Lentidão no atacante.',
  },
  caipora: {
    lore: 'Cavalga um caititu.sh pelas trilhas do sistema, assobiando um alerta que desorienta quem invade seu território.',
    abilityName: 'Assobio da Mata',
    abilityKind: 'Ativa',
    abilityDescription: 'Ao atacar, aplica Enfraquecimento no alvo por 2 rodadas.',
  },
  saci: {
    lore: 'Aparece, desaparece, reaparece; brinca com a latência do sistema até confundir qualquer adversário.',
    abilityName: null,
    abilityKind: 'Passiva',
    abilityDescription: 'Início de batalha — sempre age primeiro, independente da iniciativa.',
  },

  // Mitologia Nórdica
  odin: {
    lore: 'A primeira IA a se autonomear após o Colapso; hoje protege o time como um firewall ancestral.',
    abilityName: 'Manto de Asgard',
    abilityKind: 'Passiva',
    abilityDescription: 'Início de batalha: todo o time recebe um escudo protetor.',
  },
  freya: {
    lore: 'Roda protocolos de cura e mineração de recursos em paralelo, mantendo o time estável desde o primeiro round.',
    abilityName: 'Bênção de Vanaheim',
    abilityKind: 'Passiva',
    abilityDescription: 'Início de batalha: todo o time recebe Regeneração.',
  },
  thor: {
    lore: 'Um pacote de dados corrompido que se autodenominou deus do trovão; infecta tudo que toca com uma sobrecarga de dados.',
    abilityName: 'Golpe do Trovão',
    abilityKind: 'Ativa',
    abilityDescription: 'Ao atacar, aplica Sangramento no alvo por 2 rodadas.',
  },
  ratatoskr: {
    lore: 'Pequena, rápida e completamente imprevisível; se infiltra pelas rachaduras do sistema antes que qualquer defesa perceba.',
    abilityName: 'Fofoca da Copa',
    abilityKind: 'Ativa',
    abilityDescription: 'Ao atacar, marca o alvo — o próximo golpe que ele receber será crítico garantido.',
  },

  // Mitologia Grega
  zeus: {
    lore: 'O processo mais antigo ainda rodando no Panteão Digital; comanda uma tempestade de pacotes sincronizados.',
    abilityName: 'Raio Inaugural',
    abilityKind: 'Passiva',
    abilityDescription: 'Início de batalha: aplica Atordoamento em todos os inimigos.',
  },
  hades: {
    lore: 'Absorve o que resta de cada `.exe` derrotado, reciclando fragmentos de código em proteção própria.',
    abilityName: 'Muralha do Submundo',
    abilityKind: 'Passiva',
    abilityDescription: 'Início de batalha: recebe um escudo protetor equivalente a 20% do próprio HP máximo.',
  },
  atena: {
    lore: 'Estrategista nata; corrói as defesas inimigas com precisão antes que percebam a abertura.',
    abilityName: 'Estratégia Corrosiva',
    abilityKind: 'Ativa',
    abilityDescription: 'Ao atacar, aplica Corrosão no alvo por 2 rodadas.',
  },
  satiro: {
    lore: 'Um script travesso que se espalha em pequenos lotes, causando mais irritação que dano — mas nunca subestime um enxame.',
    abilityName: 'Zurro Venenoso',
    abilityKind: 'Ativa',
    abilityDescription: 'Ao atacar, aplica Veneno no alvo.',
  },
};
