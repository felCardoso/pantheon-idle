import type { Element, Faction, Rarity } from '../types';
import type { StatusType } from '../engine/schema';

/** Ascending tier: Alpha < Beta < Stable < LTS (docs/personagens.md). */
export const RARITY_COLOR: Record<Rarity, string> = {
  Alpha: '#8a93a6',
  Beta: '#39ff9c',
  Stable: '#5a8bff',
  LTS: '#c34aff',
};

export const FACTION_COLOR: Record<Faction, string> = {
  Firewall: '#2fd8ff',
  Malware: '#ff3b5c',
  'Crypto-Miner': '#ffb02e',
  Exploit: '#c34aff',
};

export const ELEMENT_COLOR: Record<Element, string> = {
  Vírus: '#39ff9c',
  'Brute Force': '#ff7a3d',
  Nanites: '#2fd8ff',
  Encryption: '#5a8bff',
  Backdoor: '#c34aff',
};

export const ELEMENT_GLYPH: Record<Element, string> = {
  Vírus: '</>',
  'Brute Force': '#!',
  Nanites: '+',
  Encryption: '{ }',
  Backdoor: '::',
};

/** Icons + colors for the status badge row. Regeneração is a buff, not shown there. */
export const STATUS_ICON: Record<StatusType, string> = {
  virus: 'bug',
  sangramento: 'droplet',
  veneno: 'flask-conical',
  atordoamento: 'zap-off',
  enfraquecimento: 'trending-down',
  corrosao: 'shield-off',
  lentidao: 'turtle',
  regeneracao: 'heart',
  marcado: 'crosshair',
};

export const STATUS_COLOR: Record<StatusType, string> = {
  virus: '#39ff9c',
  sangramento: '#ff3b5c',
  veneno: '#a3ff2f',
  atordoamento: '#ffb02e',
  enfraquecimento: '#ff7a3d',
  corrosao: '#ff7a3d',
  lentidao: '#2fd8ff',
  regeneracao: '#39ff9c',
  marcado: '#ff3b5c',
};

/** Statuses shown in the "negative effects" row above a unit — everything except the one buff. */
export const NEGATIVE_STATUSES: ReadonlySet<StatusType> = new Set([
  'virus',
  'sangramento',
  'veneno',
  'atordoamento',
  'enfraquecimento',
  'corrosao',
  'lentidao',
  'marcado',
]);
