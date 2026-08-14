import type { ChatMessage } from '../../types';

export const CHAT_MESSAGES: ChatMessage[] = [
  { id: 'g1', tab: 'global', author: 'alvesfk', text: 'eu sou gay', time: '21:04' },
  { id: 'g2', tab: 'global', author: 'kernel_panic', text: 'Iara com Lentidão resolve, testa', time: '21:05' },
  { id: 'g3', tab: 'global', author: 'root@_ana', text: 'trocando .dat de Saci por .dat de Boitatá, dm', time: '21:07' },

  { id: 'gu1', tab: 'guild', author: 'Oficial_Mari', text: 'DDoS Raid abre em 3h, se preparem', time: '20:40' },
  { id: 'gu2', tab: 'guild', author: 'byte_reaper', text: 'já rankeei 40k de dano no boss', time: '20:52' },

  { id: 'a1', tab: 'anuncios', text: 'Manutenção programada às 03:00 (horário de Brasília).', time: 'hoje', tone: 'system' },
  { id: 'a2', tab: 'anuncios', text: 'Evento de fim de semana: +50% Créditos em todas as fases.', time: 'ontem', tone: 'system' },

];
