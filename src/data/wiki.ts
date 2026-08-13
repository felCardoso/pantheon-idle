import type { WikiPageMeta } from '../types';

import panteaoDigital from '../content/wiki/panteao-digital.md?raw';
import mundoJurupari from '../content/wiki/mundo-jurupari.md?raw';
import personagensJurupari from '../content/wiki/personagens-jurupari.md?raw';
import elementosCombate from '../content/wiki/elementos-combate.md?raw';
import itensProgressao from '../content/wiki/itens-progressao.md?raw';

export const WIKI_PAGES: WikiPageMeta[] = [
  {
    slug: 'panteao-digital',
    title: 'Pantheon Idle',
    summary: 'O que é o mundo, as facções e como o poder funciona aqui.',
    file: 'panteao-digital.md',
  },
  {
    slug: 'mundo-jurupari',
    title: 'Jurupari.iso',
    summary: 'O painel de Folclore Brasileiro, sua estrutura e seu chefe.',
    file: 'mundo-jurupari.md',
  },
  {
    slug: 'personagens-jurupari',
    title: 'Personagens de Jurupari.iso',
    summary: 'Lore e habilidades dos 4 processos jogáveis do painel inicial.',
    file: 'personagens-jurupari.md',
  },
  {
    slug: 'elementos-combate',
    title: 'Elementos e Combate',
    summary: 'Atributos, elementos, ordem de resolução de dano e status.',
    file: 'elementos-combate.md',
  },
  {
    slug: 'itens-progressao',
    title: 'Itens e Progressão',
    summary: 'O sistema de extensões de arquivo e como evoluir seus personagens.',
    file: 'itens-progressao.md',
  },
];

export const WIKI_CONTENT: Record<string, string> = {
  'panteao-digital': panteaoDigital,
  'mundo-jurupari': mundoJurupari,
  'personagens-jurupari': personagensJurupari,
  'elementos-combate': elementosCombate,
  'itens-progressao': itensProgressao,
};
