# Sentinel Frontend Rebuild

Frontend-only rebuild of `frontend/`. The backend is **not** touched.

Goal: a professional, multi-page site with 3D and scroll effects, built as a distinctive dark **"teal on slate"** console that avoids AI-generated-UI tells.

## Decisions

- **Scope**: multi-page site — Landing, Dashboard, How It Works, Threat Intel, About (+ 404).
- **3D & motion**: Three.js (`@react-three/fiber` + `drei`) code-split to `/` and `/dashboard`; Framer Motion for scroll/UI.
- **Stack**: React 18 + Vite + **TypeScript**. No Tailwind, no new test framework.
- **Palette**: base `#0b0e13`, surface `#12161d`, accent `#2dd4bf`, danger `#ff6b5e`, warning `#ffb224`, success `#2fc98a`.
- **Type**: Bricolage Grotesque (display) / Instrument Sans (body) / Martian Mono (data), self-hosted via `@fontsource`.

## Backend contract (unchanged, read-only)

- FastAPI on `http://localhost:8000`, CORS `*`. Frontend runs separately on :5173.
- REST uses `Authorization: Bearer <token>`; SSE must use `?token=` (native EventSource limitation; backend `verify_token_any` accepts it).
- Endpoints: `/health`, `/api/v1/windows`, `/api/v1/windows/{id}`, `/api/v1/windows/{id}/analysis`, `/api/v1/processes`, `/api/v1/stats`, `/api/v1/stream` (SSE).
- Window fields: `id, pid, ppid, comm, window_start_ns, window_end_ns, num_execve, num_distinct_children, num_file_opens, num_file_renames, num_file_deletes, num_distinct_files_touched, num_connect, num_distinct_dest_ips, num_setuid, syscall_rate, anomaly_score, is_anomalous, created_at`.
- `anomaly_score` is **negative** for anomalies; `is_anomalous` is authoritative. Never invert.
- Render clock times from `created_at` only. `window_start_ns`/`window_end_ns` are CLOCK_MONOTONIC.
- Demo mode: if `VITE_API_BASE`/`VITE_API_TOKEN` are unset (URL contains `"undefined"`), generate mock data (works with no backend). `VITE_API_BASE` default `http://localhost:8000`.
- Severity rule (frontend-only): `is_anomalous → CRITICAL`, `anomaly_score < 0 → SUSPICIOUS`, else `BENIGN`.

## Design rules (anti-slop)

- No glassmorphism-as-default, no `backdrop-filter: blur()` surfaces, no gradient text, no glow shadows / radial background glows.
- Elevation = border + **offset** shadow (`4px 4px 0 0` for primary CTA / hero panel). Small radii (2–8px).
- No pulsing decorative dots (connection state = static square/outline glyph + text), no marquees, no emoji.
- Easing everywhere: `cubic-bezier(0.16, 1, 0.3, 1)`. No bounce/elastic/spring.
- All hex lives in `styles/tokens.css`; components use CSS variables only.

## File map

```
frontend/
  index.html  vite.config.ts  tsconfig.json  tsconfig.node.json  package.json
  public/favicon.svg
  src/
    main.tsx  App.tsx  router.tsx  env.d.ts
    styles/{tokens,base,utilities}.css
    types/index.ts
    lib/{config,severity,format}.ts
    lib/api/{client,schema}.ts
    lib/demo/generator.ts
    lib/data/threats.ts
    hooks/{useSentinelStream,useDashboardData,useFocusTrap,useKeyPress}.ts
    components/
      brand/{Logo,ConnectionPill,DemoBadge}.tsx
      layout/{SiteHeader,Footer,MarketingLayout,ConsoleLayout,ScrollProgress,MobileNav,SkipLink}.tsx
      ui/{Button,Panel,SeverityBadge,StatCard,Table,EmptyState,CodeBlock,Tooltip,Skeleton,Reveal}.tsx
      charts/{AnomalyChart,FeatureBars,FeatureRadar,MiniSpark}.tsx
      dashboard/{KpiRow,AnomalyTimeline,ProcessTable,ProcessDetailDrawer,AIAnalysisPanel,SimulationGuide,LiveVisualizer}.tsx
      threats/{SignatureCard,ThreatMatrix}.tsx
      three/{SceneProvider,useSceneReducedMotion,KernelCoreScene,AnomalyConstellation}.tsx
    pages/{Landing,Dashboard,HowItWorks,Threats,About,NotFound}.tsx
    sections/{Hero,StatsStrip,DetectionModel,ThreatVignettes,Architecture,Features,CtaSection}.tsx
```

Old JS files removed once ported: `src/App.jsx`, `main.jsx`, `index.css`, `api/client.js`, `hooks/useEventStream.js`, `components/*.jsx`.

## Implementation phases

1. **Scaffold & tooling** — package.json deps, strict tsconfig, vite.config.ts (alias + manualChunks + optimizeDeps), env.d.ts, index.html. `tsc --noEmit` + build clean.
2. **Design tokens & brand** — styles/*, fonts, favicon, Logo.
3. **Layout & routing** — router, two layouts, header/footer/nav, ScrollProgress, SkipLink, transitions, NotFound.
4. **Landing (no 3D)** — hero, stats, detection model, threat vignettes, architecture, features, CTA.
5. **3D scenes** — SceneProvider, KernelCoreScene, AnomalyConstellation, LiveVisualizer.
6. **Data layer** — types, zod guards, REST client, demo generator, SSE hook, dashboard orchestrator.
7. **Dashboard** — KPI row, custom SVG timeline chart, process table, drawer (a11y), AI analysis (real `/analysis` + fallback), simulation guide.
8. **Content pages** — How It Works, Threat Intel (+ radar charts), About, 404.
9. **Polish & verify** — a11y, reduced-motion, bundle sizes, build + typecheck, browser checklist.

## Verification

```
npm run dev        # demo mode first (no .env)
npm run build      # succeeds; three chunk only on / and /dashboard
npm run preview    # re-check built output in demo mode
npx tsc --noEmit   # clean
```

Live backend check: `cd backend && export API_AUTH_TOKEN=<t> && uvicorn sentinel_backend.api.main:app --reload`, then `frontend/.env` with `VITE_API_BASE=http://localhost:8000` and `VITE_API_TOKEN=<t>`. On Windows the SSE stream stays silent (no collector/socket) — the empty state is expected; on Linux run `test/simulate_ransomware.py` to see a CRITICAL window within ~5s.
