import { Toaster as Sonner } from 'sonner';

// Styled to match the prototype's .toast class (dark pill, centered
// bottom) rather than sonner's own default card look.
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'bg-[var(--ink)] flex items-center flex-row gap-4 text-white px-[18px] py-[11px] rounded-full text-sm shadow-[0_6px_24px_rgba(16,40,58,0.25)]',
        },
      }}
    />
  );
}
