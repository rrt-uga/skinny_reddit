import { Context } from '@devvit/public-api';
import { 
  getPoemState, 
  savePoemState, 
  generatePoem, 
  saveDailyPoem,
  getDailyPoem,
  getCurrentDay,
  generateKeyLineOptions,
  generateKeyWordOptions
} from '../server/core/poem';
import { PoemState, VoteRequest, SkinnyPoem } from '../shared/types/poem';

export type PoemMessage = 
  | { type: 'GET_POEM_STATE' }
  | { type: 'VOTE'; data: VoteRequest }
  | { type: 'GENERATE_POEM' }
  | { type: 'ADMIN_SIMULATE' }
  | { type: 'GET_DAILY_POEM'; date?: string };

export type PoemResponse = 
  | { type: 'POEM_STATE_RESPONSE'; data: PoemState }
  | { type: 'VOTE_RESPONSE'; success: boolean; message?: string; data?: PoemState }
  | { type: 'GENERATE_RESPONSE'; success: boolean; message?: string; poem?: SkinnyPoem }
  | { type: 'SIMULATE_RESPONSE'; success: boolean; message?: string; data?: PoemState }
  | { type: 'DAILY_POEM_RESPONSE'; success: boolean; poem?: SkinnyPoem; message?: string }
  | { type: 'ERROR'; message: string };

export const handlePoemMessage = async (
  message: PoemMessage, 
  context: Context
): Promise<PoemResponse> => {
  const { redis, userId } = context;

  try {
    switch (message.type) {
      case 'GET_POEM_STATE': {
        const state = await getPoemState(redis);
        return { type: 'POEM_STATE_RESPONSE', data: state };
      }

      case 'VOTE': {
        const { type, optionId, moodValues } = message.data;
        
        if (!userId) {
          return { type: 'ERROR', message: 'Must be logged in to vote' };
        }

        const state = await getPoemState(redis);
        
        // Check if voting is allowed for current phase
        if ((type === 'keyline' && state.phase !== 'keyline') ||
            (type === 'keyword' && state.phase !== 'keyword') ||
            (type === 'mood' && state.phase !== 'mood')) {
          return { type: 'ERROR', message: 'Voting not allowed for this phase' };
        }

        // Check if user already voted today
        const voteKey = `vote:${getCurrentDay()}:${userId}:${type}`;
        const hasVoted = await redis.get(voteKey);
        
        if (hasVoted) {
          return { type: 'ERROR', message: 'You have already voted for this phase today' };
        }

        // Process vote
        if (type === 'keyline' && optionId) {
          const option = state.keyLineOptions.find(opt => opt.id === optionId);
          if (option) {
            option.votes++;
            await redis.set(voteKey, optionId, { ex: 86400 });
          }
        } else if (type === 'keyword' && optionId) {
          const option = state.keyWordOptions.find(opt => opt.id === optionId);
          if (option) {
            option.votes++;
            await redis.set(voteKey, optionId, { ex: 86400 });
          }
        } else if (type === 'mood' && moodValues) {
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
        return { type: 'VOTE_RESPONSE', success: true, message: 'Vote submitted successfully!', data: state };
      }

      case 'GENERATE_POEM': {
        const state = await getPoemState(redis);
        
        if (state.phase !== 'generation') {
          return { type: 'ERROR', message: 'Not in generation phase' };
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
          return { type: 'ERROR', message: 'Missing key line or key word' };
        }

        // Generate mood values
        const moodValues: Record<string, number> = {};
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
        return { type: 'GENERATE_RESPONSE', success: true, poem };
      }

      case 'ADMIN_SIMULATE': {
        if (!userId) {
          return { type: 'ERROR', message: 'Must be logged in' };
        }

        // Note: In production, check if user is admin/moderator here
        const state = await getPoemState(redis);

        switch (state.phase) {
          case 'keyline':
            const winningKeyLine = state.keyLineOptions.reduce((prev, current) => 
              prev.votes > current.votes ? prev : current
            );
            state.selectedKeyLine = (winningKeyLine && winningKeyLine.text) || (state.keyLineOptions[0] && state.keyLineOptions[0].text);
            state.keyWordOptions = generateKeyWordOptions(state.selectedKeyLine);
            state.phase = 'keyword';
            break;

          case 'keyword':
            const winningKeyWord = state.keyWordOptions.reduce((prev, current) => 
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

        await savePoemState(redis, state);
        return { type: 'SIMULATE_RESPONSE', success: true, message: 'Phase simulated successfully!', data: state };
      }

      case 'GET_DAILY_POEM': {
        const date = message.date || getCurrentDay();
        const poem = await getDailyPoem(redis, date);
        
        if (!poem) {
          return { type: 'DAILY_POEM_RESPONSE', success: false, message: 'No poem found for this date' };
        }

        return { type: 'DAILY_POEM_RESPONSE', success: true, poem };
      }

      default:
        return { type: 'ERROR', message: 'Unknown message type' };
    }
  } catch (error) {
    console.error('Error handling poem message:', error);
    return { type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};