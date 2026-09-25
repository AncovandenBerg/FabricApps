import { useEffect, useState } from 'react';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

/**
 * Everything inside is authored once in "projector pixels" on a fixed
 * 1920x1080 canvas, then the whole canvas is scaled (never stretched) to fit
 * whatever screen it's actually displayed on — a 4K display, a 720p test
 * monitor, or a laptop while rehearsing. Author real sizes; let this handle
 * fitting them.
 */
export function ProjectorCanvas({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      setScale(Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
