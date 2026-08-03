import { useEffect, useState } from 'react';

/**
 * Tracks prefers-reduced-motion. Scenes render statically (no useFrame
 * rotation/parallax) when the user asks for reduced motion; the canvas still
 * paints so layout never jumps.
 */
export function useSceneReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
