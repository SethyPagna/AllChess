export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ThemeMode = "light" | "dark" | "system";
export type GameStatus = "waiting" | "active" | "completed" | "abandoned";
export type GameResult = "white_win" | "black_win" | "draw" | "unfinished";

export type UserProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  locale: string;
  theme: ThemeMode;
  rating: number;
  created_at: string;
  updated_at: string;
};

export type GameRecord = {
  id: string;
  variant_key: string;
  status: GameStatus;
  result: GameResult;
  board_state: Json;
  time_control: Json;
  current_turn: string;
  private_code: string | null;
  created_by: string | null;
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type AnalysisReport = {
  id: string;
  game_id: string;
  requested_by: string | null;
  provider: string;
  model: string;
  summary: string;
  report: Json;
  created_at: string;
};
