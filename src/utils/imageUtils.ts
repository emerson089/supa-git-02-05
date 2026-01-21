import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'lotes';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Gets a signed URL for an image path in Supabase Storage
 */
export async function getSignedUrl(imagePathOrUrl: string | null | undefined): Promise<string | null> {
  if (!imagePathOrUrl) return null;

  // Check if it's already a full URL (external or signed)
  const isFullUrl = imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://');
  
  if (isFullUrl) {
    // Check if it's a Supabase storage URL that needs signing
    const isSupabaseStorageUrl = imagePathOrUrl.includes('supabase.co/storage');
    
    if (!isSupabaseStorageUrl) {
      // External URL, use as-is
      return imagePathOrUrl;
    }

    // Extract the path from the public URL
    const pathMatch = imagePathOrUrl.match(/\/object\/public\/lotes\/(.+)$/);
    if (!pathMatch) {
      return imagePathOrUrl;
    }

    const filePath = pathMatch[1];
    return generateSignedUrl(filePath);
  } else {
    // It's just a path (e.g., "user_id/filename.png"), generate signed URL directly
    return generateSignedUrl(imagePathOrUrl);
  }
}

async function generateSignedUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

/**
 * Converts an image URL to base64 for embedding in PDFs
 */
export async function getImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao converter imagem para base64:', error);
    return null;
  }
}

/**
 * Compresses and resizes an image for PDF embedding
 * Uses Canvas API to reduce file size significantly
 */
export async function compressImageForPDF(
  imageUrl: string,
  maxWidth: number = 150,
  maxHeight: number = 150,
  quality: number = 0.6
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      // Create canvas for resizing
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      
      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Export as JPEG with reduced quality
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };
    
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
