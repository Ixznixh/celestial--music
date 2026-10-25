import React, { useState, useEffect, useMemo } from 'react';
import { Music } from 'lucide-react';
import { fetchSongArtwork } from '../../services/thumbnailEnricher';

interface ArtworkImageProps {
  src?: string;
  alt: string;
  artist?: string;
  className?: string;
  aspectRatio?: 'square' | 'wide' | 'avatar';
  rounded?: string;
  fallbackVideoId?: string;
  size?: 'small' | 'medium' | 'large' | 'full';
  /** Above-the-fold art (now playing, page headers) starts loading immediately. */
  priority?: boolean;
  /** Tints the loading skeleton so the grid does not flash flat grey. */
  placeholderColor?: string;
}

/**
 * Dynamically adjusts artwork resolution based on placement (from compact 240px up to 544px crystal clear)
 * ensuring ultra-fast load times on all screens without blurry compression or missing 404 variants.
 */
export function upgradeArtworkUrl(url?: string, size: 'small' | 'medium' | 'large' | 'full' = 'medium'): string | undefined {
  if (!url) return url;
  let clean = url.startsWith('//') ? `https:${url}` : url;

  // Always upgrade JioSaavn artwork to full 500x500 CDN resolution
  if (clean.includes('saavncdn.com')) {
    clean = clean.replace(/-(?:50x50|150x150|250x250)\.jpg/i, '-500x500.jpg');
    clean = clean.replace('50x50', '500x500').replace('150x150', '500x500');
    return clean;
  }

  const dim = size === 'small' ? 240 : size === 'medium' ? 400 : 544;

  // Upgrade Google/YouTube user content to crystal clear resolution
  if (clean.includes('googleusercontent.com') || clean.includes('ggpht.com')) {
    if (clean.includes('=w') || clean.includes('=s')) {
      clean = clean.replace(/=w\d+-h\d+[^?&#]*/g, `=w${dim}-h${dim}-l90-rj`);
      clean = clean.replace(/=s\d+[^?&#]*/g, `=s${dim}-c-k-c0x00ffffff-no-rj`);
    } else {
      clean = `${clean}=w${dim}-h${dim}-l90-rj`;
    }
  }

  // Pick the thumbnail variant that actually matches the box it lands in.
  // hqdefault (480x360) is available on 100% of YouTube tracks and never 404s.
  // mqdefault (320x180) is ultra-fast for rows and small cards.
  if (clean.includes('i.ytimg.com')) {
    clean = clean.replace(/[?&]sqp=[^&#]*/g, '').replace(/[?&]rs=[^&#]*/g, '');
    clean = clean.replace(/\?&/g, '?').replace(/[?&]$/, '');

    const match = clean.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//);
    if (match && match[1]) {
      const vidId = match[1];
      const variant = size === 'small' ? 'mqdefault.jpg' : 'hqdefault.jpg';
      clean = `https://i.ytimg.com/vi/${vidId}/${variant}`;
    }
  }

  return clean;
}

export const ArtworkImage: React.FC<ArtworkImageProps> = ({
  src,
  alt,
  artist,
  className = '',
  aspectRatio = 'square',
  rounded = 'rounded-xl',
  fallbackVideoId,
  size = 'medium',
  priority = false,
  placeholderColor,
}) => {
  const [dynamicSrc, setDynamicSrc] = useState<string | null>(null);

  const isValidInitialSrc = src && !src.includes('unsplash.com') && !src.includes('placeholder');
  const baseSrc = isValidInitialSrc ? src : (dynamicSrc || undefined);

  // Upgraded source based on optimal requested size
  const optimizedSrc = useMemo(() => upgradeArtworkUrl(baseSrc, size as 'small' | 'medium' | 'large' | 'full'), [baseSrc, size]);

  // Stage 0: Direct optimized src, Stage 1: hqdefault.jpg (reliable), Stage 2: /api/image-proxy, Stage 3: placeholder
  const [stage, setStage] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    setStage(0);
    setIsLoaded(false);
  }, [optimizedSrc]);

  // If initial src is missing or an unsplash placeholder, resolve real JioSaavn artwork dynamically
  useEffect(() => {
    if (!isValidInitialSrc && alt && alt.length > 2 && alt !== 'Celestial Music' && alt !== 'Playlist') {
      let active = true;
      fetchSongArtwork(alt, artist).then((res) => {
        if (active && res) {
          setDynamicSrc(res);
        }
      });
      return () => { active = false; };
    }
  }, [isValidInitialSrc, alt, artist]);

  // Extract video ID from URL or fallback prop
  const videoId = useMemo(() => {
    if (fallbackVideoId) return fallbackVideoId;
    if (!baseSrc && !optimizedSrc) return null;
    const candidate = baseSrc || optimizedSrc || '';
    const match = candidate.match(/(?:vi\/|v=|\/)([a-zA-Z0-9_-]{11})(?:\/|\.|\?|$)/);
    return match ? match[1] : null;
  }, [baseSrc, optimizedSrc, fallbackVideoId]);

  // Determine current image URL based on fallback stage
  const currentSrc = useMemo(() => {
    if (!optimizedSrc && !videoId) return null;

    if (stage === 0) {
      return optimizedSrc;
    }
    if (stage === 1 && videoId) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
    if (stage === 2 && (optimizedSrc || videoId)) {
      const target = optimizedSrc || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      return `/api/image-proxy?url=${encodeURIComponent(target)}`;
    }
    return null;
  }, [optimizedSrc, stage, videoId]);

  const handleError = () => {
    if (stage === 0 && videoId && optimizedSrc !== `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`) {
      setStage(1);
    } else if (stage < 2 && (optimizedSrc || videoId)) {
      setStage(2);
    } else if (!dynamicSrc && alt && alt.length > 2 && alt !== 'Celestial Music' && alt !== 'Playlist') {
      // Last-mile recovery: fetch song artwork from JioSaavn by title/artist
      fetchSongArtwork(alt, artist).then((res) => {
        if (res) {
          setDynamicSrc(res);
          setStage(0);
        } else {
          setStage(3);
        }
      });
    } else {
      setStage(3);
    }
  };

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'wide'
      ? 'aspect-16/9'
      : 'aspect-square rounded-full';

  const showPlaceholder = !currentSrc || stage === 3;
  // Never show a half-decoded image: the box holds a skeleton until the bitmap is ready.
  const showSkeleton = Boolean(currentSrc) && !isLoaded && stage !== 3;

  return (
    <div
      className={`relative overflow-hidden shadow-sm select-none ${aspectClass} ${
        aspectRatio === 'avatar' ? 'rounded-full' : rounded
      } ${className}`}
      style={placeholderColor ? { backgroundColor: placeholderColor } : undefined}
    >
      {/* Skeleton layer: art-adjacent colour where we know it, neutral otherwise */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gradient-to-br from-neutral-800 to-neutral-900"
        style={placeholderColor ? { backgroundColor: placeholderColor } : undefined}
      >
        <Music className="h-2/5 w-2/5 text-neutral-600/40" />
        {showSkeleton && (
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
        )}
      </div>

      {/* Actual image layer */}
      {currentSrc && !showPlaceholder && (
        <img
          key={`${currentSrc}-${stage}`}
          src={currentSrc}
          alt={alt}
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          onError={handleError}
          onLoad={() => setIsLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};


