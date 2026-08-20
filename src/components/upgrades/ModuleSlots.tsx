import { Icon } from '../common/Icon';
import { MODULE_BY_ID, MODULE_SLOTS, describeModule, type ModuleSlot } from '../../data/modules';
import type { OwnedModule } from '../../hooks/usePlayerModules';

interface ModuleSlotsProps {
  characterId: string;
  modules: OwnedModule[];
  onEquip: (moduleRowId: string, characterId: string | null) => void;
}

/** Slot identity: the Ultimate reads as the headline, the other three as its supporting trio. */
const SLOT_STYLE: Record<ModuleSlot, { label: string; icon: string; color: string }> = {
  ultimate: { label: 'Principal', icon: 'sparkles', color: '#ffa229' },
  attack: { label: 'Ataque', icon: 'swords', color: '#ff4d5e' },
  defense: { label: 'Defesa', icon: 'shield', color: '#39a0ff' },
  support: { label: 'Suporte', icon: 'heart', color: '#39ff9c' },
};

const RARITY_COLOR: Record<string, string> = { S: '#ffd029', A: '#c34aff', B: '#39a0ff', C: '#8b93a7' };

function ModuleCard({
  module,
  size,
  onClick,
  title,
}: {
  module: OwnedModule | null;
  size: 'large' | 'normal';
  onClick: () => void;
  title: string;
}) {
  const slotStyle = SLOT_STYLE[(module?.slot ?? 'attack') as ModuleSlot];
  const definition = module ? MODULE_BY_ID[module.moduleId] : null;
  const box = size === 'large' ? 'h-24 w-24' : 'h-20 w-20';

  if (!module || !definition) {
    return (
      <button
        onClick={onClick}
        title={title}
        className={`flex ${box} flex-col items-center justify-center gap-1 rounded-xl border border-dashed transition hover:brightness-125`}
        style={{ borderColor: `${slotStyle.color}66` }}
      >
        <Icon name="plus" size={size === 'large' ? 20 : 16} style={{ color: `${slotStyle.color}99` }} />
        <span className="text-[8px] uppercase tracking-wide text-white/30">vazio</span>
      </button>
    );
  }

  const rarityColor = RARITY_COLOR[module.rarity] ?? '#8b93a7';
  return (
    <button
      onClick={onClick}
      title={describeModule(definition, module.rarity)}
      className={`relative flex ${box} flex-col items-center justify-center gap-1 rounded-xl border-2 bg-void-950/70 p-1 transition hover:brightness-125`}
      style={{ borderColor: rarityColor, boxShadow: `0 0 16px -6px ${rarityColor}` }}
    >
      <span className="absolute right-1 top-1 rounded px-1 font-mono text-[9px] font-bold" style={{ color: rarityColor }}>
        {module.rarity}
      </span>
      <Icon name={SLOT_STYLE[module.slot].icon} size={size === 'large' ? 20 : 16} style={{ color: SLOT_STYLE[module.slot].color }} />
      <span className="max-w-full truncate px-0.5 text-center text-[9px] font-bold text-white/85">{definition.name}</span>
    </button>
  );
}

/**
 * A character's four equipped runes: the Ultimate rendered larger than the Attack/Defense/Support
 * trio, since it carries the character-defining effect rather than a stat nudge.
 */
export function ModuleSlots({ characterId, modules, onEquip }: ModuleSlotsProps) {
  const equipped = MODULE_SLOTS.map((slot) => ({
    slot,
    module: modules.find((m) => m.equippedOn === characterId && m.slot === slot) ?? null,
  }));

  return (
    <div className="flex flex-wrap items-end justify-center gap-3">
      {equipped.map(({ slot, module }) => (
        <div key={slot} className="flex flex-col items-center gap-1.5">
          <span
            className="font-display text-[9px] font-bold uppercase tracking-widest"
            style={{ color: module ? SLOT_STYLE[slot].color : `${SLOT_STYLE[slot].color}88` }}
          >
            {SLOT_STYLE[slot].label}
          </span>
          <ModuleCard
            module={module}
            size={slot === 'ultimate' ? 'large' : 'normal'}
            title={module ? 'Desequipar' : 'Nenhum módulo equipado'}
            onClick={() => module && onEquip(module.id, null)}
          />
        </div>
      ))}
    </div>
  );
}

/** The unequipped pool, filtered to one slot so a card can only land where it belongs. */
export function ModuleInventory({
  modules,
  characterId,
  onEquip,
}: {
  modules: OwnedModule[];
  characterId: string;
  onEquip: (moduleRowId: string, characterId: string | null) => void;
}) {
  const available = modules.filter((m) => m.equippedOn === null);

  if (available.length === 0) {
    return (
      <p className="rounded-lg border border-void-600 bg-void-800/30 p-4 text-center text-[11px] text-white/40">
        Nenhum módulo guardado. Invoque cápsulas `.rar` ou derrote um Chefe de Mundo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {MODULE_SLOTS.map((slot) => {
        const forSlot = available.filter((m) => m.slot === slot);
        if (forSlot.length === 0) return null;
        return (
          <div key={slot} className="flex flex-col gap-1.5">
            <span className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: SLOT_STYLE[slot].color }}>
              {SLOT_STYLE[slot].label}
            </span>
            <div className="flex flex-wrap gap-2">
              {forSlot.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  size="normal"
                  title="Equipar"
                  onClick={() => onEquip(module.id, characterId)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
