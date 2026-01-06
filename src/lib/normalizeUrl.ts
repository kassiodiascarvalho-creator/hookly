/**
 * Normalizes a URL to ensure it opens correctly in a new tab
 * @param url - The URL to normalize
 * @returns A properly formatted URL with protocol
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  
  // Trim whitespace
  const trimmed = url.trim();
  
  // Block dangerous protocols
  const lowerUrl = trimmed.toLowerCase();
  if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('vbscript:')) {
    return '';
  }
  
  // If already has http:// or https://, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // If starts with //, add https:
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  
  // Otherwise, add https://
  return `https://${trimmed}`;
}
