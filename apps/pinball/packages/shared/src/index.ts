/**
 * Browser-safe contracts shared by the data registration package and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */
export interface HighScoreRecord {
  id: string;
  playerName: string;
  score: number;
  ballsPlayed: number;
  durationSeconds: number;
  targetBanksCleared: number;
  createdAt: Date;
  owner_id: string;
}

export type UniversalAppSchema = {
  HighScore: HighScoreRecord;
};
