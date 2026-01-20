export type Position = 'east' | 'south' | 'west' | 'north';
export type PlayerId = 'A' | 'B' | 'C' | 'D';

export interface Player {
  id: string;
  game_id: string;
  position: Position;
  player_id: PlayerId;
  name: string;
  score: number;
  created_at: string;
  confirmed_result?: boolean;
  confirmed_at?: string;
}

export interface Game {
  id: string;
  created_at: string;
  current_round: number;
  current_game: number;
  status: 'active' | 'finished';
  game_name?: string;
  is_completed?: boolean;
  early_ended?: boolean;
  completed_at?: string;
  creator_id?: string;
}

export interface User {
  id: string;
  code: string;
  created_at: string;
  last_login_at: string;
}

export interface ScoreRecord {
  id: string;
  game_id: string;
  round: number;
  game_number: number;
  winner_position: Position | null;
  loser_position: Position | null;
  winner_player_id?: PlayerId;
  loser_player_id?: PlayerId | null;
  base_score: number;
  score_changes: Record<Position, number>;
  created_at: string;
}

export interface Penalty {
  id: string;
  game_id: string;
  penalty_changes: Record<string, number>;
  created_at?: string;
}

export interface GameResult {
  id: string;
  game_id: string;
  player_id: string;
  player_name: string;
  final_score: number;
  rank: number;
  standard_score: number;
  created_at?: string;
}

export type DeviceId = 'deviceA' | 'deviceB' | 'deviceC' | 'deviceD';

export interface PlayerDeviceBinding {
  device_id: DeviceId;
  position: Position;
}

export interface DeviceDisplayState {
  game_id: string;
  position: Position;
  round: number;
  game_number: number;
  self_score: number;
  all_scores: Record<Position, number>;
}

export type DeviceActionKind =
  | 'hu'
  | 'rong'
  | 'chi'
  | 'peng'
  | 'ready'
  | 'undo_request';

export interface DeviceActionPayload {
  position: Position;
  kind: DeviceActionKind;
  data?: Record<string, unknown>;
}

export type DeviceMessageType = 'score_sync' | 'action' | 'heartbeat';

export interface DeviceScoreSyncMessage {
  type: 'score_sync';
  payload: DeviceDisplayState;
}

export interface DeviceActionMessage {
  type: 'action';
  payload: DeviceActionPayload;
}

export interface DeviceHeartbeatMessage {
  type: 'heartbeat';
  payload: {
    device_id: DeviceId;
    position: Position;
    connected: boolean;
    battery_level?: number;
  };
}

export type DeviceMessage =
  | DeviceScoreSyncMessage
  | DeviceActionMessage
  | DeviceHeartbeatMessage;
