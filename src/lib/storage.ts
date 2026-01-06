import { supabase } from "@/integrations/supabase/client";

/**
 * Get a signed URL for a private storage file
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param expiresIn - Expiration time in seconds (default 1 hour)
 * @returns The signed URL or null if error
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Extract the storage path from a full public URL
 * Used to convert old public URLs to signed URLs
 */
export function extractStoragePath(fullUrl: string, bucket: string): string | null {
  try {
    const url = new URL(fullUrl);
    const pathMatch = url.pathname.match(new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/(.+)`));
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
}
