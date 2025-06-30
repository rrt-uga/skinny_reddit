import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

export const Preview: Devvit.BlockComponent<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <zstack width={'100%'} height={'100%'} alignment="center middle">
      <vstack width={'100%'} height={'100%'} alignment="center middle">
        <image
          url="loading.gif"
          description="Loading..."
          height={'140px'}
          width={'140px'}
          imageHeight={'240px'}
          imageWidth={'240px'}
        />
        <spacer size="small" />
        <text maxWidth={`80%`} size="large" weight="bold" alignment="center middle" wrap>
          {text}
        </text>
      </vstack>
    </zstack>
  );
};

// Add webview for the poem generator
Devvit.addCustomPostType({
  name: 'Skinny Poem Generator',
  height: 'tall',
  render: (context) => {
    const { useState, useAsync, useInterval } = context;
    const [currentMessage, setCurrentMessage] = useState<string>('');

    // Handle messages from webview
    const onMessage = async (msg: any) => {
      console.log('Devvit: Received webview message:', JSON.stringify(msg, null, 2));
      
      try {
        const { redis, userId } = context;
        console.log('Devvit: Processing message with userId:', userId);
        
        // Always respond with messageId to prevent timeouts
        const respondWithError = (message: string) => {
          console.log('Devvit: Sending error response:', message);
          context.ui.webView.postMessage('poem-generator', {
            type: 'ERROR',
            message,
            messageId: msg.messageId
          });
        };

        const respondWithSuccess = (data: any, message?: string) => {
          console.log('Devvit: Sending success response');
          context.ui.webView.postMessage('poem-generator', {
            type: 'SUCCESS',
            data,
            message,
            messageId: msg.messageId
          });
        };
        
        switch (msg.type) {
          case 'GET_POEM_STATE': {
            console.log('Devvit: Getting poem state from Redis');
            try {
              const state = await getPoemStateFromRedis(redis);
              console.log('Devvit: Poem state fetched successfully');
              
              context.ui.webView.postMessage('poem-generator', {
                type: 'POEM_STATE_RESPONSE',
                data: state,
                messageId: msg.messageId
              });
            } catch (error) {
              console.error('Devvit: Error getting poem state:', error);
              respondWithError('Failed to load poem state');
            }
            break;
          }
          
          case 'VOTE': {
            console.log('Devvit: Processing vote with data:', JSON.stringify(msg.data, null, 2));
            
            if (!userId) {
              console.log('Devvit: Vote rejected - user not logged in');
              respondWithError('Must be logged in to vote');
              return;
            }
            
            try {
              const result = await handleVoteInRedis(redis, userId, msg.data);
              console.log('Devvit: Vote result:', JSON.stringify(result, null, 2));
              
              context.ui.webView.postMessage('poem-generator', {
                ...result,
                messageId: msg.messageId
              });
            } catch (error) {
              console.error('Devvit: Error processing vote:', error);
              respondWithError('Failed to process vote');
            }
            break;
          }
          
          case 'GENERATE_POEM': {
            console.log('Devvit: Processing poem generation request');
            try {
              const result = await handlePoemGeneration(redis);
              console.log('Devvit: Poem generation result:', JSON.stringify(result, null, 2));
              
              context.ui.webView.postMessage('poem-generator', {
                ...result,
                messageId: msg.messageId
              });
            } catch (error) {
              console.error('Devvit: Error generating poem:', error);
              respondWithError('Failed to generate poem');
            }
            break;
          }
          
          case 'ADMIN_SIMULATE': {
            console.log('Devvit: Processing admin simulation request');
            
            if (!userId) {
              console.log('Devvit: Admin simulation rejected - user not logged in');
              respondWithError('Must be logged in');
              return;
            }
            
            try {
              const result = await handleAdminSimulation(redis);
              console.log('Devvit: Admin simulation result:', JSON.stringify(result, null, 2));
              
              context.ui.webView.postMessage('poem-generator', {
                ...result,
                messageId: msg.messageId
              });
            } catch (error) {
              console.error('Devvit: Error in admin simulation:', error);
              respondWithError('Failed to simulate phase');
            }
            break;
          }
          
          default:
            console.log('Devvit: Unknown message type:', msg.type);
            respondWithError('Unknown message type');
        }
      } catch (error) {
        console.error('Devvit: Unexpected error handling webview message:', error);
        console.error('Devvit: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        
        context.ui.webView.postMessage('poem-generator', {
          type: 'ERROR',
          message: 'Internal server error',
          messageId: msg.messageId
        });
      }
    };

    return (
      <vstack width="100%" height="100%">
        <webview
          id="poem-generator"
          url="index.html"
          width="100%"
          height="100%"
          onMessage={onMessage}
        />
      </vstack>
    );
  },
});

// Poem logic functions (moved from separate files to avoid import issues)
const POEM_STATE_KEY = 'poem_state';
const DAILY_POEM_KEY = (date: string) => `daily_poem:${date}`;

const MOOD_VARIABLES = [
  'melancholy', 'joy', 'mystery', 'passion', 'serenity', 
  'rebellion', 'nostalgia', 'hope', 'darkness', 'whimsy'
];

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

const getCurrentDay = (): string => {
  const day = new Date().toISOString().split('T')[0];
  console.log('Devvit: Current day:', day);
  return day;
};

const getCurrentPhase = () => {
  const now = new Date();
  const hour = now.getHours();
  console.log('Devvit: Current hour:', hour);
  
  let phase;
  if (hour >= 8 && hour < 12) phase = 'keyline';
  else if (hour >= 12 && hour < 16) phase = 'keyword';
  else if (hour >= 16 && hour < 20) phase = 'mood';
  else if (hour >= 20 && hour < 21) phase = 'generation';
  else phase = 'published';
  
  console.log('Devvit: Current phase:', phase);
  return phase;
};

const getPhaseEndTime = (phase: string): number => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let endTime;
  switch (phase) {
    case 'keyline': endTime = today.getTime() + 12 * 60 * 60 * 1000; break; // 12 PM
    case 'keyword': endTime = today.getTime() + 16 * 60 * 60 * 1000; break; // 4 PM
    case 'mood': endTime = today.getTime() + 20 * 60 * 60 * 1000; break; // 8 PM
    case 'generation': endTime = today.getTime() + 21 * 60 * 60 * 1000; break; // 9 PM
    default: endTime = today.getTime() + 24 * 60 * 60 * 1000; // Next day
  }
  
  console.log('Devvit: Phase end time for', phase, ':', new Date(endTime).toISOString());
  return endTime;
};

