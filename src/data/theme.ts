import type { Faction, Rarity } from '../types';
import type { StatusType } from '../engine/schema';

/** Ascending tier: Alpha < Beta < Stable < LTS < Zero-Day (docs/personagens.md). */
export const RARITY_COLOR: Record<Rarity, string> = {
  Alpha: '#8a93a6',
  Beta: '#39ff9c',
  Stable: '#5a8bff',
  LTS: '#c34aff',
  'Zero-Day': '#ffd700',
};

/** v2 has no elemental-affinity system — Faction is now a unit's only secondary color signal (alongside Rarity), used for card borders/glow. */
export const FACTION_COLOR: Record<Faction, string> = {
  Firewall: '#2fd8ff',
  Malware: '#ff3b5c',
  'Crypto-Miner': '#ffb02e',
  Exploit: '#c34aff',
};

/** Icons + colors for the status badge row. Nanites is a buff, not shown there. */
export const STATUS_ICON: Record<StatusType, string> = {
  leak: 'droplet',
  trojan: 'bug',
  crash: 'zap-off',
  fragmentation: 'shield-off',
  nanites: 'heart',
  throttling: 'trending-down',
  lag: 'turtle',
  target: 'crosshair',
  buffAtk: 'swords',
  buffDef: 'shield',
  buffIni: 'zap',
  buffEsq: 'wind',
  buffIce: 'orbit',
};

export const STATUS_COLOR: Record<StatusType, string> = {
  leak: '#ff3b5c',
  trojan: '#39ff9c',
  crash: '#ffb02e',
  fragmentation: '#ff7a3d',
  nanites: '#39ff9c',
  throttling: '#ff7a3d',
  lag: '#2fd8ff',
  target: '#ff3b5c',
  buffAtk: '#39ff9c',
  buffDef: '#39ff9c',
  buffIni: '#39ff9c',
  buffEsq: '#39ff9c',
  buffIce: '#39ff9c',
};

/** Statuses shown in the "negative effects" row above a unit — everything except the buffs. */
export const NEGATIVE_STATUSES: ReadonlySet<StatusType> = new Set([
  'leak',
  'trojan',
  'crash',
  'fragmentation',
  'throttling',
  'lag',
  'target',
]);
