import type { CSSProperties } from 'react';

interface PixelFigureProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Coarse pixel-art humanoid silhouette — the placeholder card art until real
 * per-character sprites exist (see DISPLAY_PORTRAIT_BY_TEMPLATE_ID). Drawn as
 * blocky rects on a 16x20 grid with crisp edges, deliberately low-res so it
 * reads the same way a small compact pixel-art sprite will later.
 */
export function PixelFigure({ className, style }: PixelFigureProps) {
  return (
    <svg viewBox="0 0 16 20" className={className} style={style} shapeRendering="crispEdges" aria-hidden>
      {/* head (blocky octagon) */}
      <rect x={6} y={1} width={4} height={1} fill="currentColor" />
      <rect x={5} y={2} width={6} height={4} fill="currentColor" />
      <rect x={6} y={6} width={4} height={1} fill="currentColor" />
      {/* neck */}
      <rect x={7} y={7} width={2} height={1} fill="currentColor" />
      {/* arms */}
      <rect x={3} y={8} width={2} height={5} fill="currentColor" opacity={0.75} />
      <rect x={11} y={8} width={2} height={5} fill="currentColor" opacity={0.75} />
      {/* torso */}
      <rect x={5} y={8} width={6} height={6} fill="currentColor" />
      {/* legs */}
      <rect x={6} y={14} width={2} height={6} fill="currentColor" opacity={0.85} />
      <rect x={8} y={14} width={2} height={6} fill="currentColor" />
      {/* shading strip (subtle depth, mirrors the light/shadow pixel-art convention) */}
      <rect x={9} y={2} width={2} height={4} fill="currentColor" opacity={0.35} />
      <rect x={9} y={8} width={2} height={6} fill="currentColor" opacity={0.35} />
      <rect x={9} y={14} width={1} height={6} fill="currentColor" opacity={0.35} />
    </svg>
  );
}