const generateKeyLineOptions = () => {
  console.log('Devvit: Generating key line options');
  const shuffled = [...SAMPLE_KEY_LINES].sort(() => Math.random() - 0.5);
  const options = shuffled.slice(0, 5).map((text, index) => ({
    id: `keyline_${index}`,
    text,
    votes: 0
  }));
  console.log('Devvit: Generated key line options:', options);
  return options;
};

const generateKeyWordOptions = (keyLine: string) => {
  console.log('Devvit: Generating key word options from:', keyLine);
  
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
  
  console.log('Devvit: Generated key word options:', options);
  return options;
};

const initializeMoodVariables = () => {
  console.log('Devvit: Initializing mood variables');
  const variables: Record<string, any> = {};
  MOOD_VARIABLES.forEach(name => {
    variables[name] = {
      name,
      value: 5,
      votes: 0
    };
  });
  console.log('Devvit: Initialized mood variables:', variables);
  return variables;
};

const initializeDailyState = (currentDay: string, currentPhase: string) => {
  console.log('Devvit: Initializing daily state for day:', currentDay, 'phase:', currentPhase);
  
  const state = {
    phase: currentPhase,
    currentDay,
    keyLineOptions: currentPhase === 'keyline' ? generateKeyLineOptions() : [],
    keyWordOptions: [],
    moodVariables: initializeMoodVariables(),
    phaseEndTime: getPhaseEndTime(currentPhase)
  };
  
  console.log('Devvit: Initialized daily state:', JSON.stringify(state, null, 2));
  return state;
};

