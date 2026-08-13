import type { Element, Faction } from '../types';

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
