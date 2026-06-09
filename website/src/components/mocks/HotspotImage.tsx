import { useState } from 'react';
import type { Hotspot } from '../../data/types';

interface Props {
  src: string;
  alt?: string;
  hotspots?: Hotspot[];
}

export default function HotspotImage({ src, alt = 'Image', hotspots = [] }: Props) {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  return (
    <div className="relative inline-block">
      <img src={src} alt={alt} className="w-full rounded-lg" />
      {hotspots.map((hotspot, idx) => (
        <button
          key={idx}
          className="absolute w-4 h-4 bg-yellow-400 border-2 border-white rounded-full shadow hover:scale-125 transition-transform cursor-pointer"
          style={{
            left: `${hotspot.x}%`,
            top: `${hotspot.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={() => setActiveHotspot(activeHotspot === `hs-${idx}` ? null : `hs-${idx}`)}
          title={hotspot.description}
        >
          {activeHotspot === `hs-${idx}` && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap z-10">
              {hotspot.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
