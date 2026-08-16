import { Icon } from '../common/Icon';
import { STATUS_COLOR, STATUS_ICON } from '../../data/theme';
import type { ActiveStatus } from '../../types';

const STATUS_LABEL: Record<ActiveStatus['type'], string> = {
  leak: 'Leak',
  trojan: 'Trojan',
  crash: 'Crash',
  fragmentation: 'Fragmentação',
  nanites: 'Nanites',
  throttling: 'Throttling',
  lag: 'Lag',
  target: 'Target',
  buffAtk: 'Processamento aumentado',
  buffDef: 'Firewall aumentado',
  buffIni: 'Ping aumentado',
  buffEsq: 'Evasion aumentada',
  buffIce: 'ESP aumentado',
};

interface StatusBadgeProps {
  status: ActiveStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLOR[status.type];
  return (
    <div
      title={`${STATUS_LABEL[status.type]}${status.count > 1 ? ` ×${status.count}` : ''}`}
      className="relative flex h-3.5 w-3.5 items-center justify-center rounded-[3px] sm:h-4 sm:w-4"
      style={{ background: `${color}26`, border: `1px solid ${color}88` }}
    >
      <Icon name={STATUS_ICON[status.type]} size={9} style={{ color }} />
      {status.count > 1 && (
        <span
          className="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full font-mono text-[6px] font-bold text-void-950"
          style={{ background: color }}
        >
          {status.count}
        </span>
      )}
    </div>
  );
}
