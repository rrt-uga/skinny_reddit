import { Devvit, useState, useAsync, useInterval } from '@devvit/public-api';

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Types
type PoemPhase = 'keyline' | 'keyword' | 'mood' | 'generation' | 'published';

type VotingOption = {
  id: string;
  text: string;
  votes: number;
};

type MoodVariable = {
  name: string;
  value: number;
  votes: number;
};

type SkinnyPoem = {
  keyLine: string;
  keyWord: string;
  line3: string;
  line4: string;
  line5: string;
  line7: string;
  line8: string;
  line10: string;
  mood: Record<string, number>;
  createdAt: string;
};

type PoemState = {
  phase: PoemPhase;
  currentDay: string;
  keyLineOptions: VotingOption[];
  keyWordOptions: VotingOption[];
  selectedKeyLine?: string;
  selectedKeyWord?: string;
  moodVariables: Record<string, MoodVariable>;
  generatedPoem?: SkinnyPoem;
  phaseEndTime: number;
};

// Constants
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

const WORD_BANKS = {
  verbs: ['whisper', 'dance', 'shatter', 'bloom', 'weave', 'drift', 'pierce', 'embrace', 'dissolve', 'ignite'],
  prepositions: ['through', 'beneath', 'beyond', 'within', 'across', 'above', 'beside', 'among', 'behind', 'toward'],
  nouns: ['shadow', 'light', 'memory', 'dream', 'silence', 'echo', 'breath', 'soul', 'heart', 'spirit'],
  adjectives: ['fragile', 'eternal', 'hidden', 'gentle', 'fierce', 'quiet', 'wild', 'tender', 'ancient', 'luminous'],
  adverbs: ['softly', 'deeply', 'slowly', 'quietly', 'gently', 'fiercely', 'tenderly', 'wildly', 'gracefully', 'boldly']
};

const MOOD_VARIABLES = [
  'melancholy', 'joy', 'mystery', 'passion', 'serenity', 
  'rebellion', 'nostalgia', 'hope', 'darkness', 'whimsy'
];

// Utility functions
const getCurrentDay = (): string => {
  const day = new Date().toISOString().split('T')[0];
  console.log('Client: Current day:', day);
  return day;
};

const getCurrentPhase = (): PoemPhase => {
  const now = new Date();
  const hour = now.getHours();
  console.log('Client: Current hour:', hour);
  
  let phase: PoemPhase;
  if (hour >= 8 && hour < 12) phase = 'keyline';
  else if (hour >= 12 && hour < 16) phase = 'keyword';
  else if (hour >= 16 && hour < 20) phase = 'mood';
  else if (hour >= 20 && hour < 21) phase = 'generation';
  else phase = 'published';
  
  console.log('Client: Current phase:', phase);
  return phase;
};

const getPhaseEndTime = (phase: PoemPhase): number => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let endTime;
  switch (phase) {
    case 'keyline': endTime = today.getTime() + 12 * 60 * 60 * 1000; break;
    case 'keyword': endTime = today.getTime() + 16 * 60 * 60 * 1000; break;
    case 'mood': endTime = today.getTime() + 20 * 60 * 60 * 1000; break;
    case 'generation': endTime = today.getTime() + 21 * 60 * 60 * 1000; break;
    default: endTime = today.getTime() + 24 * 60 * 60 * 1000;
  }
  
  console.log('Client: Phase end time for', phase, ':', new Date(endTime).toISOString());
  return endTime;
};

const generateKeyLineOptions = () => {
  console.log('Client: Generating key line options');
  const shuffled = [...SAMPLE_KEY_LINES].sort(() => Math.random() - 0.5);
  const options = shuffled.slice(0, 5).map((text, index) => ({
    id: `keyline_${index}`,
    text,
    votes: 0
  }));
  console.log('Client: Generated key line options:', options);
  return options;
};

