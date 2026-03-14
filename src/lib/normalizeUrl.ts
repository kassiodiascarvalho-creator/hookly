export function normalizeUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  const lowerUrl = trimmed.toLowerCase();
  if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('vbscript:')) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}