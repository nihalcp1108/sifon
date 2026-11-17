import { useEffect, useState } from 'react';

/**
 * Animated number counter hook.
 * Counts up smoothly on initial render and respects prefers-reduced-motion.
 */
export function useCountUp(endVal: number, durationMs = 450): number {
  const [val, setVal] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return endVal;
    }
    return 0;
  });

  useEffect(() => {
    // Respect user's motion preference
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVal(endVal);
      return;
    }

    if (endVal === 0) {
      setVal(0);
      return;
    }

    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * endVal));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [endVal, durationMs]);

  return val;
}

