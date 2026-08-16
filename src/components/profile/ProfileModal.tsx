import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { CharacterPortrait } from '../roster/CharacterPortrait';
import { AvatarCrop } from './AvatarCrop';
import { AvatarPickerModal } from './AvatarPickerModal';
import { ChangeNicknameModal } from './ChangeNicknameModal';
import { buildOwnedRoster, ALL_CHARACTER_IDS } from '../../data/roster';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID } from '../../data/engineDisplay';
import type { OwnedCharacter } from '../../hooks/useOwnedCharacters';
import type { UpdateUsernameResult } from '../../hooks/useProfile';
import type { TeamVisibility } from '../../hooks/usePlayerProgress';

interface ProfileModalProps {
  onClose: () => void;
  onSignOut: () => void;
  username: string | null;
  avatarCharacterId: string | null;
  onUpdateAvatar: (characterId: string) => void;
  onUpdateUsername: (name: string) => Promise<UpdateUsernameResult>;
  tokens: number;
  onSpendTokens: (amount: number) => Promise<boolean>;
  ownedCharacters: OwnedCharacter[];
  frontierFase: number;
  teamVisibility: TeamVisibility;
  onChangeTeamVisibility: (value: TeamVisibility) => void;
  rankTier: string;
  rankValue: string;
  clusterName: string | null;
  pvpRating: number;
  pvpWins: number;
  pvpLosses: number;
  pvpDefenseTeam: OwnedCharacter[];
}

type Tab = 'perfil' | 'conquistas' | 'historico';

const FASE_MEDALS = [
  { fase: 5, label: 'Fase 5' },
  { fase: 10, label: 'Fase 10' },
];

const TEAM_VISIBILITY_OPTIONS: { value: TeamVisibility; label: string }[] = [
  { value: 'pve', label: 'Time PvE' },
  { value: 'pvp', label: 'Time PvP' },
  { value: 'hidden', label: 'Ocultar time' },
];

