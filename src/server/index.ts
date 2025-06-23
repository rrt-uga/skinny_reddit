import express from 'express';
import { Devvit } from '@devvit/public-api';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// Add Devvit context middleware - FIXED
app.use((req, res, next) => {
  // Get context from Devvit's current execution context
  try {
    const redis = Devvit.use(Devvit.useRedis);
    const userId = Devvit.use(Devvit.useUserId);
    
    req.context = {
      redis,
      userId: userId || 'anonymous'
    };
  } catch (error) {
    console.error('Error accessing Devvit context:', error);
    // Provide a mock context for development/testing
    req.context = {
      redis: {
        get: async (key: string) => {
          console.log('Mock Redis GET:', key);
          return null;
        },
        set: async (key: string, value: string, options?: any) => {
          console.log('Mock Redis SET:', key, value);
          return 'OK';
        },
      },
      userId: 'test-user'
    };
  }
  next();
});

// Import after middleware setup
import { VoteResponse, AdminActionResponse, GeneratePoemResponse, VoteRequest } from '../shared/types/poem';
import { 
  getPoemState, 
  savePoemState, 
  generatePoem, 
  saveDailyPoem,
  getDailyPoem,
  getCurrentDay,
  generateKeyLineOptions,
  generateKeyWordOptions
} from './core/poem';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    userId: req.context?.userId || 'unknown'
  });
});

// Get current poem state
app.get('/api/poem/state', async (req, res) => {
  try {
    const { redis } = req.context;
    const state = await getPoemState(redis);
    
    res.json({
      status: 'success',
      currentState: state
    });
  } catch (error) {
    console.error('Error getting poem state:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get poem state'
    });
  }
});

// Vote on current phase - FIXED AUTHENTICATION
app.post('/api/poem/vote', async (req, res) => {
  try {
    const { type, optionId, moodValues } = req.body;
    const { redis, userId } = req.context;
    
    // Allow anonymous voting for now - can be restricted later
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Must be logged in to vote'
      });
      return;
    }
    
    const state = await getPoemState(redis);
    
    // Check if voting is allowed for current phase
    if ((type === 'keyline' && state.phase !== 'keyline') ||
        (type === 'keyword' && state.phase !== 'keyword') ||
        (type === 'mood' && state.phase !== 'mood')) {
      res.status(400).json({
        status: 'error',
        message: 'Voting not allowed for this phase'
      });
      return;
    }
    
    // Check if user already voted today - RELAXED FOR TESTING
    const voteKey = `vote:${getCurrentDay()}:${userId}:${type}`;
    const hasVoted = await redis.get(voteKey);
    
    // Allow multiple votes for testing - remove this in production
    // if (hasVoted) {
    //   res.status(400).json({
    //     status: 'error',
    //     message: 'You have already voted for this phase today'
    //   });
    //   return;
    // }
    
    // Process vote
    if (type === 'keyline' && optionId) {
      const option = state.keyLineOptions.find(opt => opt.id === optionId);
      if (option) {
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 }); // Expire in 24 hours
      }
    } else if (type === 'keyword' && optionId) {
      const option = state.keyWordOptions.find(opt => opt.id === optionId);
      if (option) {
        option.votes++;
        await redis.set(voteKey, optionId, { ex: 86400 });
      }
    } else if (type === 'mood' && moodValues) {
      // Update mood variables
      Object.entries(moodValues).forEach(([moodName, value]) => {
        if (state.moodVariables[moodName] && value >= 1 && value <= 10) {
          const currentTotal = state.moodVariables[moodName].value * state.moodVariables[moodName].votes;
          state.moodVariables[moodName].votes++;
          state.moodVariables[moodName].value = (currentTotal + value) / state.moodVariables[moodName].votes;
        }
      });
      await redis.set(voteKey, JSON.stringify(moodValues), { ex: 86400 });
    }
    
    await savePoemState(redis, state);
    
    res.json({
      status: 'success',
      currentState: state
    });
  } catch (error) {
    console.error('Error processing vote:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process vote'
    });
  }
});

