/** Signed image paths come from the API; credentials never go in image URLs. */
export function profilePhotoUrl(path?: string | null) {
  const origin = (
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '');
  return path ? `${origin}${path}` : undefined;
}