const getPoemStateFromRedis = async (redis: any) => {
  try {
    console.log('Devvit: Getting poem state from Redis with key:', POEM_STATE_KEY);
    
    // Add timeout wrapper for Redis operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis operation timeout')), 10000);
    });
    
    const redisPromise = redis.get(POEM_STATE_KEY);
    const stored = await Promise.race([redisPromise, timeoutPromise]);
    
    console.log('Devvit: Raw stored state retrieved successfully');
    
    const currentDay = getCurrentDay();
    const currentPhase = getCurrentPhase();
    
    if (stored) {
      const state = JSON.parse(stored);
      console.log('Devvit: Parsed stored state successfully');
      
      if (state.currentDay !== currentDay) {
        console.log('Devvit: Day changed, initializing new daily state');
        const newState = initializeDailyState(currentDay, currentPhase);
        await savePoemStateToRedis(redis, newState);
        return newState;
      }
      
      if (state.phase !== currentPhase) {
        console.log('Devvit: Phase changed from', state.phase, 'to', currentPhase);
        state.phase = currentPhase;
        state.phaseEndTime = getPhaseEndTime(currentPhase);
        
        if (currentPhase === 'keyword' && state.selectedKeyLine && state.keyWordOptions.length === 0) {
          console.log('Devvit: Generating keyword options for selected key line:', state.selectedKeyLine);
          state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
        }
        
        await savePoemStateToRedis(redis, state);
      }
      
      console.log('Devvit: Final state prepared successfully');
      return state;
    }
    
    console.log('Devvit: No stored state found, initializing new state');
    const newState = initializeDailyState(currentDay, currentPhase);
    await savePoemStateToRedis(redis, newState);
    return newState;
  } catch (error) {
    console.error('Devvit: Error getting poem state from Redis:', error);
    console.error('Devvit: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return a basic state if Redis fails
    const fallbackState = initializeDailyState(getCurrentDay(), getCurrentPhase());
    console.log('Devvit: Returning fallback state due to Redis error');
    return fallbackState;
  }
};

const savePoemStateToRedis = async (redis: any, state: any) => {
  try {
    console.log('Devvit: Saving poem state to Redis');
    
    // Add timeout wrapper for Redis operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis save timeout')), 5000);
    });
    
    const redisPromise = redis.set(POEM_STATE_KEY, JSON.stringify(state));
    await Promise.race([redisPromise, timeoutPromise]);
    
    console.log('Devvit: Successfully saved poem state to Redis');
  } catch (error) {
    console.error('Devvit: Error saving poem state to Redis:', error);
    console.error('Devvit: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    // Don't throw here - let the operation continue even if save fails
  }
};

