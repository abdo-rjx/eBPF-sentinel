import { PageHeader } from '@/components/layout/PageHeader';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { Architecture } from '@/sections/Architecture';
import styles from './About.module.css';

const STACK = [
  { name: 'eBPF / C', role: 'Collector', detail: 'Hooks seven syscalls in the kernel and streams NDJSON over a Unix socket. Runs as root on the host.' },
  { name: 'FastAPI / Python', role: 'Backend', detail: 'Windowing, feature vectors, Isolation Forest scoring, and the REST + SSE API on :8000.' },
  { name: 'scikit-learn', role: 'Model', detail: 'An unsupervised Isolation Forest fitted on a baseline CSV. No labeled training set required.' },
  { name: 'SQLite', role: 'Storage', detail: 'One denormalized windows table with a 24-hour retention pruner.' },
  { name: 'React / Vite / TS', role: 'Frontend', detail: 'The live console and this site — lazy routes, a custom SVG chart, and a 3D constellation.' },
  { name: 'Server-Sent Events', role: 'Transport', detail: 'Scored windows stream live the moment they are written; the console never polls for them.' },
];

const LIMITATIONS = [
  {
    title: 'Unsupervised means false positives',
    body: 'The model flags deviation, not malice. A legitimate but unusual process will trip an alert. That is the trade for shipping with no signatures.',
  },
  {
    title: 'Monotonic, not wall-clock, timestamps',
    body: 'window_start_ns and window_end_ns are elapsed-since-boot, not epoch. The UI deliberately renders clock times from created_at only.',
  },
  {
    title: 'Single-host scope',
    body: 'This is a per-host instrument, not a fleet dashboard. There is no cross-host correlation and no network graph beyond per-process destination IPs.',
  },
];

export default function About() {
  return (
    <div className="container">
      <PageHeader
        eyebrow="About"
        title="A single-host behavioral EDR you can actually run."
        lede="Sentinel is a teaching-grade host intrusion detection system: real eBPF hooks, a real ML model, and a real live console — small enough to read in an afternoon."
      />

      <Reveal>
        <div className={styles.narrative}>
          <p className={styles.para}>
            Most IDS products lean on signature databases that must be updated faster than
            attackers can mutate. Sentinel takes the opposite route: it watches how processes
            actually behave and flags the ones that stop behaving normally. Because the watching
            happens in the kernel, nothing in userland has to trust the agent.
          </p>
          <p className={styles.para}>
            The project is three physically separate tiers — an eBPF collector, a Python scoring
            backend, and a React console — wired together over narrow, versioned wire formats. It
            is honest about its scope: one host, seven syscalls, five-second windows.
          </p>
        </div>
      </Reveal>

      <Architecture />

      <Reveal>
        <h2 className={styles.sectionTitle}>Stack</h2>
      </Reveal>
      <div className={styles.stack}>
        {STACK.map((item, i) => (
          <Reveal key={item.name} delay={(i % 3) * 0.06} className={styles.stackCardWrap}>
            <article className={styles.stackCard}>
              <p className={styles.stackRole}>{item.role}</p>
              <h3 className={styles.stackName}>{item.name}</h3>
              <p className={styles.stackDetail}>{item.detail}</p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className={styles.sectionTitle}>Honest limitations</h2>
      </Reveal>
      <div className={styles.limits}>
        {LIMITATIONS.map((l, i) => (
          <Reveal key={l.title} delay={(i % 3) * 0.06} className={styles.limitWrap}>
            <article className={styles.limit}>
              <h3 className={styles.limitTitle}>{l.title}</h3>
              <p className={styles.limitBody}>{l.body}</p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal className={styles.links}>
        <ButtonLink to="/dashboard" variant="primary">Open live console</ButtonLink>
        <ButtonLink to="/how-it-works" variant="secondary">How it works</ButtonLink>
      </Reveal>
    </div>
  );
}
