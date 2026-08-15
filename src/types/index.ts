import type { StatusType } from '../engine/schema';

export type Faction = 'Firewall' | 'Malware' | 'Crypto-Miner' | 'Exploit';

export type Element = 'Vírus' | 'Brute Force' | 'Nanites' | 'Encryption' | 'Backdoor';

export type Rarity = 'Alpha' | 'Beta' | 'Stable' | 'LTS' | 'Zero-Day';

export interface ActiveStatus {
  type: StatusType;
  /** Number of stacked instances (only >1 for stackable statuses like Sangramento). */
  count: number;
}

export interface BattleUnit {
  id: string;
  name: string;
  faction: Faction;
  element: Element;
  rarity: Rarity;
  level: number;
  hp: number;
  maxHp: number;
  shield: number;
  statuses: ActiveStatus[];
  isAlly: boolean;
  /** Pixel-art card image. When unset, UnitCard renders a placeholder silhouette. */
  portraitUrl?: string;
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
  credits: number;
  xp: number;
  tokens: number;
  bytes: number;
  buffs: Buff[];
  notificationCount: number;
}

export interface StageInfo {
  /** Slug identifying which world's background art to show — see engineDisplay.ts's WORLD_BACKGROUND_BY_ID. */
  worldId: string;
  worldName: string;
  worldSubtitle: string;
  phase: number;
  stage: number;
  totalStages: number;
  isBoss: boolean;
  /** Clash count this battle — v2's line-up combat has no sub-round turn counter (1 round = 1 clash). */
  round: number;
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
