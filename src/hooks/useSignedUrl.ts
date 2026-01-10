import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'lotes';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

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
      setLoading(true);
      
      supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRY)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error creating signed URL:', error);
            setSignedUrl(null);
          } else {
            setSignedUrl(data.signedUrl);
          }
          setLoading(false);
        });
    }
  }, [imagePathOrUrl]);

  return { signedUrl, loading };
}
