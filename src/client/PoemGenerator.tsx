import React, { useState, useEffect, useCallback } from 'react';
import { PoemState, VoteRequest, SkinnyPoem, WebviewMessage, WebviewResponse } from '../shared/types/poem';
import { VotingPhase } from './components/VotingPhase';
import { MoodVoting } from './components/MoodVoting';
import { PoemDisplay } from './components/PoemDisplay';
import { AdminControls } from './components/AdminControls';
import packageJson from '../../package.json';

function extractSubredditName(): string | null {
  const devCommand = packageJson.scripts && packageJson.scripts['dev:devvit'];
  if (!devCommand || !devCommand.includes('devvit playtest')) return null;
  
  const argsMatch = devCommand.match(/devvit\s+playtest\s+(.*)/);
  if (!argsMatch || !argsMatch[1]) return null;
  
  const args = argsMatch[1].trim().split(/\s+/);
  const subreddit = args.find((arg) => !arg.startsWith('-'));
  return subreddit || null;
}

const Banner = () => {
  const subreddit = extractSubredditName();
  if (!subreddit) {
    return (
      <div className="w-full bg-purple-600 text-white p-4 text-center mb-4">
        Please visit your playtest subreddit to participate in poem creation.
      </div>
    );
  }

  const subredditUrl = `https://www.reddit.com/r/${subreddit}`;
  return (
    <div className="w-full bg-purple-600 text-white p-4 text-center mb-4">
      Please visit{' '}
      <a href={subredditUrl} target="_blank" rel="noopener noreferrer" className="underline font-bold">
        r/{subreddit}
      </a>{' '}
      to participate in collaborative poem creation. Create a post from the three dots menu.
    </div>
  );
};

const PhaseTimer: React.FC<{ endTime: number }> = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diff = endTime - now;
      
      if (diff <= 0) {
        setTimeLeft('Phase ended');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className="text-center text-sm text-gray-400 mb-4">
      Time remaining: {timeLeft}
    </div>
  );
};