const generateKeyWordOptions = (keyLine: string) => {
  console.log('Client: Generating key word options from:', keyLine);
  
  const words = keyLine.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(word => word.length > 3 && !['the', 'and', 'with', 'where', 'when', 'through'].includes(word));
  
  const additionalWords = [
    ...WORD_BANKS.nouns.slice(0, 2),
    ...WORD_BANKS.adjectives.slice(0, 2),
    ...WORD_BANKS.verbs.slice(0, 1)
  ];
  
  const allWords = [...words, ...additionalWords].slice(0, 5);
  const options = allWords.map((text, index) => ({
    id: `keyword_${index}`,
    text,
    votes: 0
  }));
  
  console.log('Client: Generated key word options:', options);
  return options;
};

const initializeMoodVariables = () => {
  console.log('Client: Initializing mood variables');
  const variables: Record<string, MoodVariable> = {};
  MOOD_VARIABLES.forEach(name => {
    variables[name] = {
      name,
      value: 5,
      votes: 0
    };
  });
  console.log('Client: Initialized mood variables:', variables);
  return variables;
};

const generatePoem = (keyLine: string, keyWord: string, mood: Record<string, number>): SkinnyPoem => {
  console.log('Client: Generating poem with keyLine:', keyLine, 'keyWord:', keyWord, 'mood:', JSON.stringify(mood, null, 2));
  
  const usedWords = new Set<string>();
  
  const getRandomWord = (bank: string[]) => {
    let word;
    do {
      word = bank[Math.floor(Math.random() * bank.length)];
    } while (usedWords.has(word));
    usedWords.add(word);
    console.log('Client: Selected random word:', word);
    return word;
  };
  
  const punctuations = [',', '—', '-', ':', ';'];
  const randomPunct = () => punctuations[Math.floor(Math.random() * punctuations.length)];
  
  const poem = {
    keyLine: keyLine.replace(/[.,:;—-]$/, '') + randomPunct(),
    keyWord: keyWord + randomPunct(),
    line3: getRandomWord(WORD_BANKS.verbs),
    line4: getRandomWord(WORD_BANKS.prepositions) + randomPunct(),
    line5: getRandomWord(WORD_BANKS.nouns) + randomPunct(),
    line7: getRandomWord(WORD_BANKS.prepositions),
    line8: getRandomWord(WORD_BANKS.adjectives) + randomPunct(),
    line10: getRandomWord(WORD_BANKS.adjectives),
    mood,
    createdAt: new Date().toISOString()
  };
  
  console.log('Client: Generated poem:', JSON.stringify(poem, null, 2));
  return poem;
};

// Redis helper functions
const getPoemState = async (redis: any): Promise<PoemState> => {
  console.log('Client: Getting poem state from Redis');
  
  const stored = await redis.get('poem_state');
  console.log('Client: Raw stored state:', stored);
  
  const currentDay = getCurrentDay();
  const currentPhase = getCurrentPhase();
  
  if (stored) {
    const state = JSON.parse(stored);
    console.log('Client: Parsed stored state:', JSON.stringify(state, null, 2));
    
    if (state.currentDay !== currentDay) {
      console.log('Client: Day changed, initializing new daily state');
      return initializeDailyState(currentDay, currentPhase);
    }
    
    if (state.phase !== currentPhase) {
      console.log('Client: Phase changed from', state.phase, 'to', currentPhase);
      state.phase = currentPhase;
      state.phaseEndTime = getPhaseEndTime(currentPhase);
      
      if (currentPhase === 'keyword' && state.selectedKeyLine && state.keyWordOptions.length === 0) {
        console.log('Client: Generating keyword options for selected key line:', state.selectedKeyLine);
        state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
      }
    }
    
    console.log('Client: Final state to return:', JSON.stringify(state, null, 2));
    return state;
  }
  
  console.log('Client: No stored state found, initializing new state');
  return initializeDailyState(currentDay, currentPhase);
};

const initializeDailyState = (currentDay: string, currentPhase: PoemPhase): PoemState => {
  console.log('Client: Initializing daily state for day:', currentDay, 'phase:', currentPhase);
  
  const state = {
    phase: currentPhase,
    currentDay,
    keyLineOptions: currentPhase === 'keyline' ? generateKeyLineOptions() : [],
    keyWordOptions: [],
    moodVariables: initializeMoodVariables(),
    phaseEndTime: getPhaseEndTime(currentPhase)
  };
  
  console.log('Client: Initialized daily state:', JSON.stringify(state, null, 2));
  return state;
};