const handleVoteInRedis = async (redis: any, userId: string, voteData: any) => {
  try {
    console.log('Devvit: Handling vote for user:', userId, 'with data:', JSON.stringify(voteData, null, 2));
    
    const { type, optionId, moodValues } = voteData;
    const state = await getPoemStateFromRedis(redis);
    
    console.log('Devvit: Current state phase:', state.phase, 'Vote type:', type);
    
    if ((type === 'keyline' && state.phase !== 'keyline') ||
        (type === 'keyword' && state.phase !== 'keyword') ||
        (type === 'mood' && state.phase !== 'mood')) {
      console.log('Devvit: Vote rejected - wrong phase');
      return { type: 'ERROR', message: 'Voting not allowed for this phase' };
    }

    const voteKey = `vote:${getCurrentDay()}:${userId}:${type}`;
    console.log('Devvit: Checking if user has already voted with key:', voteKey);
    
    const hasVoted = await redis.get(voteKey);
    console.log('Devvit: User has already voted:', !!hasVoted);
    
    if (hasVoted) {
      return { type: 'ERROR', message: 'You have already voted for this phase today' };
    }

    if (type === 'keyline' && optionId) {
      console.log('Devvit: Processing keyline vote for option:', optionId);
      const option = state.keyLineOptions.find((opt: any) => opt.id === optionId);
      if (option) {
        console.log('Devvit: Found option, incrementing votes from', option.votes, 'to', option.votes + 1);
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 });
        console.log('Devvit: Saved keyline vote to Redis');
      } else {
        console.log('Devvit: Option not found for keyline vote');
      }
    } else if (type === 'keyword' && optionId) {
      console.log('Devvit: Processing keyword vote for option:', optionId);
      const option = state.keyWordOptions.find((opt: any) => opt.id === optionId);
      if (option) {
        console.log('Devvit: Found option, incrementing votes from', option.votes, 'to', option.votes + 1);
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 });
        console.log('Devvit: Saved keyword vote to Redis');
      } else {
        console.log('Devvit: Option not found for keyword vote');
      }
    } else if (type === 'mood' && moodValues) {
      console.log('Devvit: Processing mood vote with values:', JSON.stringify(moodValues, null, 2));
      Object.entries(moodValues).forEach(([moodName, value]: [string, any]) => {
        if (state.moodVariables[moodName] && value >= 1 && value <= 10) {
          const currentTotal = state.moodVariables[moodName].value * state.moodVariables[moodName].votes;
          const oldValue = state.moodVariables[moodName].value;
          const oldVotes = state.moodVariables[moodName].votes;
          
          state.moodVariables[moodName].votes++;
          state.moodVariables[moodName].value = (currentTotal + value) / state.moodVariables[moodName].votes;
          
          console.log(`Devvit: Updated mood ${moodName}: ${oldValue} (${oldVotes} votes) -> ${state.moodVariables[moodName].value} (${state.moodVariables[moodName].votes} votes)`);
        }
      });
      await redis.set(voteKey, JSON.stringify(moodValues), { ex: 86400 });
      console.log('Devvit: Saved mood vote to Redis');
    }

    await savePoemStateToRedis(redis, state);
    console.log('Devvit: Vote processed successfully');
    
    return { type: 'VOTE_RESPONSE', success: true, message: 'Vote submitted successfully!', data: state };
  } catch (error) {
    console.error('Devvit: Error handling vote:', error);
    console.error('Devvit: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return { type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

const generatePoem = (keyLine: string, keyWord: string, mood: Record<string, number>) => {
  console.log('Devvit: Generating poem with keyLine:', keyLine, 'keyWord:', keyWord, 'mood:', JSON.stringify(mood, null, 2));
  
  const usedWords = new Set<string>();
  
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
    console.log(`Devvit: Selected ${type} word:`, word);
    return word;
  });
  
  const line7 = (() => {
    let word;
    do {
      word = WORD_BANKS.prepositions[Math.floor(Math.random() * WORD_BANKS.prepositions.length)];
    } while (usedWords.has(word));
    usedWords.add(word);
    console.log('Devvit: Selected line7 word:', word);
    return word;
  })();
  
  const line8 = (() => {
    let word;
    do {
      word = WORD_BANKS.adjectives[Math.floor(Math.random() * WORD_BANKS.adjectives.length)];
    } while (usedWords.has(word));
    usedWords.add(word);
    console.log('Devvit: Selected line8 word:', word);
    return word;
  })();
  
  const line10 = (() => {
    let word;
    do {
      word = WORD_BANKS.adjectives[Math.floor(Math.random() * WORD_BANKS.adjectives.length)];
    } while (usedWords.has(word));
    console.log('Devvit: Selected line10 word:', word);
    return word;
  })();
  
  const punctuations = [',', '—', '-', ':', ';'];
  const randomPunct = () => punctuations[Math.floor(Math.random() * punctuations.length)];
  
  const poem = {
    keyLine: keyLine.replace(/[.,:;—-]$/, '') + randomPunct(),
    keyWord: keyWord + randomPunct(),
    line3: line3Words[0],
    line4: line3Words[1] + randomPunct(),
    line5: line3Words[2] + randomPunct(),
    line7: line7,
    line8: line8 + randomPunct(),
    line10: line10,
    mood,
    createdAt: new Date().toISOString()
  };
  
  console.log('Devvit: Generated poem:', JSON.stringify(poem, null, 2));
  return poem;
};