export const PoemGenerator: React.FC = () => {
  const [poemState, setPoemState] = useState<PoemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showBanner, setShowBanner] = useState(false);
  const [isWebviewMode, setIsWebviewMode] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isDevvitWebview = hostname.endsWith('devvit.net') || window.parent !== window;
    setIsWebviewMode(isDevvitWebview);
    setShowBanner(!isDevvitWebview);
  }, []);

  const showMessage = useCallback((msg: string, time = 3000) => {
    setMessage(msg);
    if (time > 0) {
      setTimeout(() => setMessage(''), time);
    }
  }, []);

  // Webview message handling
  const sendWebviewMessage = useCallback((message: WebviewMessage): Promise<WebviewResponse> => {
    return new Promise((resolve, reject) => {
      if (!isWebviewMode || !window.parent) {
        reject(new Error('Not in webview mode'));
        return;
      }

      const messageId = Math.random().toString(36).substr(2, 9);
      const messageWithId = { ...message, messageId };

      const handleResponse = (event: MessageEvent) => {
        if (event.data && event.data.messageId === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(event.data as WebviewResponse);
        }
      };

      window.addEventListener('message', handleResponse);
      window.parent.postMessage(messageWithId, '*');

      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error('Webview message timeout'));
      }, 10000);
    });
  }, [isWebviewMode]);

  // Fallback for development mode
  const createMockPoemState = (): PoemState => {
    const now = new Date();
    const hour = now.getHours();
    
    let phase: 'keyline' | 'keyword' | 'mood' | 'generation' | 'published' = 'keyline';
    if (hour >= 12 && hour < 16) phase = 'keyword';
    else if (hour >= 16 && hour < 20) phase = 'mood';
    else if (hour >= 20 && hour < 21) phase = 'generation';
    else if (hour >= 21) phase = 'published';

    const mockKeyLineOptions = [
      { id: 'keyline_0', text: 'In the silence between heartbeats,', votes: 3 },
      { id: 'keyline_1', text: 'Where shadows dance with light—', votes: 7 },
      { id: 'keyline_2', text: 'Through the whispers of time:', votes: 2 },
      { id: 'keyline_3', text: 'Beyond the edge of dreams;', votes: 5 },
      { id: 'keyline_4', text: 'In the space where words fail,', votes: 1 }
    ];

    const mockKeyWordOptions = [
      { id: 'keyword_0', text: 'shadow', votes: 4 },
      { id: 'keyword_1', text: 'light', votes: 8 },
      { id: 'keyword_2', text: 'whisper', votes: 3 },
      { id: 'keyword_3', text: 'dance', votes: 6 },
      { id: 'keyword_4', text: 'silence', votes: 2 }
    ];

    const mockMoodVariables = {
      melancholy: { name: 'melancholy', value: 6.2, votes: 5 },
      joy: { name: 'joy', value: 4.8, votes: 3 },
      mystery: { name: 'mystery', value: 7.5, votes: 8 },
      passion: { name: 'passion', value: 5.1, votes: 4 },
      serenity: { name: 'serenity', value: 8.2, votes: 6 },
      rebellion: { name: 'rebellion', value: 3.4, votes: 2 },
      nostalgia: { name: 'nostalgia', value: 6.8, votes: 7 },
      hope: { name: 'hope', value: 7.1, votes: 5 },
      darkness: { name: 'darkness', value: 4.5, votes: 3 },
      whimsy: { name: 'whimsy', value: 5.9, votes: 4 }
    };

    const today = new Date();
    const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    let phaseEndTime: number;
    switch (phase) {
      case 'keyline': phaseEndTime = endTime.getTime() + 12 * 60 * 60 * 1000; break;
      case 'keyword': phaseEndTime = endTime.getTime() + 16 * 60 * 60 * 1000; break;
      case 'mood': phaseEndTime = endTime.getTime() + 20 * 60 * 60 * 1000; break;
      case 'generation': phaseEndTime = endTime.getTime() + 21 * 60 * 60 * 1000; break;
      default: phaseEndTime = endTime.getTime() + 24 * 60 * 60 * 1000;
    }

    return {
      phase,
      currentDay: now.toISOString().split('T')[0],
      keyLineOptions: mockKeyLineOptions,
      keyWordOptions: phase === 'keyline' ? [] : mockKeyWordOptions,
      selectedKeyLine: phase !== 'keyline' ? 'Where shadows dance with light—' : undefined,
      selectedKeyWord: ['mood', 'generation', 'published'].includes(phase) ? 'light' : undefined,
      moodVariables: mockMoodVariables,
      phaseEndTime,
      generatedPoem: phase === 'published' ? {
        keyLine: 'Where shadows dance with light—',
        keyWord: 'light,',
        line3: 'whisper',
        line4: 'through;',
        line5: 'memory,',
        line7: 'beneath',
        line8: 'gentle—',
        line10: 'eternal',
        mood: { melancholy: 6.2, joy: 4.8, mystery: 7.5, passion: 5.1, serenity: 8.2, rebellion: 3.4, nostalgia: 6.8, hope: 7.1, darkness: 4.5, whimsy: 5.9 },
        createdAt: new Date().toISOString()
      } : undefined
    };
  };

  // Main fetch function
  const fetchPoemState = useCallback(async () => {
    if (isWebviewMode) {
      try {
        const response = await sendWebviewMessage({ type: 'GET_POEM_STATE' });
        if (response.type === 'POEM_STATE_RESPONSE') {
          setPoemState(response.data);
        } else if (response.type === 'ERROR') {
          showMessage(response.message);
          // Fallback to mock data
          setPoemState(createMockPoemState());
        }
      } catch (error) {
        console.error('Webview error, using mock data:', error);
        setPoemState(createMockPoemState());
      } finally {
        setLoading(false);
      }
    } else {
      // Development mode - use mock data
      setPoemState(createMockPoemState());
      setLoading(false);
    }
  }, [isWebviewMode, sendWebviewMessage, showMessage]);

  const handleVote = async (voteData: VoteRequest) => {
    if (isWebviewMode) {
      try {
        const response = await sendWebviewMessage({ type: 'VOTE', data: voteData });
        if (response.type === 'VOTE_RESPONSE' && response.success) {
          if (response.data) setPoemState(response.data);
          showMessage(response.message || 'Vote submitted successfully!');
        } else if (response.type === 'ERROR') {
          showMessage(response.message);
        }
      } catch (error) {
        console.error('Webview vote error:', error);
        showMessage('Error submitting vote via webview');
      }
    } else {
      // Development mode - simulate vote
      showMessage('Vote submitted (development mode)');
    }
  };

  const handleGenerate = async () => {
    if (isWebviewMode) {
      try {
        const response = await sendWebviewMessage({ type: 'GENERATE_POEM' });
        if (response.type === 'GENERATE_RESPONSE' && response.success) {
          showMessage('Poem generated successfully!');
          await fetchPoemState();
        } else if (response.type === 'ERROR') {
          showMessage(response.message);
        }
      } catch (error) {
        console.error('Webview generate error:', error);
        showMessage('Error generating poem via webview');
      }
    } else {
      // Development mode - simulate generation
      showMessage('Poem generated (development mode)');
      const newState = createMockPoemState();
      newState.phase = 'published';
      setPoemState(newState);
    }
  };

  const handleAdminSimulate = async () => {
    if (isWebviewMode) {
      try {
        const response = await sendWebviewMessage({ type: 'ADMIN_SIMULATE' });
        if (response.type === 'SIMULATE_RESPONSE' && response.success) {
          if (response.data) setPoemState(response.data);
          showMessage(response.message || 'Phase simulated successfully!');
        } else if (response.type === 'ERROR') {
          showMessage(response.message);
        }
      } catch (error) {
        console.error('Webview simulate error:', error);
        showMessage('Error simulating phase via webview');
      }
    } else {
      // Development mode - simulate phase change
      if (poemState) {
        const newState = { ...poemState };
        switch (newState.phase) {
          case 'keyline':
            newState.phase = 'keyword';
            newState.selectedKeyLine = 'Where shadows dance with light—';
            break;
          case 'keyword':
            newState.phase = 'mood';
            newState.selectedKeyWord = 'light';
            break;
          case 'mood':
            newState.phase = 'generation';
            break;
          default:
            break;
        }
        setPoemState(newState);
        showMessage('Phase simulated (development mode)');
      }
    }
  };

  useEffect(() => {
    fetchPoemState();
    
    // Refresh state every 30 seconds
    const interval = setInterval(fetchPoemState, 30000);
    return () => clearInterval(interval);
  }, [fetchPoemState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading poem generator...</div>
      </div>
    );
  }

  if (!poemState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Failed to load poem state</div>
      </div>
    );
  }

  const getPhaseTitle = (phase: string) => {
    switch (phase) {
      case 'keyline': return 'Vote for Key Line';
      case 'keyword': return 'Vote for Key Word';
      case 'mood': return 'Set the Mood';
      case 'generation': return 'Poem Generation';
      case 'published': return "Today's Poem";
      default: return 'Skinny Poem Generator';
    }
  };

  const getPhaseDescription = (phase: string) => {
    switch (phase) {
      case 'keyline': return 'Choose the opening and closing line for today\'s poem (8AM-12PM)';
      case 'keyword': return 'Select the key word that will appear in lines 2, 6, and 9 (12PM-4PM)';
      case 'mood': return 'Adjust the mood variables to influence the poem\'s tone (4PM-8PM)';
      case 'generation': return 'The poem is being generated based on your votes (8PM-9PM)';
      case 'published': return 'Today\'s collaborative poem is complete!';
      default: return 'Collaborative poetry creation';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {showBanner && <Banner />}
      
      {message && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-6 py-3 rounded-lg z-50">
          {message}
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Skinny Poem Generator
          </h1>
          <p className="text-lg text-gray-300 mb-4">
            {getPhaseDescription(poemState.phase)}
          </p>
          <PhaseTimer endTime={poemState.phaseEndTime} />
          {isWebviewMode && (
            <div className="text-xs text-green-400 mb-2">
              ✓ Running in Devvit webview mode
            </div>
          )}
          {!isWebviewMode && (
            <div className="text-xs text-yellow-400 mb-2">
              ⚠ Development mode - using mock data
            </div>
          )}
        </header>

        <div className="bg-black bg-opacity-30 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            {getPhaseTitle(poemState.phase)}
          </h2>

          {poemState.phase === 'keyline' && (
            <VotingPhase
              options={poemState.keyLineOptions}
              onVote={(optionId) => handleVote({ type: 'keyline', optionId })}
              title="Choose the Key Line"
              description="This line will be both the first and last line of the poem"
            />
          )}

          {poemState.phase === 'keyword' && (
            <VotingPhase
              options={poemState.keyWordOptions}
              onVote={(optionId) => handleVote({ type: 'keyword', optionId })}
              title="Choose the Key Word"
              description="This word will appear in lines 2, 6, and 9"
            />
          )}

          {poemState.phase === 'mood' && (
            <MoodVoting
              moodVariables={poemState.moodVariables}
              onVote={(moodValues) => handleVote({ type: 'mood', moodValues })}
            />
          )}

          {poemState.phase === 'generation' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
                <p className="text-lg">Generating today's poem...</p>
                <p className="text-sm text-gray-400 mt-2">
                  Based on: "{poemState.selectedKeyLine}" with key word "{poemState.selectedKeyWord}"
                </p>
              </div>
              <button
                onClick={handleGenerate}
                className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Generate Poem Now
              </button>
            </div>
          )}

          {poemState.phase === 'published' && poemState.generatedPoem && (
            <PoemDisplay poem={poemState.generatedPoem} />
          )}
        </div>

        <AdminControls
          currentPhase={poemState.phase}
          onSimulate={handleAdminSimulate}
          onGenerate={handleGenerate}
        />
      </div>
    </div>
  );
};