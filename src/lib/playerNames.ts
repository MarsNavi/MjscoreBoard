export const normalizePlayerName = (name: string | null | undefined, fallback = ''): string => {
  const normalized = (name ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
};
