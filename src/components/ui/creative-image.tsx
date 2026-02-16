import { useState, useEffect, useSyncExternalStore } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface CreativeImageProps {
  projectId: string | undefined;
  adId: string;
  cachedImageUrl?: string | null;
  creativeImageUrl?: string | null;
  creativeThumbnail?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onError?: () => void;
}

// Helper to clean image URLs - removes stp resize parameters to get HD images
const cleanImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  // Remove stp= parameter that forces resize
  let clean = url.replace(/[&?]stp=[^&]*/gi, '');
  
  // Remove size parameters in path
  clean = clean.replace(/\/p\d+x\d+\//g, '/');
  clean = clean.replace(/\/s\d+x\d+\//g, '/');
  
  // Fix malformed URL: if & appears before any ?, replace first & with ?
  if (clean.includes('&') && !clean.includes('?')) {
    clean = clean.replace('&', '?');
  }
  
  // Clean trailing ? or &
  clean = clean.replace(/[&?]$/g, '');
  
  return clean;
};

// Global cache version with subscription pattern for React re-renders
let globalCacheVersion = Date.now();
const listeners = new Set<() => void>();

export const invalidateCreativeImageCache = () => {
  globalCacheVersion = Date.now();
  // Notify all subscribed components to re-render
  listeners.forEach(listener => listener());
};

// Hook to subscribe to cache version changes
const useCacheVersion = () => {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => globalCacheVersion
  );
};

// Build Storage URL for cached creative images with cache-busting
const getStorageImageUrl = (projectId: string | undefined, adId: string, cacheVersion: number): string | null => {
  if (!projectId) return null;
  const { data } = supabase.storage.from('creative-images').getPublicUrl(`${projectId}/${adId}.jpg`);
  if (!data?.publicUrl) return null;
  // Use cache version for instant invalidation after sync
  return `${data.publicUrl}?v=${cacheVersion}`;
};

export function CreativeImage({
  projectId,
  adId,
  cachedImageUrl,
  creativeImageUrl,
  creativeThumbnail,
  alt,
  className,
  fallbackClassName,
  onError
}: CreativeImageProps) {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const cacheVersion = useCacheVersion();

  // Helper: check if URL contains low-res resize params
  const isLowResUrl = (url: string | null): boolean => {
    if (!url) return false;
    return /p64x64|p100x100|s64x64|s100x100/i.test(url);
  };

  // Build list of URLs to try in priority order
  const urls: string[] = [];
  
  // 1. Cached image URL from database (only if not low-res)
  const cleanedCachedUrl = cleanImageUrl(cachedImageUrl);
  if (cleanedCachedUrl && !isLowResUrl(cachedImageUrl)) urls.push(cleanedCachedUrl);
  
  // 2. Storage URL (permanent, never expires)
  const storageUrl = getStorageImageUrl(projectId, adId, cacheVersion);
  if (storageUrl) urls.push(storageUrl);
  
  // 3. Creative image URL (cleaned)
  const cleanedCreativeUrl = cleanImageUrl(creativeImageUrl);
  if (cleanedCreativeUrl) urls.push(cleanedCreativeUrl);
  
  // 4. Creative thumbnail (cleaned)
  const cleanedThumbnail = cleanImageUrl(creativeThumbnail);
  if (cleanedThumbnail) urls.push(cleanedThumbnail);

  const currentUrl = urls[currentUrlIndex];

  // Reset state when URLs change
  useEffect(() => {
    setCurrentUrlIndex(0);
    setHasError(false);
  }, [projectId, adId, cachedImageUrl, creativeImageUrl, creativeThumbnail]);

  const handleError = () => {
    // Try next URL
    if (currentUrlIndex < urls.length - 1) {
      setCurrentUrlIndex(prev => prev + 1);
    } else {
      // All URLs failed
      setHasError(true);
      onError?.();
    }
  };

  if (hasError || !currentUrl) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-muted", fallbackClassName)}>
        <ImageOff className="w-8 h-8 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img 
      src={currentUrl}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
