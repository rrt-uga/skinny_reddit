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

// Webview message types
export type WebviewMessage = 
  | { type: 'GET_POEM_STATE'; messageId?: string }
  | { type: 'VOTE'; data: VoteRequest; messageId?: string }
  | { type: 'GENERATE_POEM'; messageId?: string }
  | { type: 'ADMIN_SIMULATE'; messageId?: string }
  | { type: 'GET_DAILY_POEM'; date?: string; messageId?: string };

export type WebviewResponse = 
  | { type: 'POEM_STATE_RESPONSE'; data: PoemState; messageId?: string }
  | { type: 'VOTE_RESPONSE'; success: boolean; message?: string; data?: PoemState; messageId?: string }
  | { type: 'GENERATE_RESPONSE'; success: boolean; message?: string; poem?: SkinnyPoem; messageId?: string }
  | { type: 'SIMULATE_RESPONSE'; success: boolean; message?: string; data?: PoemState; messageId?: string }
  | { type: 'DAILY_POEM_RESPONSE'; success: boolean; poem?: SkinnyPoem; message?: string; messageId?: string }
  | { type: 'ERROR'; message: string; messageId?: string };