import type { MenuItem } from '../../types';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'battle', label: 'Batalha', icon: 'swords', status: 'active' },
  { id: 'team', label: 'Time', icon: 'users', status: 'active' },
  { id: 'characters', label: 'Personagens', icon: 'id-card', status: 'active' },
  { id: 'shop', label: 'Loja', icon: 'store', status: 'soon' },
  { id: 'market', label: 'Mercado', icon: 'repeat', status: 'soon' },
  { id: 'forge', label: 'Módulos', icon: 'hammer', status: 'soon' },
  { id: 'summon', label: 'Invocação', icon: 'sparkles', status: 'soon' },
  { id: 'guild', label: 'Cluster', icon: 'shield', status: 'soon' },
  { id: 'arena', label: 'Arena', icon: 'crosshair', status: 'soon' },
  { id: 'social', label: 'Social', icon: 'message-circle', status: 'soon' },
  { id: 'pantheons', label: 'Panteões', icon: 'orbit', status: 'soon' },
];
