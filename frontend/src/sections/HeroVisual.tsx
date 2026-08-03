import styles from './HeroVisual.module.css';

/**
 * Static kernel-core illustration for the hero. Replaced by the lazy 3D
 * KernelCoreScene in the 3D phase — the panel chrome stays identical.
 */
export function HeroVisual() {
  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        <span className={styles.lede}>CORE / ACTIVE</span>
        <span className={styles.lede}>pid 2417</span>
      </div>

      <svg
        viewBox="0 0 420 420"
        role="img"
        aria-label="Stylized kernel core: concentric rings, an orbiting node, and an anomaly spike"
        className={styles.svg}
      >
        <line className={styles.tick} x1="24" y1="24" x2="52" y2="24" />
        <line className={styles.tick} x1="24" y1="24" x2="24" y2="52" />
        <line className={styles.tick} x1="396" y1="24" x2="368" y2="24" />
        <line className={styles.tick} x1="396" y1="24" x2="396" y2="52" />
        <line className={styles.tick} x1="24" y1="396" x2="52" y2="396" />
        <line className={styles.tick} x1="24" y1="396" x2="24" y2="368" />
        <line className={styles.tick} x1="396" y1="396" x2="368" y2="396" />
        <line className={styles.tick} x1="396" y1="396" x2="396" y2="368" />

        <circle className={styles.ringOuter} cx="210" cy="210" r="168" />
        <circle className={styles.ringDashed} cx="210" cy="210" r="128" strokeDasharray="3 7" />
        <circle className={styles.ringInner} cx="210" cy="210" r="86" />

        <ellipse className={styles.orbit} cx="210" cy="210" rx="152" ry="66" transform="rotate(-24 210 210)" />
        <circle className={styles.node} cx="330" cy="126" r="6" />

        <line className={styles.needle} x1="210" y1="210" x2="210" y2="126" />
        <line className={styles.needleSoft} x1="210" y1="210" x2="210" y2="294" />
        <circle className={styles.core} cx="210" cy="210" r="8" />

        <rect className={styles.dot} x="62" y="150" width="5" height="5" />
        <rect className={styles.dot} x="336" y="300" width="5" height="5" />
        <rect className={styles.dotDanger} x="132" y="66" width="5" height="5" />
        <rect className={styles.dotDanger} x="292" y="348" width="5" height="5" />
      </svg>

      <div className={styles.bar}>
        <span className={styles.lede}>SCORE −0.31</span>
        <span className={styles.danger}>ANOMALY</span>
      </div>
    </div>
  );
}
