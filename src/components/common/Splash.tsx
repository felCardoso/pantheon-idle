import { Icon } from './Icon';

export function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center bg-void-950">
      <div className="flex flex-col items-center gap-3">
        <Icon name="loader" size={28} className="animate-spin text-code-400" />
        <p className="font-display text-xs font-bold uppercase tracking-widest text-white/40">Carregando...</p>
      </div>
    </div>
  );
}
