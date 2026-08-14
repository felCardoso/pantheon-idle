import type { MenuItem } from '../../types';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'battle', label: 'Batalha', icon: 'swords', status: 'active' },
  { id: 'team', label: 'Time', icon: 'users', status: 'active' },
  { id: 'characters', label: 'Personagens', icon: 'id-card', status: 'active' },
  { id: 'shop', label: 'Loja', icon: 'store', status: 'active' },
  { id: 'market', label: 'Mercado', icon: 'repeat', status: 'active' },
  { id: 'forge', label: 'Upgrades', icon: 'hammer', status: 'active' },
  { id: 'summon', label: 'Invocações', icon: 'sparkles', status: 'active' },
  { id: 'guild', label: 'Cluster', icon: 'shield', status: 'active' },
  { id: 'social', label: 'Social', icon: 'message-circle', status: 'soon' },
  { id: 'pantheons', label: 'Panteões', icon: 'orbit', status: 'soon' },
];
