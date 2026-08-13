interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center lg:bottom-6">
      <div className="rounded-full border border-code-500/30 bg-void-900/95 px-4 py-2 font-mono text-xs text-code-300 shadow-lg backdrop-blur-md">
        {message}
      </div>
    </div>
  );
}
