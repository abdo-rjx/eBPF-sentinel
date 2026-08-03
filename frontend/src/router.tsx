import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { ConsoleLayout } from '@/components/layout/ConsoleLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';

const Landing = lazy(() => import('@/pages/Landing'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const HowItWorks = lazy(() => import('@/pages/HowItWorks'));
const Threats = lazy(() => import('@/pages/Threats'));
const About = lazy(() => import('@/pages/About'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: '/', element: <LazyPage><Landing /></LazyPage> },
      { path: '/how-it-works', element: <LazyPage><HowItWorks /></LazyPage> },
      { path: '/threats', element: <LazyPage><Threats /></LazyPage> },
      { path: '/about', element: <LazyPage><About /></LazyPage> },
      { path: '*', element: <LazyPage><NotFound /></LazyPage> },
    ],
  },
  {
    element: <ConsoleLayout />,
    children: [{ path: '/dashboard', element: <LazyPage><Dashboard /></LazyPage> }],
  },
]);
