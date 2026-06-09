import { useState } from 'react';
import type { PreviewAsset } from '../../data/types';
import HotspotImage from './HotspotImage';

interface Props {
  assets: PreviewAsset[];
}

export default function PreviewGallery({ assets }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!assets || assets.length === 0) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
        <span>No previews available</span>
      </div>
    );
  }

  const current = assets[selectedIndex];
  const hasHotspots = current.hotspots && current.hotspots.length > 0;

  return (
    <div className="space-y-3">
      {/* Main Preview */}
      <div
        className="bg-gray-100 rounded-lg overflow-hidden relative"
        onClick={() => !hasHotspots && setLightbox(true)}
        style={{ cursor: hasHotspots ? 'default' : 'pointer' }}
      >
        {current.type === 'video' ? (
          <div className="aspect-video">
            <video src={current.src} controls className="w-full h-full object-contain" />
          </div>
        ) : hasHotspots ? (
          <div>
            <HotspotImage
              src={current.src}
              alt={current.caption || 'Preview'}
              hotspots={current.hotspots}
            />
          </div>
        ) : (
          <div className="aspect-video">
            <img src={current.src} alt={current.caption || 'Preview'} className="w-full h-full object-contain" />
          </div>
        )}
        {current.caption && !hasHotspots && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-3 py-1">
            {current.caption}
          </div>
        )}
        {current.caption && hasHotspots && (
          <div className="mt-1 text-xs text-gray-500 px-1">
            {current.caption} — click the yellow markers for details
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {assets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {assets.map((asset, idx) => {
            const itemHasHotspots = asset.hotspots && asset.hotspots.length > 0;
            return (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`flex-shrink-0 w-20 h-14 rounded border-2 overflow-hidden transition-colors relative ${
                  idx === selectedIndex ? 'border-primary-500' : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                {asset.type === 'video' ? (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                    Video
                  </div>
                ) : (
                  <img src={asset.src} alt={asset.caption || `Preview ${idx + 1}`} className="w-full h-full object-cover" />
                )}
                {itemHasHotspots && (
                  <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-white" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setLightbox(false)}
        >
          <div className="max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            {current.type === 'video' ? (
              <video src={current.src} controls className="max-w-full max-h-[80vh]" />
            ) : (
              <img src={current.src} alt={current.caption || 'Preview'} className="max-w-full max-h-[80vh] object-contain" />
            )}
            {current.caption && (
              <p className="text-white text-center mt-2 text-sm">{current.caption}</p>
            )}
          </div>
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
