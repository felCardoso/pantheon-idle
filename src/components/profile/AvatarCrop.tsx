import { DISPLAY_AVATAR_FOCUS_BY_TEMPLATE_ID, DISPLAY_AVATAR_FOCUS_FALLBACK } from '../../data/engineDisplay';

interface AvatarCropProps {
  templateId: string;
  portraitUrl: string;
  alt: string;
  size?: number;
  className?: string;
}

/** How much to zoom into the source art so the face fills the frame instead of the full body. */
const ZOOM_PERCENT = 250;

/**
 * Renders a square portrait zoomed and positioned onto its character's face
 * (DISPLAY_AVATAR_FOCUS_BY_TEMPLATE_ID), for small avatar contexts (TopBar,
 * profile modal, avatar picker) — unlike CharacterPortrait, which shows the
 * full card art elsewhere (roster, shop).
 */
export function AvatarCrop({ templateId, portraitUrl, alt, size = 40, className = '' }: AvatarCropProps) {
  const focus = DISPLAY_AVATAR_FOCUS_BY_TEMPLATE_ID[templateId] ?? DISPLAY_AVATAR_FOCUS_FALLBACK;
  const left = 50 - (focus.x * ZOOM_PERCENT) / 100;
  const top = 50 - (focus.y * ZOOM_PERCENT) / 100;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={portraitUrl}
        alt={alt}
        className="absolute max-w-none"
        style={{ width: `${ZOOM_PERCENT}%`, height: `${ZOOM_PERCENT}%`, left: `${left}%`, top: `${top}%` }}
      />
    </div>
  );
}
