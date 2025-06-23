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
      try {
        console.log('Received webview message:', msg);
        
        const { redis, userId } = context;
        
        switch (msg.type) {
          case 'GET_POEM_STATE': {
            const state = await getPoemStateFromRedis(redis);
            context.ui.webView.postMessage('poem-generator', {
              type: 'POEM_STATE_RESPONSE',
              data: state,
              messageId: msg.messageId
            });
            break;
          }
          
          case 'VOTE': {
            if (!userId) {
              context.ui.webView.postMessage('poem-generator', {
                type: 'ERROR',
                message: 'Must be logged in to vote',
                messageId: msg.messageId
              });
              return;
            }
            
            const result = await handleVoteInRedis(redis, userId, msg.data);
            context.ui.webView.postMessage('poem-generator', {
              ...result,
              messageId: msg.messageId
            });
            break;
          }
          
          case 'GENERATE_POEM': {
            const result = await handlePoemGeneration(redis);
            context.ui.webView.postMessage('poem-generator', {
              ...result,
              messageId: msg.messageId
            });
            break;
          }
          
          case 'ADMIN_SIMULATE': {
            if (!userId) {
              context.ui.webView.postMessage('poem-generator', {
                type: 'ERROR',
                message: 'Must be logged in',
                messageId: msg.messageId
              });
              return;
            }
            
            const result = await handleAdminSimulation(redis);
            context.ui.webView.postMessage('poem-generator', {
              ...result,
              messageId: msg.messageId
            });
            break;
          }
          
          default:
            context.ui.webView.postMessage('poem-generator', {
              type: 'ERROR',
              message: 'Unknown message type',
              messageId: msg.messageId
            });
        }
      } catch (error) {
        console.error('Error handling webview message:', error);
        context.ui.webView.postMessage('poem-generator', {
          type: 'ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
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
  return new Date().toISOString().split('T')[0];
};

const getCurrentPhase = () => {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 8 && hour < 12) return 'keyline';
  if (hour >= 12 && hour < 16) return 'keyword';
  if (hour >= 16 && hour < 20) return 'mood';
  if (hour >= 20 && hour < 21) return 'generation';
  return 'published';
};

const getPhaseEndTime = (phase: string): number => {
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

const generateKeyLineOptions = () => {
  const shuffled = [...SAMPLE_KEY_LINES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map((text, index) => ({
    id: `keyline_${index}`,
    text,
    votes: 0
  }));
};

const generateKeyWordOptions = (keyLine: string) => {
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
  
  return allWords.map((text, index) => ({
    id: `keyword_${index}`,
    text,
    votes: 0
  }));
};

const initializeMoodVariables = () => {
  const variables: Record<string, any> = {};
  MOOD_VARIABLES.forEach(name => {
    variables[name] = {
      name,
      value: 5,
      votes: 0
    };
  });
  return variables;
};

const initializeDailyState = (currentDay: string, currentPhase: string) => {
  return {
    phase: currentPhase,
    currentDay,
    keyLineOptions: currentPhase === 'keyline' ? generateKeyLineOptions() : [],
    keyWordOptions: [],
    moodVariables: initializeMoodVariables(),
    phaseEndTime: getPhaseEndTime(currentPhase)
  };
};

const getPoemStateFromRedis = async (redis: any) => {
  try {
    const stored = await redis.get(POEM_STATE_KEY);
    const currentDay = getCurrentDay();
    const currentPhase = getCurrentPhase();
    
    if (stored) {
      const state = JSON.parse(stored);
      
      if (state.currentDay !== currentDay) {
        return initializeDailyState(currentDay, currentPhase);
      }
      
      if (state.phase !== currentPhase) {
        state.phase = currentPhase;
        state.phaseEndTime = getPhaseEndTime(currentPhase);
        
        if (currentPhase === 'keyword' && state.selectedKeyLine && state.keyWordOptions.length === 0) {
          state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
        }
      }
      
      return state;
    }
    
    return initializeDailyState(currentDay, currentPhase);
  } catch (error) {
    console.error('Error getting poem state from Redis:', error);
    return initializeDailyState(getCurrentDay(), getCurrentPhase());
  }
};

const savePoemStateToRedis = async (redis: any, state: any) => {
  try {
    await redis.set(POEM_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving poem state to Redis:', error);
    throw error;
  }
};

const handleVoteInRedis = async (redis: any, userId: string, voteData: any) => {
  try {
    const { type, optionId, moodValues } = voteData;
    const state = await getPoemStateFromRedis(redis);
    
    if ((type === 'keyline' && state.phase !== 'keyline') ||
        (type === 'keyword' && state.phase !== 'keyword') ||
        (type === 'mood' && state.phase !== 'mood')) {
      return { type: 'ERROR', message: 'Voting not allowed for this phase' };
    }

    const voteKey = `vote:${getCurrentDay()}:${userId}:${type}`;
    const hasVoted = await redis.get(voteKey);
    
    if (hasVoted) {
      return { type: 'ERROR', message: 'You have already voted for this phase today' };
    }

    if (type === 'keyline' && optionId) {
      const option = state.keyLineOptions.find((opt: any) => opt.id === optionId);
      if (option) {
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 });
      }
    } else if (type === 'keyword' && optionId) {
      const option = state.keyWordOptions.find((opt: any) => opt.id === optionId);
      if (option) {
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 });
      }
    } else if (type === 'mood' && moodValues) {
      Object.entries(moodValues).forEach(([moodName, value]: [string, any]) => {
        if (state.moodVariables[moodName] && value >= 1 && value <= 10) {
          const currentTotal = state.moodVariables[moodName].value * state.moodVariables[moodName].votes;
          state.moodVariables[moodName].votes++;
          state.moodVariables[moodName].value = (currentTotal + value) / state.moodVariables[moodName].votes;
        }
      });
      await redis.set(voteKey, JSON.stringify(moodValues), { ex: 86400 });
    }

    await savePoemStateToRedis(redis, state);
    return { type: 'VOTE_RESPONSE', success: true, message: 'Vote submitted successfully!', data: state };
  } catch (error) {
    return { type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

const generatePoem = (keyLine: string, keyWord: string, mood: Record<string, number>) => {
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
    return word;
  });
  
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
  
  const line10 = (() => {
    let word;
    do {
      word = WORD_BANKS.adjectives[Math.floor(Math.random() * WORD_BANKS.adjectives.length)];
    } while (usedWords.has(word));
    return word;
  })();
  
  const punctuations = [',', '—', '-', ':', ';'];
  const randomPunct = () => punctuations[Math.floor(Math.random() * punctuations.length)];
  
  return {
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
};

const handlePoemGeneration = async (redis: any) => {
  try {
    const state = await getPoemStateFromRedis(redis);
    
    if (state.phase !== 'generation') {
      return { type: 'ERROR', message: 'Not in generation phase' };
    }

    let selectedKeyLine = state.selectedKeyLine;
    if (!selectedKeyLine) {
      const winningKeyLine = state.keyLineOptions.reduce((prev: any, current: any) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyLine = (winningKeyLine && winningKeyLine.text) || (state.keyLineOptions[0] && state.keyLineOptions[0].text);
      state.selectedKeyLine = selectedKeyLine;
    }

    let selectedKeyWord = state.selectedKeyWord;
    if (!selectedKeyWord) {
      const winningKeyWord = state.keyWordOptions.reduce((prev: any, current: any) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyWord = (winningKeyWord && winningKeyWord.text) || (state.keyWordOptions[0] && state.keyWordOptions[0].text);
      state.selectedKeyWord = selectedKeyWord;
    }

    if (!selectedKeyLine || !selectedKeyWord) {
      return { type: 'ERROR', message: 'Missing key line or key word' };
    }

    const moodValues: Record<string, number> = {};
    Object.entries(state.moodVariables).forEach(([name, variable]: [string, any]) => {
      moodValues[name] = variable.votes > 0 ? variable.value : Math.floor(Math.random() * 10) + 1;
    });

    const poem = generatePoem(selectedKeyLine, selectedKeyWord, moodValues);

    await redis.set(DAILY_POEM_KEY(getCurrentDay()), JSON.stringify(poem));
    state.generatedPoem = poem;
    state.phase = 'published';

    await savePoemStateToRedis(redis, state);
    return { type: 'GENERATE_RESPONSE', success: true, poem };
  } catch (error) {
    return { type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

const handleAdminSimulation = async (redis: any) => {
  try {
    const state = await getPoemStateFromRedis(redis);

    switch (state.phase) {
      case 'keyline':
        const winningKeyLine = state.keyLineOptions.reduce((prev: any, current: any) => 
          prev.votes > current.votes ? prev : current
        );
        state.selectedKeyLine = (winningKeyLine && winningKeyLine.text) || (state.keyLineOptions[0] && state.keyLineOptions[0].text);
        state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
        state.phase = 'keyword';
        break;

      case 'keyword':
        const winningKeyWord = state.keyWordOptions.reduce((prev: any, current: any) => 
          prev.votes > current.votes ? prev : current
        );
        state.selectedKeyWord = (winningKeyWord && winningKeyWord.text) || (state.keyWordOptions[0] && state.keyWordOptions[0].text);
        state.phase = 'mood';
        break;

      case 'mood':
        Object.keys(state.moodVariables).forEach(moodName => {
          if (state.moodVariables[moodName].votes === 0) {
            state.moodVariables[moodName].value = Math.floor(Math.random() * 10) + 1;
            state.moodVariables[moodName].votes = 1;
          }
        });
        state.phase = 'generation';
        break;

      default:
        return { type: 'ERROR', message: 'Cannot simulate current phase' };
    }

    await savePoemStateToRedis(redis, state);
    return { type: 'SIMULATE_RESPONSE', success: true, message: 'Phase simulated successfully!', data: state };
  } catch (error) {
    return { type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Menu item for creating new poem posts
Devvit.addMenuItem({
  label: '[Skinny Poem Generator] New Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;

    let post;
    try {
      const subreddit = await reddit.getCurrentSubreddit();
      post = await reddit.submitPost({
        title: 'Daily Skinny Poem Generator',
        subredditName: subreddit.name,
        preview: <Preview text="Collaborative Poetry Creation" />,
      });
      
      ui.showToast({ text: 'Created poem generator post!' });
      ui.navigateTo(post.url);
    } catch (error) {
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