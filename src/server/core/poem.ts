import { RedisClient } from '@devvit/redis';
import { PoemState, PoemPhase, VotingOption, SkinnyPoem, MoodVariable } from '../../shared/types/poem';

const POEM_STATE_KEY = 'poem_state';
const DAILY_POEM_KEY = (date: string) => `daily_poem:${date}`;

// Mood variables for the poem
const MOOD_VARIABLES = [
  'melancholy', 'joy', 'mystery', 'passion', 'serenity', 
  'rebellion', 'nostalgia', 'hope', 'darkness', 'whimsy'
];

// Sample key lines for voting
const SAMPLE_KEY_LINES = [
  "In the silence between heartbeats,",
  "Where shadows dance with light—",
  "Through the whispers of time:",
  "Beyond the edge of dreams;",
  "In the space where words fail,",
  "When the world holds its breath—",
  "At the crossroads of memory:",
  "Where the heart speaks in colors;",
  "In the echo of forgotten songs,",
  "Through the lens of solitude—"
];

// Word banks for poem generation
const WORD_BANKS = {
  verbs: ['whisper', 'dance', 'shatter', 'bloom', 'weave', 'drift', 'pierce', 'embrace', 'dissolve', 'ignite'],
  prepositions: ['through', 'beneath', 'beyond', 'within', 'across', 'above', 'beside', 'among', 'behind', 'toward'],
  nouns: ['shadow', 'light', 'memory', 'dream', 'silence', 'echo', 'breath', 'soul', 'heart', 'spirit'],
  adjectives: ['fragile', 'eternal', 'hidden', 'gentle', 'fierce', 'quiet', 'wild', 'tender', 'ancient', 'luminous'],
  adverbs: ['softly', 'deeply', 'slowly', 'quietly', 'gently', 'fiercely', 'tenderly', 'wildly', 'gracefully', 'boldly']
};

export const getCurrentDay = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const getCurrentPhase = (): PoemPhase => {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 8 && hour < 12) return 'keyline';
  if (hour >= 12 && hour < 16) return 'keyword';
  if (hour >= 16 && hour < 20) return 'mood';
  if (hour >= 20 && hour < 21) return 'generation';
  return 'published';
};

export const getPhaseEndTime = (phase: PoemPhase): number => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (phase) {
    case 'keyline': return today.getTime() + 12 * 60 * 60 * 1000; // 12 PM
    case 'keyword': return today.getTime() + 16 * 60 * 60 * 1000; // 4 PM
    case 'mood': return today.getTime() + 20 * 60 * 60 * 1000; // 8 PM
    case 'generation': return today.getTime() + 21 * 60 * 60 * 1000; // 9 PM
    default: return today.getTime() + 24 * 60 * 60 * 1000; // Next day
  }
};

