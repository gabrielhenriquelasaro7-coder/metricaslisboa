import { useState, useEffect } from 'react';
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

// Build Storage URL for cached creative images
const getStorageImageUrl = (projectId: string | undefined, adId: string): string | null => {
  if (!projectId) return null;
  const { data } = supabase.storage.from('creative-images').getPublicUrl(`${projectId}/${adId}.jpg`);
  return data?.publicUrl || null;
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

  // Build list of URLs to try in priority order
  const urls: string[] = [];
  
  // 1. Storage URL (permanent, never expires)
  const storageUrl = getStorageImageUrl(projectId, adId);
  if (storageUrl) urls.push(storageUrl);
  
  // 2. Cached image URL from database
  if (cachedImageUrl) urls.push(cachedImageUrl);
  
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
