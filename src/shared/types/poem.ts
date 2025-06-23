export type PoemPhase = 'keyline' | 'keyword' | 'mood' | 'generation' | 'published';

export type VotingOption = {
  id: string;
  text: string;
  votes: number;
};

export type MoodVariable = {
  name: string;
  value: number; // 1-10
  votes: number;
};

export type SkinnyPoem = {
  keyLine: string;
  keyWord: string;
  line3: string; // verb/preposition/noun/adjective/adverb
  line4: string; // verb/preposition/noun/adjective/adverb
  line5: string; // verb/preposition/noun/adjective/adverb
  line7: string; // preposition/adjective/verb
  line8: string; // preposition/adjective/verb
  line10: string; // adjective/noun
  mood: Record<string, number>;
  imageUrl?: string;
  createdAt: string;
};

export type PoemState = {
  phase: PoemPhase;
  currentDay: string; // YYYY-MM-DD
  keyLineOptions: VotingOption[];
  keyWordOptions: VotingOption[];
  selectedKeyLine?: string;
  selectedKeyWord?: string;
  moodVariables: Record<string, MoodVariable>;
  generatedPoem?: SkinnyPoem;
  phaseEndTime: number; // timestamp
};

export type VoteRequest = {
  type: 'keyline' | 'keyword' | 'mood';
  optionId?: string;
  moodValues?: Record<string, number>;
};

export type VoteResponse = {
  status: 'success' | 'error';
  message?: string;
  currentState?: PoemState;
};

export type GeneratePoemResponse = {
  status: 'success' | 'error';
  poem?: SkinnyPoem;
  message?: string;
};

export type AdminActionResponse = {
  status: 'success' | 'error';
  message?: string;
  newState?: PoemState;
};