export interface Round {
  id: string;
  date: string;
  time: string;
  course_name: string;
  course_front: string;
  course_back: string;
  companion1: string;
  companion2: string;
  companion3: string;
  memo: string;
  user_id?: string;
  is_public?: boolean;
}

export interface Hole {
  id?: string;
  round_id: string;
  hole_number: number;
  par: number;
  green_shots: number;
  putts: number;
  total_strokes: number;
  over_par: number;
  is_manual: boolean;

  tee_club: string;
  tee_result: string;
  tee_penalty_type: string;
  tee_miss: string;
  tee_memo: string;

  tee2_club: string;
  tee2_result: string;
  tee2_penalty_type: string;
  tee2_miss: string;
  tee2_memo: string;

  second1_club: string;
  second1_result: string;
  second1_penalty_type: string;
  second1_miss: string;
  second1_miss_detail: string;
  second1_memo: string;

  second2_club: string;
  second2_result: string;
  second2_penalty_type: string;
  second2_miss: string;
  second2_miss_detail: string;
  second2_memo: string;

  second3_club: string;
  second3_result: string;
  second3_penalty_type: string;
  second3_miss: string;
  second3_miss_detail: string;
  second3_memo: string;

  approach1_club: string;
  approach1_result: string;
  approach1_miss: string;
  approach1_miss_detail: string;
  approach1_memo: string;

  approach2_club: string;
  approach2_result: string;
  approach2_miss: string;
  approach2_miss_detail: string;
  approach2_memo: string;

  putt_miss: string;
  putt_memo: string;
  putt2_miss: string;
  putt2_memo: string;
}

export type Screen = 'new-round' | 'hole-recording' | 'round-summary' | 'miss-breakdown' | 'all-rounds' | 'round-list' | 'hole-select' | 'hole-detail' | 'profile' | 'settings';
export interface AppState {
  screen: Screen;
  currentRound: Round | null;
  holes: Hole[];
  currentHoleIndex: number;
}

export const emptyHole = (roundId: string, holeNumber: number): Hole => ({
  round_id: roundId,
  hole_number: holeNumber,
  par: 4,
  green_shots: 0,
  putts: 0,
  total_strokes: 0,
  over_par: 0,
  is_manual: false,
  tee_club: '',
  tee_result: '',
  tee_penalty_type: '',
  tee_miss: '',
  tee_memo: '',
  tee2_club: '',
  tee2_result: '',
  tee2_penalty_type: '',
  tee2_miss: '',
  tee2_memo: '',
  second1_club: '',
  second1_result: '',
  second1_penalty_type: '',
  second1_miss: '',
  second1_miss_detail: '',
  second1_memo: '',
  second2_club: '',
  second2_result: '',
  second2_penalty_type: '',
  second2_miss: '',
  second2_miss_detail: '',
  second2_memo: '',
  second3_club: '',
  second3_result: '',
  second3_penalty_type: '',
  second3_miss: '',
  second3_miss_detail: '',
  second3_memo: '',
  approach1_club: '',
  approach1_result: '',
  approach1_miss: '',
  approach1_miss_detail: '',
  approach1_memo: '',
  approach2_club: '',
  approach2_result: '',
  approach2_miss: '',
  approach2_miss_detail: '',
  approach2_memo: '',
  putt_miss: '',
  putt_memo: '',
  putt2_miss: '',
  putt2_memo: '',
});

export function getScoreLabel(overPar: number): string {
  if (overPar <= -3) return '알바트로스';
  if (overPar === -2) return '이글';
  if (overPar === -1) return '버디';
  if (overPar === 0) return '파';
  if (overPar === 1) return '보기';
  if (overPar === 2) return '더블 보기';
  if (overPar === 3) return '트리플';
  if (overPar === 4) return '쿼드러플';
  return `+${overPar}`;
}

export function getScorePrefix(overPar: number): string {
  if (overPar > 0) return `+${overPar}`;
  if (overPar < 0) return `${overPar}`;
  return 'E';
}
