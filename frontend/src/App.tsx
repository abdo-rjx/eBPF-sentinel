import { MotionConfig } from 'framer-motion';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { SentinelProvider } from '@/context/SentinelContext';

export default function App() {
  return (
    <SentinelProvider>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </SentinelProvider>
  );
}
