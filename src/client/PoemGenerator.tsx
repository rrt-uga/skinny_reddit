import React, { useState, useEffect, useCallback } from 'react';
import { PoemState, VoteRequest, SkinnyPoem } from '../shared/types/poem';
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

  useEffect(() => {
    const hostname = window.location.hostname;
    setShowBanner(!hostname.endsWith('devvit.net'));
  }, []);

  const showMessage = useCallback((msg: string, time = 3000) => {
    setMessage(msg);
    if (time > 0) {
      setTimeout(() => setMessage(''), time);
    }
  }, []);

  const fetchPoemState = useCallback(async () => {
    try {
      // Add health check first
      const healthResponse = await fetch('/api/health');
      if (!healthResponse.ok) {
        throw new Error('Server not responding');
      }

      const response = await fetch('/api/poem/state');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setPoemState(result.currentState);
      } else {
        showMessage(result.message || 'Failed to load poem state');
      }
    } catch (error) {
      console.error('Error fetching poem state:', error);
      if (error instanceof Error) {
        showMessage(`Network error: ${error.message}`);
      } else {
        showMessage('Network error loading poem state');
      }
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  const handleVote = async (voteData: VoteRequest) => {
    try {
      const response = await fetch('/api/poem/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setPoemState(result.currentState);
        showMessage('Vote submitted successfully!');
      } else {
        showMessage(result.message || 'Failed to submit vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      if (error instanceof Error) {
        showMessage(`Error submitting vote: ${error.message}`);
      } else {
        showMessage('Network error submitting vote');
      }
    }
  };

  const handleGenerate = async () => {
    try {
      const response = await fetch('/api/poem/generate', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        showMessage('Poem generated successfully!');
        await fetchPoemState(); // Refresh state
      } else {
        showMessage(result.message || 'Failed to generate poem');
      }
    } catch (error) {
      console.error('Error generating poem:', error);
      if (error instanceof Error) {
        showMessage(`Error generating poem: ${error.message}`);
      } else {
        showMessage('Network error generating poem');
      }
    }
  };

  const handleAdminSimulate = async () => {
    try {
      const response = await fetch('/api/poem/admin/simulate', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setPoemState(result.newState);
        showMessage(result.message || 'Phase simulated successfully!');
      } else {
        showMessage(result.message || 'Failed to simulate phase');
      }
    } catch (error) {
      console.error('Error simulating phase:', error);
      if (error instanceof Error) {
        showMessage(`Error simulating phase: ${error.message}`);
      } else {
        showMessage('Network error simulating phase');
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