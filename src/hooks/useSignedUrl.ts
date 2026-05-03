import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'lotes';
const SIGNED_URL_EXPIRY = 3600; // 1 hour
const CACHE_TTL = 50 * 60 * 1000; // 50 minutes in ms (before the 1hr expiry)

// In-memory cache for signed URLs
interface CacheEntry {
  url: string;
  expiresAt: number;
}

const signedUrlCache = new Map<string, CacheEntry>();

// Clean expired entries periodically
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of signedUrlCache.entries()) {
    if (entry.expiresAt <= now) {
      signedUrlCache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanExpiredCache, 5 * 60 * 1000);
}

export function useSignedUrl(imagePathOrUrl: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imagePathOrUrl) {
      setSignedUrl(null);
      return;
    }

    // Check if it's already a full URL (external or signed)
    const isFullUrl = imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://');
    
    if (isFullUrl) {
      // Check if it's a Supabase storage URL that needs signing
      const isSupabaseStorageUrl = imagePathOrUrl.includes('supabase.co/storage');
      
      if (!isSupabaseStorageUrl) {
        // External URL, use as-is
        setSignedUrl(imagePathOrUrl);
        return;
      }

      // Extract the path from the public URL
      const pathMatch = imagePathOrUrl.match(/\/object\/public\/lotes\/(.+)$/);
      if (!pathMatch) {
        setSignedUrl(imagePathOrUrl);
        return;
      }

      const filePath = pathMatch[1];
      generateSignedUrl(filePath);
    } else {
      // It's just a path (e.g., "user_id/filename.png"), generate signed URL directly
      generateSignedUrl(imagePathOrUrl);
    }

    function generateSignedUrl(filePath: string) {
      // Check cache first
      const cached = signedUrlCache.get(filePath);
      if (cached && cached.expiresAt > Date.now()) {
        setSignedUrl(cached.url);
        setLoading(false);
        return;
      }

      setLoading(true);
      
      supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRY)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error creating signed URL:', error);
            setSignedUrl(null);
          } else {
            // Cache the URL
            signedUrlCache.set(filePath, {
              url: data.signedUrl,
              expiresAt: Date.now() + CACHE_TTL,
            });
            setSignedUrl(data.signedUrl);
          }
          setLoading(false);
        });
    }
  }, [imagePathOrUrl]);

  return { signedUrl, loading };
}

// Utility to clear cache for a specific path (useful after image update)
export function clearSignedUrlCache(filePath?: string) {
  if (filePath) {
    signedUrlCache.delete(filePath);
  } else {
    signedUrlCache.clear();
  }
}