export function ProfileModal({
  onClose,
  onSignOut,
  username,
  avatarCharacterId,
  onUpdateAvatar,
  onUpdateUsername,
  tokens,
  onSpendTokens,
  ownedCharacters,
  frontierFase,
  teamVisibility,
  onChangeTeamVisibility,
  rankTier,
  rankValue,
  clusterName,
  pvpRating,
  pvpWins,
  pvpLosses,
  pvpDefenseTeam,
}: ProfileModalProps) {
  const [tab, setTab] = useState<Tab>('perfil');
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);

  const avatarPortraitUrl = avatarCharacterId ? DISPLAY_PORTRAIT_BY_TEMPLATE_ID[avatarCharacterId] : undefined;
  const roster = buildOwnedRoster(ownedCharacters);
  const defenseRoster = buildOwnedRoster(pvpDefenseTeam);

  return (
    <Modal title="Perfil" icon="user" onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col">
        {/* tabs */}
        <div className="flex shrink-0 gap-1 border-b border-void-600 px-3 pt-2 sm:px-5">
          {(
            [
              { id: 'perfil' as const, label: 'Perfil' },
              { id: 'conquistas' as const, label: 'Conquistas' },
              { id: 'historico' as const, label: 'Histórico' },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 font-display text-xs font-bold uppercase tracking-wide transition ${
                tab === t.id ? 'border-b-2 border-code-400 text-code-300' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'conquistas' && (
            <p className="rounded-lg border border-void-600 bg-void-800/30 p-6 text-center text-sm text-white/40">
              Conquistas — em breve.
            </p>
          )}
          {tab === 'historico' && (
            <p className="rounded-lg border border-void-600 bg-void-800/30 p-6 text-center text-sm text-white/40">
              Histórico de batalhas — em breve.
            </p>
          )}

          {tab === 'perfil' && (
            <div className="flex flex-col gap-5">
              {/* identity row */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setAvatarPickerOpen(true)}
                  title="Escolher avatar"
                  className="relative shrink-0 rounded-full ring-2 ring-void-600 transition hover:ring-code-400"
                >
                  {avatarCharacterId && avatarPortraitUrl ? (
                    <AvatarCrop templateId={avatarCharacterId} portraitUrl={avatarPortraitUrl} alt={username ?? 'avatar'} size={64} />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-code-500/40 bg-code-900/60 text-code-300">
                      <Icon name="user" size={26} />
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-void-500 bg-void-800 text-white/60">
                    <Icon name="package" size={11} />
                  </span>
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate font-display text-base font-bold text-white">{username ?? 'Jogador'}</p>
                  <button
                    onClick={() => setNicknameModalOpen(true)}
                    className="flex w-fit items-center gap-1.5 rounded-lg border border-void-600 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-code-400 hover:text-code-300"
                  >
                    <Icon name="user" size={11} />
                    Alterar nickname
                  </button>
                </div>
              </div>

              {/* rank/guild badges */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-full border border-arcane-500/30 bg-arcane-900/40 px-3 py-1.5">
                  <Icon name="crown" size={14} className="text-arcane-300" />
                  <span className="font-display text-[10px] uppercase tracking-wide text-arcane-300">{rankTier}</span>
                  <span className="font-mono text-xs text-white/80">{rankValue}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-code-500/25 bg-void-800/60 px-3 py-1.5">
                  <Icon name="shield" size={14} className="text-code-400" />
                  <span className="text-xs text-white/70">{clusterName ?? 'Sem Cluster'}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-signal-red/25 bg-void-800/60 px-3 py-1.5">
                  <Icon name="crosshair" size={14} className="text-signal-red" />
                  <span className="font-mono text-xs text-white/70">{pvpRating} rating</span>
                </div>
              </div>

              {/* medals */}
              <div>
                <h3 className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Medalhas</h3>
                <div className="flex flex-wrap gap-2">
                  {FASE_MEDALS.map((m) => {
                    const unlocked = frontierFase >= m.fase;
                    return (
                      <div
                        key={m.fase}
                        className={`flex w-20 flex-col items-center gap-1 rounded-lg border p-2.5 text-center ${
                          unlocked ? 'border-signal-amber/40 bg-signal-amber/10' : 'border-void-600 bg-void-800/30 opacity-50'
                        }`}
                      >
                        <Icon name="crown" size={20} className={unlocked ? 'text-signal-amber' : 'text-white/30'} />
                        <span className="text-[10px] font-bold uppercase text-white/70">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* stat cards */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  { label: 'Rank máximo', value: rankValue, icon: 'crown' },
                  { label: 'Vitórias PvP', value: String(pvpWins), icon: 'swords' },
                  { label: 'Derrotas', value: String(pvpLosses), icon: 'shield-off' },
                  { label: 'Fase atual', value: String(frontierFase), icon: 'map' },
                  { label: 'Personagens', value: `${ownedCharacters.length}/${ALL_CHARACTER_IDS.length}`, icon: 'id-card' },
                ].map((card) => (
                  <div key={card.label} className="flex flex-col items-center gap-1 rounded-lg border border-void-600 bg-void-800/50 p-3 text-center">
                    <Icon name={card.icon} size={14} className="text-white/40" />
                    <span className="font-mono text-sm font-bold text-white/90">{card.value}</span>
                    <span className="text-[9px] uppercase tracking-wide text-white/40">{card.label}</span>
                  </div>
                ))}
              </div>

              {/* team */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Time no perfil</h3>
                  <p className="text-[10px] text-white/30">Visitantes veem o que você escolher aqui</p>
                </div>
                <div className="mb-3 flex rounded-lg border border-void-600 bg-void-800/60 p-1">
                  {TEAM_VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onChangeTeamVisibility(opt.value)}
                      className={`flex-1 rounded-md py-1.5 font-display text-[10px] font-bold uppercase tracking-wide transition ${
                        teamVisibility === opt.value ? 'bg-code-500 text-void-950' : 'text-white/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {teamVisibility === 'hidden' ? (
                  <p className="rounded-lg border border-void-600 bg-void-800/30 p-4 text-center text-xs text-white/40">Time oculto.</p>
                ) : teamVisibility === 'pvp' ? (
                  defenseRoster.length === 0 ? (
                    <p className="rounded-lg border border-void-600 bg-void-800/30 p-4 text-center text-xs text-white/40">
                      Nenhum time de defesa salvo ainda — configure um na Arena.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {defenseRoster.map((c) => (
                        <div key={c.templateId} className="flex w-16 flex-col items-center gap-1 text-center">
                          <CharacterPortrait name={c.name} faction={c.faction} rarity={c.rarity} portraitUrl={c.portraitUrl} size={48} />
                          <span className="w-full truncate text-[10px] text-white/70">{c.name}</span>
                          <span className="text-[9px] text-white/40">Nv.{c.level}</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {roster.map((c) => (
                      <div key={c.templateId} className="flex w-16 flex-col items-center gap-1 text-center">
                        <CharacterPortrait name={c.name} faction={c.faction} rarity={c.rarity} portraitUrl={c.portraitUrl} size={48} />
                        <span className="w-full truncate text-[10px] text-white/70">{c.name}</span>
                        <span className="text-[9px] text-white/40">Nv.{c.level}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* frame — scaffolded only, per request */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-display text-[10px] font-bold uppercase tracking-widest text-white/40">Moldura</h3>
                  <span className="rounded-full border border-void-600 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/30">
                    Em breve
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-9 shrink-0 rounded-full border-2 border-void-600 opacity-40" />
                  <div className="h-9 w-9 shrink-0 rounded-full border-2 border-code-500 opacity-40" />
                  <div className="h-9 w-9 shrink-0 rounded-full border-2 border-arcane-400 opacity-40" />
                  <div className="h-9 w-9 shrink-0 rounded-full border-2 border-signal-amber opacity-40" />
                </div>
              </div>

              <button
                onClick={onSignOut}
                className="mt-1 flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-signal-red transition hover:bg-signal-red/10"
              >
                <Icon name="log-out" size={14} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {avatarPickerOpen && (
        <AvatarPickerModal
          ownedCharacterIds={ownedCharacters.map((c) => c.characterId)}
          currentAvatarCharacterId={avatarCharacterId}
          onSelect={(id) => {
            onUpdateAvatar(id);
            setAvatarPickerOpen(false);
          }}
          onClose={() => setAvatarPickerOpen(false)}
        />
      )}

      {nicknameModalOpen && (
        <ChangeNicknameModal
          currentUsername={username}
          tokens={tokens}
          onUpdateUsername={onUpdateUsername}
          onSpendTokens={onSpendTokens}
          onClose={() => setNicknameModalOpen(false)}
        />
      )}
    </Modal>
  );
}