export const generateKeyLineOptions = (): VotingOption[] => {
  const shuffled = [...SAMPLE_KEY_LINES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map((text, index) => ({
    id: `keyline_${index}`,
    text,
    votes: 0
  }));
};

export const generateKeyWordOptions = (keyLine: string): VotingOption[] => {
  // Extract meaningful words from the key line for keyword options
  const words = keyLine.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(word => word.length > 3 && !['the', 'and', 'with', 'where', 'when', 'through'].includes(word));
  
  // Add some random words from our word banks
  const additionalWords = [
    ...WORD_BANKS.nouns.slice(0, 2),
    ...WORD_BANKS.adjectives.slice(0, 2),
    ...WORD_BANKS.verbs.slice(0, 1)
  ];
  
  const allWords = [...words, ...additionalWords].slice(0, 5);
  
  return allWords.map((text, index) => ({
    id: `keyword_${index}`,
    text,
    votes: 0
  }));
};

export const initializeMoodVariables = (): Record<string, MoodVariable> => {
  const variables: Record<string, MoodVariable> = {};
  MOOD_VARIABLES.forEach(name => {
    variables[name] = {
      name,
      value: 5, // Default middle value
      votes: 0
    };
  });
  return variables;
};

export const generatePoem = (keyLine: string, keyWord: string, mood: Record<string, number>): SkinnyPoem => {
  // Select words based on mood intensity
  const moodIntensity = Object.values(mood).reduce((sum, val) => sum + val, 0) / Object.keys(mood).length;
  
  // Generate the 6 variable lines ensuring no repetition
  const usedWords = new Set<string>();
  
  // Lines 3-5: verb, preposition, noun/adjective/adverb (one each)
  const line3Types = ['verb', 'preposition', 'noun'] as const;
  const line3Words = line3Types.map(type => {
    const bank = type === 'verb' ? WORD_BANKS.verbs : 
                 type === 'preposition' ? WORD_BANKS.prepositions : 
                 WORD_BANKS.nouns;
    
    let word;
    do {
      word = bank[Math.floor(Math.random() * bank.length)];
    } while (usedWords.has(word));
    
    usedWords.add(word);
    return word;
  });
  
  // Lines 7-8: preposition, adjective/verb
  const line7 = (() => {
    let word;
    do {
      word = WORD_BANKS.prepositions[Math.floor(Math.random() * WORD_BANKS.prepositions.length)];
    } while (usedWords.has(word));
    usedWords.add(word);
    return word;
  })();
  
  const line8 = (() => {
    let word;
    do {
      word = WORD_BANKS.adjectives[Math.floor(Math.random() * WORD_BANKS.adjectives.length)];
    } while (usedWords.has(word));
    usedWords.add(word);
    return word;
  })();
  
  // Line 10: adjective/noun
  const line10 = (() => {
    let word;
    do {
      word = WORD_BANKS.adjectives[Math.floor(Math.random() * WORD_BANKS.adjectives.length)];
    } while (usedWords.has(word));
    return word;
  })();
  
  // Add punctuation based on rules
  const punctuations = [',', '—', '-', ':', ';'];
  const randomPunct = () => punctuations[Math.floor(Math.random() * punctuations.length)];
  
  return {
    keyLine: keyLine.replace(/[.,:;—-]$/, '') + randomPunct(), // Rule 8
    keyWord: keyWord + randomPunct(), // Rule 10
    line3: line3Words[0],
    line4: line3Words[1] + randomPunct(), // Rule 10
    line5: line3Words[2] + randomPunct(), // Rule 10
    line7: line7,
    line8: line8 + randomPunct(), // Rule 10
    line10: line10,
    mood,
    createdAt: new Date().toISOString()
  };
};

export const getPoemState = async (redis: RedisClient): Promise<PoemState> => {
  try {
    const stored = await redis.get(POEM_STATE_KEY);
    const currentDay = getCurrentDay();
    const currentPhase = getCurrentPhase();
    
    if (stored) {
      const state: PoemState = JSON.parse(stored);
      
      // Check if we need to reset for a new day
      if (state.currentDay !== currentDay) {
        return initializeDailyState(currentDay, currentPhase);
      }
      
      // Update phase if time has passed
      if (state.phase !== currentPhase) {
        state.phase = currentPhase;
        state.phaseEndTime = getPhaseEndTime(currentPhase);
        
        // Auto-generate options for new phases
        if (currentPhase === 'keyword' && state.selectedKeyLine && state.keyWordOptions.length === 0) {
          state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
        }
      }
      
      return state;
    }
    
    return initializeDailyState(currentDay, currentPhase);
  } catch (error) {
    console.error('Error getting poem state from Redis:', error);
    // Return a default state if Redis fails
    return initializeDailyState(getCurrentDay(), getCurrentPhase());
  }
};

const initializeDailyState = (currentDay: string, currentPhase: PoemPhase): PoemState => {
  return {
    phase: currentPhase,
    currentDay,
    keyLineOptions: currentPhase === 'keyline' ? generateKeyLineOptions() : [],
    keyWordOptions: [],
    moodVariables: initializeMoodVariables(),
    phaseEndTime: getPhaseEndTime(currentPhase)
  };
};

export const savePoemState = async (redis: RedisClient, state: PoemState): Promise<void> => {
  try {
    await redis.set(POEM_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving poem state to Redis:', error);
    throw error;
  }
};

export const saveDailyPoem = async (redis: RedisClient, date: string, poem: SkinnyPoem): Promise<void> => {
  try {
    await redis.set(DAILY_POEM_KEY(date), JSON.stringify(poem));
  } catch (error) {
    console.error('Error saving daily poem to Redis:', error);
    throw error;
  }
};

export const getDailyPoem = async (redis: RedisClient, date: string): Promise<SkinnyPoem | null> => {
  try {
    const stored = await redis.get(DAILY_POEM_KEY(date));
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error getting daily poem from Redis:', error);
    return null;
  }
};