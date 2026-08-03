import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import styles from './SceneProvider.module.css';

interface SceneProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
  cameraZ?: number;
  'aria-label'?: string;
}

/**
 * Shared R3F canvas wrapper. Clamps DPR and fov so the constellation/core
 * stay crisp without burning fill-rate; Suspense keeps the static SVG fallback
 * painted until the geometry mounts so layout never jumps.
 */
export function SceneProvider({
  children,
  fallback,
  cameraZ = 8,
  'aria-label': ariaLabel,
}: SceneProviderProps) {
  return (
    <div className={styles.wrap} role="img" aria-label={ariaLabel}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, cameraZ], fov: 45 }}
        className={styles.canvas}
      >
        <Suspense fallback={fallback ?? null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
