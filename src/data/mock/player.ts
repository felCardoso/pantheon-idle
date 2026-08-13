import type { PlayerState, StageInfo } from '../../types';

export const PLAYER_STATE: PlayerState = {
  name: 'Root@Felipe',
  rankTier: 'Diamante',
  rankValue: '11.7k',
  guildName: 'Cluster: Ordem.dll',
  credits: 13200,
  tokens: 674,
  notificationCount: 3,
  buffs: [
    { id: 'xp-boost', label: 'Boost de XP', icon: 'zap', remaining: '9h11' },
    { id: 'credit-boost', label: 'Boost de Créditos', icon: 'coins', remaining: '9h11' },
  ],
};

export const STAGE_INFO: StageInfo = {
  worldName: 'Jurupari.iso',
  worldSubtitle: 'Folclore Brasileiro',
  phase: 1,
  stage: 6,
  totalStages: 10,
  round: 5,
  turn: 2,
};