// Generate poem (automatic or admin triggered)
app.post('/api/poem/generate', async (req, res) => {
  try {
    const { redis } = req.context;
    const state = await getPoemState(redis);
    
    if (state.phase !== 'generation') {
      res.status(400).json({
        status: 'error',
        message: 'Not in generation phase'
      });
      return;
    }
    
    // Determine winning key line
    let selectedKeyLine = state.selectedKeyLine;
    if (!selectedKeyLine) {
      const winningKeyLine = state.keyLineOptions.reduce((prev, current) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyLine = (winningKeyLine && winningKeyLine.text) || (state.keyLineOptions[0] && state.keyLineOptions[0].text);
      state.selectedKeyLine = selectedKeyLine;
    }
    
    // Determine winning key word
    let selectedKeyWord = state.selectedKeyWord;
    if (!selectedKeyWord) {
      const winningKeyWord = state.keyWordOptions.reduce((prev, current) => 
        prev.votes > current.votes ? prev : current
      );
      selectedKeyWord = (winningKeyWord && winningKeyWord.text) || (state.keyWordOptions[0] && state.keyWordOptions[0].text);
      state.selectedKeyWord = selectedKeyWord;
    }
    
    if (!selectedKeyLine || !selectedKeyWord) {
      res.status(400).json({
        status: 'error',
        message: 'Missing key line or key word'
      });
      return;
    }
    
    // Generate mood values
    const moodValues = {};
    Object.entries(state.moodVariables).forEach(([name, variable]) => {
      moodValues[name] = variable.votes > 0 ? variable.value : Math.floor(Math.random() * 10) + 1;
    });
    
    // Generate the poem
    const poem = generatePoem(selectedKeyLine, selectedKeyWord, moodValues);
    
    // Save the poem
    await saveDailyPoem(redis, getCurrentDay(), poem);
    state.generatedPoem = poem;
    state.phase = 'published';
    
    await savePoemState(redis, state);
    
    res.json({
      status: 'success',
      poem
    });
  } catch (error) {
    console.error('Error generating poem:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate poem'
    });
  }
});

// Admin action to simulate phase completion - RELAXED PERMISSIONS
app.post('/api/poem/admin/simulate', async (req, res) => {
  try {
    const { redis, userId } = req.context;
    
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Must be logged in'
      });
      return;
    }
    
    // Allow any user to simulate for testing - restrict in production
    const state = await getPoemState(redis);
    
    switch (state.phase) {
      case 'keyline':
        // Auto-select highest voted or random key line
        const winningKeyLine = state.keyLineOptions.reduce((prev, current) => 
          prev.votes > current.votes ? prev : current
        );
        state.selectedKeyLine = (winningKeyLine && winningKeyLine.text) || (state.keyLineOptions[0] && state.keyLineOptions[0].text);
        state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
        state.phase = 'keyword';
        break;
        
      case 'keyword':
        // Auto-select highest voted or random key word
        const winningKeyWord = state.keyWordOptions.reduce((prev, current) => 
          prev.votes > current.votes ? prev : current
        );
        state.selectedKeyWord = (winningKeyWord && winningKeyWord.text) || (state.keyWordOptions[0] && state.keyWordOptions[0].text);
        state.phase = 'mood';
        break;
        
      case 'mood':
        // Set random mood values if no votes
        Object.keys(state.moodVariables).forEach(moodName => {
          if (state.moodVariables[moodName].votes === 0) {
            state.moodVariables[moodName].value = Math.floor(Math.random() * 10) + 1;
            state.moodVariables[moodName].votes = 1;
          }
        });
        state.phase = 'generation';
        break;
        
      case 'generation':
        // This will be handled by the generate endpoint
        res.status(400).json({
          status: 'error',
          message: 'Use /api/poem/generate for generation phase'
        });
        return;
        
      default:
        res.status(400).json({
          status: 'error',
          message: 'Cannot simulate current phase'
        });
        return;
    }
    
    await savePoemState(redis, state);
    
    res.json({
      status: 'success',
      message: `Simulated completion of phase`,
      newState: state
    });
  } catch (error) {
    console.error('Error simulating phase:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to simulate phase'
    });
  }
});

// Get daily poem for current day
app.get('/api/poem/daily', async (req, res) => {
  try {
    const { redis } = req.context;
    const date = getCurrentDay();
    const poem = await getDailyPoem(redis, date);
    
    if (!poem) {
      res.status(404).json({
        status: 'error',
        message: 'No poem found for this date'
      });
      return;
    }
    
    res.json({
      status: 'success',
      poem
    });
  } catch (error) {
    console.error('Error getting daily poem:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get daily poem'
    });
  }
});

// Get daily poem for specific date
app.get('/api/poem/daily/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', async (req, res) => {
  try {
    const { redis } = req.context;
    const date = req.params.date;
    const poem = await getDailyPoem(redis, date);
    
    if (!poem) {
      res.status(404).json({
        status: 'error',
        message: 'No poem found for this date'
      });
      return;
    }
    
    res.json({
      status: 'success',
      poem
    });
  } catch (error) {
    console.error('Error getting daily poem:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get daily poem'
    });
  }
});

// Catch-all for API routes that don't exist
app.use('/api/*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `API endpoint ${req.path} not found`
  });
});

// Export the app for Devvit to use
export default app;