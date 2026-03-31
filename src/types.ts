export interface Participant {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  participantIds: string[];
  manualQualifierIds?: string[]; // IDs of participants manually selected to advance
}

export interface Match {
  id: string;
  groupId: string;
  p1Id: string;
  p2Id: string;
  p3Id: string;
  p4Id: string;
  score1: number;
  score2: number;
  isCompleted: boolean;
}

export interface KnockoutPair {
  id: string;
  p1Id: string;
  p2Id: string;
  name: string;
}

export interface KnockoutMatch {
  id: string;
  round: 'oitavas' | 'quartas' | 'semi' | 'final';
  pair1Id: string | null; // null if not yet determined
  pair2Id: string | null;
  score1: number;
  score2: number;
  winnerPairId: string | null;
  isCompleted: boolean;
}

export interface Standing {
  participantId: string;
  name: string;
  wins: number;
  gamesWon: number;
  gamesLost: number;
  netGames: number;
}
