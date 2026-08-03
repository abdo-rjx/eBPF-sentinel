import { Hero } from '@/sections/Hero';
import { StatsStrip } from '@/sections/StatsStrip';
import { DetectionModel } from '@/sections/DetectionModel';
import { ThreatVignettes } from '@/sections/ThreatVignettes';
import { Architecture } from '@/sections/Architecture';
import { Features } from '@/sections/Features';
import { CtaSection } from '@/sections/CtaSection';

export default function Landing() {
  return (
    <>
      <Hero />
      <StatsStrip />
      <DetectionModel />
      <ThreatVignettes />
      <Architecture />
      <Features />
      <CtaSection />
    </>
  );
}
