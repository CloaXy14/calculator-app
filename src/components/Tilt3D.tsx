import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Keep the entire instrument stationary and visible, including on short screens.
export const Tilt3D = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const device = ref.current;
    const viewport = device?.parentElement;
    if (!device || !viewport) return;

    const fit = () => {
      const scale = Math.min(1, Math.max(1, viewport.clientHeight - 40) / Math.max(1, device.offsetHeight));
      device.style.setProperty('--device-scale', String(scale));
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(device);
    observer?.observe(viewport);
    window.addEventListener('resize', fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return <div className="device-stage" ref={ref}>{children}</div>;
};