const handlePoemGeneration = async (redis: any) => {
  try {
    console.log('Devvit: Starting poem generation');
    const state = await getPoemStateFromRedis(redis);
    
    if (state.phase !== 'generation') {
      console.log('Devvit: Poem generation rejected - not in generation phase, current phase:', state.phase);
      return { type: 'ERROR', message: 'Not in generation phase' };
    }

    let selectedKeyLine = state.selectedKeyLine;
    if (!selectedKeyLine) {
      console.log('Devvit: No selected key line, finding winner from options:', state.keyLineOptions);
      const winningKeyLine = state.keyLineOptions.reduce((prev: any, current: any) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyLine = (winningKeyLine && winningKeyLine.text) || (state.keyLineOptions[0] && state.keyLineOptions[0].text);
      state.selectedKeyLine = selectedKeyLine;
      console.log('Devvit: Selected key line:', selectedKeyLine);
    }

    let selectedKeyWord = state.selectedKeyWord;
    if (!selectedKeyWord) {
      console.log('Devvit: No selected key word, finding winner from options:', state.keyWordOptions);
      const winningKeyWord = state.keyWordOptions.reduce((prev: any, current: any) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyWord = (winningKeyWord && winningKeyWord.text) || (state.keyWordOptions[0] && state.keyWordOptions[0].text);
      state.selectedKeyWord = selectedKeyWord;
      console.log('Devvit: Selected key word:', selectedKeyWord);
    }

    if (!selectedKeyLine || !selectedKeyWord) {
      console.log('Devvit: Missing required elements - keyLine:', selectedKeyLine, 'keyWord:', selectedKeyWord);
      return { type: 'ERROR', message: 'Missing key line or key word' };
    }

    const moodValues: Record<string, number> = {};
    Object.entries(state.moodVariables).forEach(([name, variable]: [string, any]) => {
      moodValues[name] = variable.votes > 0 ? variable.value : Math.floor(Math.random() * 10) + 1;
    });
    console.log('Devvit: Final mood values for poem:', JSON.stringify(moodValues, null, 2));

    const poem = generatePoem(selectedKeyLine, selectedKeyWord, moodValues);

    console.log('Devvit: Saving poem to Redis with key:', DAILY_POEM_KEY(getCurrentDay()));
    await redis.set(DAILY_POEM_KEY(getCurrentDay()), JSON.stringify(poem));
    
    state.generatedPoem = poem;
    state.phase = 'published';

    await savePoemStateToRedis(redis, state);
    console.log('Devvit: Poem generation completed successfully');
    
    return { type: 'GENERATE_RESPONSE', success: true, poem };
  } catch (error) {
    console.error('Devvit: Error generating poem:', error);
    console.error('Devvit: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return { type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

const handleAdminSimulation = async (redis: any) => {
  try {
    console.log('Devvit: Starting admin simulation');
    const state = await getPoemStateFromRedis(redis);
    console.log('Devvit: Current state for simulation:', JSON.stringify(state, null, 2));

    switch (state.phase) {
      case 'keyline':
        console.log('Devvit: Simulating keyline phase completion');
        const winningKeyLine = state.keyLineOptions.reduce((prev: any, current: any) => 
          prev.votes > current.votes ? prev : current
        );
        state.selectedKeyLine = (winningKeyLine && winningKeyLine.text) || (state.keyLineOptions[0] && state.keyLineOptions[0].text);
        state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
        state.phase = 'keyword';
        console.log('Devvit: Simulated keyline -> keyword, selected:', state.selectedKeyLine);
        break;

      case 'keyword':
        console.log('Devvit: Simulating keyword phase completion');
        const winningKeyWord = state.keyWordOptions.reduce((prev: any, current: any) => 
          prev.votes > current.votes ? prev : current
        );
        state.selectedKeyWord = (winningKeyWord && winningKeyWord.text) || (state.keyWordOptions[0] && state.keyWordOptions[0].text);
        state.phase = 'mood';
        console.log('Devvit: Simulated keyword -> mood, selected:', state.selectedKeyWord);
        break;

      case 'mood':
        console.log('Devvit: Simulating mood phase completion');
        Object.keys(state.moodVariables).forEach(moodName => {
          if (state.moodVariables[moodName].votes === 0) {
            const randomValue = Math.floor(Math.random() * 10) + 1;
            state.moodVariables[moodName].value = randomValue;
            state.moodVariables[moodName].votes = 1;
            console.log(`Devvit: Set random mood value for ${moodName}:`, randomValue);
          }
        });
        state.phase = 'generation';
        console.log('Devvit: Simulated mood -> generation');
        break;

      default:
        console.log('Devvit: Cannot simulate current phase:', state.phase);
        return { type: 'ERROR', message: 'Cannot simulate current phase' };
    }

    await savePoemStateToRedis(redis, state);
    console.log('Devvit: Admin simulation completed successfully');
    
    return { type: 'SIMULATE_RESPONSE', success: true, message: 'Phase simulated successfully!', data: state };
  } catch (error) {
    console.error('Devvit: Error in admin simulation:', error);
    console.error('Devvit: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return { type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Menu item for creating new poem posts
Devvit.addMenuItem({
  label: '[Skinny Poem Generator] New Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    console.log('Devvit: Creating new poem generator post');
    const { reddit, ui } = context;

    let post;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      console.log('Devvit: Creating post in subreddit:', subreddit.name);
      
      post = await reddit.submitPost({
        title: 'Daily Skinny Poem Generator',
        subredditName: subreddit.name,
        preview: <Preview text="Collaborative Poetry Creation" />,
      });
      
      console.log('Devvit: Post created successfully:', post.url);
      ui.showToast({ text: 'Created poem generator post!' });
      ui.navigateTo(post.url);
    } catch (error) {
      console.error('Devvit: Error creating post:', error);
      console.error('Devvit: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      if (post) {
        await post.remove(false);
      }
      if (error instanceof Error) {
        ui.showToast({ text: `Error creating post: ${error.message}` });
      } else {
        ui.showToast({ text: 'Error creating post!' });
      }
    }
  },
});

export default Devvit;