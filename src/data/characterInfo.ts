/**
 * Lore + ability flavor text for the character compendium and team screens.
 * Keyed by templateId. Describes the ability as actually implemented in
 * src/engine/data/abilities/jurupari.json — some wording in docs/personagens.md
 * predates balance changes made during implementation (e.g. Boitatá.exe's
 * counter now applies Vírus, not Fogo).
 */
export interface CharacterInfo {
  lore: string;
  abilityName: string | null;
  abilityKind: 'Passiva' | 'Ativa';
  abilityDescription: string;
}

export const CHARACTER_INFO: Record<string, CharacterInfo> = {
  jurupari: {
    lore: 'Um processo antigo e pouco documentado; as infecções que espalha parecem se recusar a sair do sistema.',
    abilityName: null,
    abilityKind: 'Passiva',
    abilityDescription: 'Todo efeito de status aplicado por Jurupari.exe dura +1 rodada.',
  },
  boitata: {
    lore: 'Uma rotina de proteção que revida com força sempre que provocada; poucos atacam duas vezes.',
    abilityName: 'Revide Infeccioso',
    abilityKind: 'Passiva',
    abilityDescription: 'Ao ser atacado, 25% de chance de aplicar Vírus no atacante.',
  },
  iara: {
    lore: 'Sua rotina de dados hipnotiza processos inimigos, atraindo-os pra fora de sincronia antes que percebam.',
    abilityName: 'Canto Hipnótico',
    abilityKind: 'Ativa',
    abilityDescription: 'Ao atacar, aplica Lentidão no alvo por 2 rodadas.',
  },
  saci: {
    lore: 'Aparece, desaparece, reaparece; brinca com a latência do sistema até confundir qualquer adversário.',
    abilityName: null,
    abilityKind: 'Passiva',
    abilityDescription: 'Início de batalha — sempre age primeiro, independente da iniciativa.',
  },
};
