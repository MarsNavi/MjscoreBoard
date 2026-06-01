import { Game, Player } from './types';

export interface LocalGameSnapshot {
  game: Game;
  players: Player[];
  isConfirmMode: boolean;
  currentPenalties?: Record<string, number>;
}

const STORAGE_PREFIX = 'mahjong_game_snapshot_';

export function loadLocalGameSnapshot(userId: string): LocalGameSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as LocalGameSnapshot;
  } catch {
    return null;
  }
}

export function saveLocalGameSnapshot(userId: string, snapshot: LocalGameSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Failed to save local game snapshot', error);
  }
}

export function clearLocalGameSnapshot(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + userId);
  } catch (error) {
    console.error('Failed to clear local game snapshot', error);
  }
}
