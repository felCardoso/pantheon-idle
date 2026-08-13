export type Faction = 'Firewall' | 'Malware' | 'Crypto-Miner' | 'Exploit';

export type Element = 'Vírus' | 'Brute Force' | 'Nanites' | 'Encryption' | 'Backdoor';

export type Rarity = 'Alpha' | 'Beta' | 'RC' | 'Stable' | 'LTS' | 'Quantum';

export interface BattleUnit {
  id: string;
  name: string;
  faction: Faction;
  element: Element;
  rarity: Rarity;
  level: number;
  hp: number;
  maxHp: number;
  isAlly: boolean;
}

export type MenuStatus = 'active' | 'soon';

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  status: MenuStatus;
}

export interface Buff {
  id: string;
  label: string;
  icon: string;
  remaining: string;
}

export interface PlayerState {
  name: string;
  rankTier: string;
  rankValue: string;
  guildName: string;
  credits: number;
  tokens: number;
  buffs: Buff[];
  notificationCount: number;
}

export interface StageInfo {
  worldName: string;
  worldSubtitle: string;
  phase: number;
  stage: number;
  totalStages: number;
  round: number;
  turn: number;
}

export type ChatTabId = 'global' | 'guild' | 'anuncios' | 'log';

export interface ChatMessage {
  id: string;
  tab: ChatTabId;
  author?: string;
  text: string;
  time: string;
  tone?: 'default' | 'success' | 'danger' | 'system';
}

export interface WikiPageMeta {
  slug: string;
  title: string;
  summary: string;
  file: string;
}