const savePoemState = async (redis: any, state: PoemState) => {
  console.log('Client: Saving poem state to Redis:', JSON.stringify(state, null, 2));
  await redis.set('poem_state', JSON.stringify(state));
  console.log('Client: Successfully saved poem state to Redis');
};

// Main App Component
const App: Devvit.CustomPostComponent = (context) => {
  const { redis, userId, ui } = context;
  const [poemState, setPoemState] = useState<PoemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [localMoodValues, setLocalMoodValues] = useState<Record<string, number>>({});

  console.log('Client: App component rendered with userId:', userId);

  // Load poem state
  const { data: stateData } = useAsync(async () => {
    console.log('Client: Loading poem state asynchronously');
    const state = await getPoemState(redis);
    console.log('Client: Poem state loaded:', JSON.stringify(state, null, 2));
    
    setPoemState(state);
    setLoading(false);
    
    // Initialize local mood values when state loads
    if (state.phase === 'mood') {
      console.log('Client: Initializing local mood values for mood phase');
      const initialMoodValues: Record<string, number> = {};
      MOOD_VARIABLES.forEach(name => {
        initialMoodValues[name] = Math.round(state.moodVariables[name]?.value || 5);
      });
      console.log('Client: Initial mood values:', JSON.stringify(initialMoodValues, null, 2));
      setLocalMoodValues(initialMoodValues);
    }
    
    return state;
  });

  // Load user votes
  useAsync(async () => {
    if (!userId) {
      console.log('Client: No userId, skipping vote loading');
      return;
    }
    
    console.log('Client: Loading user votes for userId:', userId);
    const currentDay = getCurrentDay();
    const votes: Record<string, string> = {};
    
    for (const voteType of ['keyline', 'keyword', 'mood']) {
      const voteKey = `vote:${currentDay}:${userId}:${voteType}`;
      console.log('Client: Checking vote key:', voteKey);
      const vote = await redis.get(voteKey);
      if (vote) {
        console.log(`Client: Found existing ${voteType} vote:`, vote);
        votes[voteType] = vote;
      }
    }
    
    console.log('Client: All user votes loaded:', JSON.stringify(votes, null, 2));
    setUserVotes(votes);
  });

  // Auto-refresh every 30 seconds
  useInterval(async () => {
    console.log('Client: Auto-refreshing poem state');
    const state = await getPoemState(redis);
    console.log('Client: Auto-refresh - new state:', JSON.stringify(state, null, 2));
    setPoemState(state);
    
    // Update local mood values if we're in mood phase and haven't voted yet
    if (state.phase === 'mood' && !userVotes.mood) {
      console.log('Client: Auto-refresh - updating local mood values');
      const initialMoodValues: Record<string, number> = {};
      MOOD_VARIABLES.forEach(name => {
        initialMoodValues[name] = Math.round(state.moodVariables[name]?.value || 5);
      });
      setLocalMoodValues(initialMoodValues);
    }
  }, 30000);

  const handleVote = async (voteType: string, optionId?: string, moodValues?: Record<string, number>) => {
    console.log('Client: Submitting vote:', voteType, 'optionId:', optionId, 'moodValues:', JSON.stringify(moodValues, null, 2));
    
    if (!userId || !poemState) {
      console.log('Client: Vote rejected - no userId or poemState');
      ui.showToast('Please log in to vote');
      return;
    }

    const currentDay = getCurrentDay();
    const voteKey = `vote:${currentDay}:${userId}:${voteType}`;
    console.log('Client: Checking if user has already voted with key:', voteKey);
    
    const hasVoted = await redis.get(voteKey);
    console.log('Client: User has already voted:', !!hasVoted);
    
    if (hasVoted) {
      ui.showToast('You have already voted for this phase today');
      return;
    }

    const newState = { ...poemState };
    console.log('Client: Processing vote for new state');

    if (voteType === 'keyline' && optionId) {
      console.log('Client: Processing keyline vote for option:', optionId);
      const option = newState.keyLineOptions.find(opt => opt.id === optionId);
      if (option) {
        console.log('Client: Found option, incrementing votes from', option.votes, 'to', option.votes + 1);
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 });
        ui.showToast('Key line vote submitted!');
      }
    } else if (voteType === 'keyword' && optionId) {
      console.log('Client: Processing keyword vote for option:', optionId);
      const option = newState.keyWordOptions.find(opt => opt.id === optionId);
      if (option) {
        console.log('Client: Found option, incrementing votes from', option.votes, 'to', option.votes + 1);
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 });
        ui.showToast('Key word vote submitted!');
      }
    } else if (voteType === 'mood' && moodValues) {
      console.log('Client: Processing mood vote with values:', JSON.stringify(moodValues, null, 2));
      Object.entries(moodValues).forEach(([moodName, value]) => {
        if (newState.moodVariables[moodName] && value >= 1 && value <= 10) {
          const currentTotal = newState.moodVariables[moodName].value * newState.moodVariables[moodName].votes;
          const oldValue = newState.moodVariables[moodName].value;
          const oldVotes = newState.moodVariables[moodName].votes;
          
          newState.moodVariables[moodName].votes++;
          newState.moodVariables[moodName].value = (currentTotal + value) / newState.moodVariables[moodName].votes;
          
          console.log(`Client: Updated mood ${moodName}: ${oldValue} (${oldVotes} votes) -> ${newState.moodVariables[moodName].value} (${newState.moodVariables[moodName].votes} votes)`);
        }
      });
      await redis.set(voteKey, JSON.stringify(moodValues), { ex: 86400 });
      ui.showToast('Mood settings submitted!');
    }

    await savePoemState(redis, newState);
    console.log('Client: Vote processed, updating state');
    setPoemState(newState);
    
    // Update user votes
    const newUserVotes = { ...userVotes, [voteType]: optionId || 'voted' };
    console.log('Client: Updated user votes:', JSON.stringify(newUserVotes, null, 2));
    setUserVotes(newUserVotes);
  };

  const handleGenerate = async () => {
    console.log('Client: Starting poem generation');
    if (!poemState) {
      console.log('Client: No poem state available for generation');
      return;
    }

    let selectedKeyLine = poemState.selectedKeyLine;
    if (!selectedKeyLine) {
      console.log('Client: No selected key line, finding winner from options:', poemState.keyLineOptions);
      const winningKeyLine = poemState.keyLineOptions.reduce((prev, current) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyLine = winningKeyLine?.text || poemState.keyLineOptions[0]?.text;
      console.log('Client: Selected key line:', selectedKeyLine);
    }

    let selectedKeyWord = poemState.selectedKeyWord;
    if (!selectedKeyWord) {
      console.log('Client: No selected key word, finding winner from options:', poemState.keyWordOptions);
      const winningKeyWord = poemState.keyWordOptions.reduce((prev, current) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyWord = winningKeyWord?.text || poemState.keyWordOptions[0]?.text;
      console.log('Client: Selected key word:', selectedKeyWord);
    }

    if (!selectedKeyLine || !selectedKeyWord) {
      console.log('Client: Missing required elements - keyLine:', selectedKeyLine, 'keyWord:', selectedKeyWord);
      ui.showToast('Missing key line or key word');
      return;
    }

    const moodValues: Record<string, number> = {};
    Object.entries(poemState.moodVariables).forEach(([name, variable]) => {
      moodValues[name] = variable.votes > 0 ? variable.value : Math.floor(Math.random() * 10) + 1;
    });
    console.log('Client: Final mood values for poem:', JSON.stringify(moodValues, null, 2));

    const poem = generatePoem(selectedKeyLine, selectedKeyWord, moodValues);

    const newState = { ...poemState };
    newState.generatedPoem = poem;
    newState.phase = 'published';
    newState.selectedKeyLine = selectedKeyLine;
    newState.selectedKeyWord = selectedKeyWord;

    console.log('Client: Saving generated poem to Redis');
    await redis.set(`daily_poem:${getCurrentDay()}`, JSON.stringify(poem));
    await savePoemState(redis, newState);
    
    console.log('Client: Poem generation completed, updating state');
    setPoemState(newState);
    
    ui.showToast('Poem generated successfully!');
  };

  const updateMoodValue = (moodName: string, delta: number) => {
    const oldValue = localMoodValues[moodName] || 5;
    const newValue = Math.max(1, Math.min(10, oldValue + delta));
    console.log(`Client: Updating mood ${moodName} from ${oldValue} to ${newValue} (delta: ${delta})`);
    
    setLocalMoodValues(prev => ({
      ...prev,
      [moodName]: newValue
    }));
  };

  const getMoodDescription = (moodName: string, value: number) => {
    const descriptions: Record<string, string[]> = {
      melancholy: ['serene', 'wistful', 'deeply sad'],
      joy: ['content', 'happy', 'euphoric'],
      mystery: ['subtle', 'intriguing', 'enigmatic'],
      passion: ['warm', 'intense', 'burning'],
      serenity: ['calm', 'peaceful', 'transcendent'],
      rebellion: ['questioning', 'defiant', 'revolutionary'],
      nostalgia: ['reminiscent', 'longing', 'bittersweet'],
      hope: ['optimistic', 'bright', 'radiant'],
      darkness: ['shadowy', 'brooding', 'profound'],
      whimsy: ['playful', 'quirky', 'fantastical']
    };

    const levels = descriptions[moodName] || ['mild', 'moderate', 'intense'];
    if (value <= 3) return levels[0];
    if (value <= 7) return levels[1];
    return levels[2];
  };

  if (loading) {
    console.log('Client: Rendering loading state');
    return (
      <vstack height="100%" width="100%" alignment="center middle" backgroundColor="#1a1a2e">
        <text size="large" color="white">Loading poem generator...</text>
      </vstack>
    );
  }

  if (!poemState) {
    console.log('Client: Rendering error state - no poem state');
    return (
      <vstack height="100%" width="100%" alignment="center middle" backgroundColor="#1a1a2e">
        <text size="large" color="white">Failed to load poem state</text>
      </vstack>
    );
  }

  console.log('Client: Rendering main app with state:', JSON.stringify(poemState, null, 2));

  const getPhaseTitle = (phase: PoemPhase) => {
    switch (phase) {
      case 'keyline': return 'Vote for Key Line';
      case 'keyword': return 'Vote for Key Word';
      case 'mood': return 'Set the Mood';
      case 'generation': return 'Poem Generation';
      case 'published': return "Today's Poem";
      default: return 'Skinny Poem Generator';
    }
  };

  const getPhaseDescription = (phase: PoemPhase) => {
    switch (phase) {
      case 'keyline': return 'Choose the opening and closing line (8AM-12PM)';
      case 'keyword': return 'Select the key word for lines 2, 6, and 9 (12PM-4PM)';
      case 'mood': return 'Adjust mood variables (4PM-8PM)';
      case 'generation': return 'Poem generation in progress (8PM-9PM)';
      case 'published': return 'Today\'s collaborative poem is complete!';
      default: return 'Collaborative poetry creation';
    }
  };

  const timeLeft = Math.max(0, poemState.phaseEndTime - Date.now());
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const timeLeftText = timeLeft > 0 ? `${hours}h ${minutes}m remaining` : 'Phase ended';

  console.log('Client: Time left calculation - timeLeft:', timeLeft, 'hours:', hours, 'minutes:', minutes);

  return (
    <vstack height="100%" width="100%" backgroundColor="#1a1a2e" padding="medium" gap="medium">
      {/* Header */}
      <vstack alignment="center" gap="small">
        <text size="xxlarge" weight="bold" color="#e94560">
          Skinny Poem Generator
        </text>
        <text size="medium" color="#f5f5f5">
          {getPhaseDescription(poemState.phase)}
        </text>
        <text size="small" color="#a0a0a0">
          {timeLeftText}
        </text>
      </vstack>

      {/* Main Content */}
      <vstack gap="medium" grow>
        <text size="large" weight="bold" color="#f5f5f5" alignment="center">
          {getPhaseTitle(poemState.phase)}
        </text>

        {/* Key Line Voting */}
        {poemState.phase === 'keyline' && (
          <vstack gap="small">
            <text size="medium" color="#f5f5f5">
              Choose the opening and closing line:
            </text>
            {poemState.keyLineOptions.map((option) => (
              <hstack key={option.id} gap="medium" alignment="center middle">
                <button
                  appearance="primary"
                  size="small"
                  disabled={!!userVotes.keyline}
                  onPress={() => {
                    console.log('Client: Key line vote button pressed for option:', option.id);
                    handleVote('keyline', option.id);
                  }}
                >
                  Vote
                </button>
                <vstack grow>
                  <text size="medium" color="white">
                    {option.text}
                  </text>
                  <text size="small" color="#a0a0a0">
                    {option.votes} votes
                  </text>
                </vstack>
              </hstack>
            ))}
            {userVotes.keyline && (
              <text size="small" color="#4ade80">
                ✓ You have voted in this phase
              </text>
            )}
          </vstack>
        )}

        {/* Key Word Voting */}
        {poemState.phase === 'keyword' && (
          <vstack gap="small">
            <text size="medium" color="#f5f5f5">
              Choose the key word for lines 2, 6, and 9:
            </text>
            {poemState.keyWordOptions.map((option) => (
              <hstack key={option.id} gap="medium" alignment="center middle">
                <button
                  appearance="primary"
                  size="small"
                  disabled={!!userVotes.keyword}
                  onPress={() => {
                    console.log('Client: Key word vote button pressed for option:', option.id);
                    handleVote('keyword', option.id);
                  }}
                >
                  Vote
                </button>
                <vstack grow>
                  <text size="medium" color="white">
                    {option.text}
                  </text>
                  <text size="small" color="#a0a0a0">
                    {option.votes} votes
                  </text>
                </vstack>
              </hstack>
            ))}
            {userVotes.keyword && (
              <text size="small" color="#4ade80">
                ✓ You have voted in this phase
              </text>
            )}
          </vstack>
        )}

        {/* Interactive Mood Setting */}
        {poemState.phase === 'mood' && (
          <vstack gap="small">
            <text size="medium" color="#f5f5f5">
              Adjust mood variables (1-10 scale):
            </text>
            <text size="small" color="#a0a0a0">
              Use + and - buttons to set your preferred mood levels
            </text>
            
            {MOOD_VARIABLES.map((moodName) => {
              const variable = poemState.moodVariables[moodName];
              const userValue = localMoodValues[moodName] || 5;
              
              return (
                <vstack key={moodName} gap="small" backgroundColor="#2d2d44" padding="small" cornerRadius="small">
                  <hstack alignment="center middle" gap="medium">
                    <text size="medium" color="#f39c12" weight="bold" width="80px">
                      {moodName}
                    </text>
                    <hstack gap="small" alignment="center middle">
                      <button
                        appearance="secondary"
                        size="small"
                        disabled={!!userVotes.mood || userValue <= 1}
                        onPress={() => {
                          console.log('Client: Mood decrease button pressed for', moodName);
                          updateMoodValue(moodName, -1);
                        }}
                      >
                        -
                      </button>
                      <text size="large" color="white" weight="bold" width="30px" alignment="center">
                        {userValue}
                      </text>
                      <button
                        appearance="secondary"
                        size="small"
                        disabled={!!userVotes.mood || userValue >= 10}
                        onPress={() => {
                          console.log('Client: Mood increase button pressed for', moodName);
                          updateMoodValue(moodName, 1);
                        }}
                      >
                        +
                      </button>
                    </hstack>
                  </hstack>
                  <hstack gap="medium" alignment="center middle">
                    <text size="small" color="#a0a0a0">
                      {getMoodDescription(moodName, userValue)}
                    </text>
                    <text size="small" color="#666">
                      Community avg: {variable.value.toFixed(1)} ({variable.votes} votes)
                    </text>
                  </hstack>
                </vstack>
              );
            })}
            
            {!userVotes.mood && (
              <button
                appearance="primary"
                onPress={() => {
                  console.log('Client: Submit mood settings button pressed');
                  handleVote('mood', undefined, localMoodValues);
                }}
              >
                Submit Mood Settings
              </button>
            )}
            {userVotes.mood && (
              <text size="small" color="#4ade80">
                ✓ You have voted in this phase
              </text>
            )}
          </vstack>
        )}

        {/* Generation Phase */}
        {poemState.phase === 'generation' && (
          <vstack gap="medium" alignment="center">
            <text size="medium" color="#f5f5f5">
              Generating today's poem...
            </text>
            <text size="small" color="#a0a0a0">
              Based on community votes
            </text>
            <button
              appearance="primary"
              onPress={() => {
                console.log('Client: Generate poem button pressed');
                handleGenerate();
              }}
            >
              Generate Poem Now
            </button>
          </vstack>
        )}

        {/* Published Poem */}
        {poemState.phase === 'published' && poemState.generatedPoem && (
          <vstack gap="small" alignment="center">
            <text size="medium" color="#f5f5f5" weight="bold">
              Today's Collaborative Poem:
            </text>
            <vstack gap="small" backgroundColor="#2d2d44" padding="medium" cornerRadius="medium">
              <text size="medium" color="#e94560" weight="bold">
                {poemState.generatedPoem.keyLine}
              </text>
              <text size="medium" color="#f39c12" weight="bold">
                {poemState.generatedPoem.keyWord}
              </text>
              <text size="medium" color="white">
                {poemState.generatedPoem.line3}
              </text>
              <text size="medium" color="white">
                {poemState.generatedPoem.line4}
              </text>
              <text size="medium" color="white">
                {poemState.generatedPoem.line5}
              </text>
              <text size="medium" color="#f39c12" weight="bold">
                {poemState.generatedPoem.keyWord}
              </text>
              <text size="medium" color="white">
                {poemState.generatedPoem.line7}
              </text>
              <text size="medium" color="white">
                {poemState.generatedPoem.line8}
              </text>
              <text size="medium" color="#f39c12" weight="bold">
                {poemState.generatedPoem.keyWord}
              </text>
              <text size="medium" color="white">
                {poemState.generatedPoem.line10}
              </text>
              <text size="medium" color="#e94560" weight="bold">
                {poemState.generatedPoem.keyLine.replace(/[,:;—-]$/, '') + '.'}
              </text>
            </vstack>
            <text size="small" color="#a0a0a0">
              Created: {new Date(poemState.generatedPoem.createdAt).toLocaleDateString()}
            </text>
          </vstack>
        )}
      </vstack>
    </vstack>
  );
};

// Register the custom post type
Devvit.addCustomPostType({
  name: 'Skinny Poem Generator',
  height: 'tall',
  render: App,
});

// Menu action to create new poem posts
Devvit.addMenuItem({
  label: 'Create Poem Generator',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    console.log('Client: Create poem generator menu item pressed');
    const { reddit, ui } = context;

    try {
      const subreddit = await reddit.getCurrentSubreddit();
      console.log('Client: Creating post in subreddit:', subreddit.name);
      
      const post = await reddit.submitPost({
        title: 'Daily Skinny Poem Generator',
        subredditName: subreddit.name,
        preview: (
          <vstack height="100%" width="100%" alignment="center middle" backgroundColor="#1a1a2e">
            <text size="large" color="#e94560" weight="bold">
              Skinny Poem Generator
            </text>
            <text size="medium" color="white">
              Collaborative Poetry Creation
            </text>
          </vstack>
        ),
      });
      
      console.log('Client: Post created successfully:', post.url);
      ui.showToast({ text: 'Created poem generator post!' });
      ui.navigateTo(post.url);
    } catch (error) {
      console.error('Client: Error creating post:', error);
      console.error('Client: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      ui.showToast({ text: 'Error creating post!' });
    }
  },
});

export default Devvit;