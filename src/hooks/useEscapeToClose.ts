import { useEffect } from 'react';

/**
 * Closes an overlay when Escape is pressed.
 *
 * Every modal in the app could be dismissed by clicking its backdrop and nothing else, which
 * leaves anyone on a keyboard with no way out — and costs mouse users the gesture they already
 * expect. Listening on the document (rather than the overlay) means it works without the overlay
 * having to hold focus.
 *
 * Pass `enabled: false` for an overlay that must not be dismissible at that moment — a battle
 * mid-playback, say, where Escape would skip content rather than close a dialog.
 */
export function useEscapeToClose(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, enabled]);
}
