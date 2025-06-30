import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

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
const MOOD_VARIABLES = [
  'melancholy', 'joy', 'mystery', 'passion', 'serenity', 
  'rebellion', 'nostalgia', 'hope', 'darkness', 'whimsy'
];

// Webview communication helper
let messageId = 0;
const pendingMessages = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>();

const sendMessage = (message: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const id = `msg_${++messageId}`;
    message.messageId = id;
    pendingMessages.set(id, { resolve, reject });
    
    console.log('Client: Sending message to Devvit:', JSON.stringify(message, null, 2));
    window.parent?.postMessage(message, '*');
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error('Message timeout'));
      }
    }, 10000);
  });
};

// Listen for responses from Devvit
window.addEventListener('message', (event) => {
  console.log('Client: Received message from Devvit:', JSON.stringify(event.data, null, 2));
  
  const { messageId: responseId, ...data } = event.data;
  if (responseId && pendingMessages.has(responseId)) {
    const { resolve } = pendingMessages.get(responseId)!;
    pendingMessages.delete(responseId);
    resolve(data);
  }
});

// Main App Component
const App: React.FC = () => {
  const [poemState, setPoemState] = useState<PoemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [localMoodValues, setLocalMoodValues] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  console.log('Client: App component rendered');

  // Load poem state on mount
  useEffect(() => {
    const loadPoemState = async () => {
      try {
        console.log('Client: Loading poem state');
        const response = await sendMessage({ type: 'GET_POEM_STATE' });
        
        if (response.type === 'ERROR') {
          throw new Error(response.message);
        }
        
        console.log('Client: Poem state loaded:', JSON.stringify(response.data, null, 2));
        setPoemState(response.data);
        
        // Initialize local mood values when state loads
        if (response.data.phase === 'mood') {
          console.log('Client: Initializing local mood values for mood phase');
          const initialMoodValues: Record<string, number> = {};
          MOOD_VARIABLES.forEach(name => {
            initialMoodValues[name] = Math.round(response.data.moodVariables[name]?.value || 5);
          });
          console.log('Client: Initial mood values:', JSON.stringify(initialMoodValues, null, 2));
          setLocalMoodValues(initialMoodValues);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Client: Error loading poem state:', error);
        setError(error instanceof Error ? error.message : 'Failed to load poem state');
        setLoading(false);
      }
    };

    loadPoemState();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        console.log('Client: Auto-refreshing poem state');
        const response = await sendMessage({ type: 'GET_POEM_STATE' });
        
        if (response.type !== 'ERROR') {
          console.log('Client: Auto-refresh - new state:', JSON.stringify(response.data, null, 2));
          setPoemState(response.data);
          
          // Update local mood values if we're in mood phase and haven't voted yet
          if (response.data.phase === 'mood' && !userVotes.mood) {
            console.log('Client: Auto-refresh - updating local mood values');
            const initialMoodValues: Record<string, number> = {};
            MOOD_VARIABLES.forEach(name => {
              initialMoodValues[name] = Math.round(response.data.moodVariables[name]?.value || 5);
            });
            setLocalMoodValues(initialMoodValues);
          }
        }
      } catch (error) {
        console.error('Client: Error during auto-refresh:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userVotes.mood]);

  const handleVote = async (voteType: string, optionId?: string, moodValues?: Record<string, number>) => {
    try {
      console.log('Client: Submitting vote:', voteType, 'optionId:', optionId, 'moodValues:', JSON.stringify(moodValues, null, 2));
      
      const response = await sendMessage({
        type: 'VOTE',
        data: { type: voteType, optionId, moodValues }
      });
      
      if (response.type === 'ERROR') {
        throw new Error(response.message);
      }
      
      console.log('Client: Vote submitted successfully');
      setPoemState(response.data);
      
      // Update user votes
      const newUserVotes = { ...userVotes, [voteType]: optionId || 'voted' };
      console.log('Client: Updated user votes:', JSON.stringify(newUserVotes, null, 2));
      setUserVotes(newUserVotes);
      
      // Show success message
      alert(response.message || 'Vote submitted successfully!');
    } catch (error) {
      console.error('Client: Error submitting vote:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit vote');
    }
  };

  const handleGenerate = async () => {
    try {
      console.log('Client: Starting poem generation');
      const response = await sendMessage({ type: 'GENERATE_POEM' });
      
      if (response.type === 'ERROR') {
        throw new Error(response.message);
      }
      
      console.log('Client: Poem generation completed');
      // Refresh state to get the generated poem
      const stateResponse = await sendMessage({ type: 'GET_POEM_STATE' });
      if (stateResponse.type !== 'ERROR') {
        setPoemState(stateResponse.data);
      }
      
      alert('Poem generated successfully!');
    } catch (error) {
      console.error('Client: Error generating poem:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate poem');
    }
  };

  const handleAdminSimulate = async () => {
    try {
      console.log('Client: Starting admin simulation');
      const response = await sendMessage({ type: 'ADMIN_SIMULATE' });
      
      if (response.type === 'ERROR') {
        throw new Error(response.message);
      }
      
      console.log('Client: Admin simulation completed');
      setPoemState(response.data);
      
      alert(response.message || 'Phase simulated successfully!');
    } catch (error) {
      console.error('Client: Error in admin simulation:', error);
      alert(error instanceof Error ? error.message : 'Failed to simulate phase');
    }
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400 mb-4">Skinny Poem Generator</div>
          <div className="text-white">Loading poem generator...</div>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('Client: Rendering error state:', error);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400 mb-4">Error</div>
          <div className="text-white">{error}</div>
        </div>
      </div>
    );
  }

  if (!poemState) {
    console.log('Client: Rendering no state error');
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400 mb-4">Error</div>
          <div className="text-white">Failed to load poem state</div>
        </div>
      </div>
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
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-400 mb-2">
            Skinny Poem Generator
          </h1>
          <p className="text-lg text-gray-300 mb-2">
            {getPhaseDescription(poemState.phase)}
          </p>
          <p className="text-sm text-gray-500">
            {timeLeftText}
          </p>
        </div>

        {/* Admin Controls */}
        <div className="mb-6 text-center">
          <button
            onClick={handleAdminSimulate}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Admin: Simulate Phase Completion
          </button>
        </div>

        {/* Main Content */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-center mb-6">
            {getPhaseTitle(poemState.phase)}
          </h2>

          {/* Key Line Voting */}
          {poemState.phase === 'keyline' && (
            <div className="space-y-4">
              <p className="text-lg text-gray-300">
                Choose the opening and closing line:
              </p>
              {poemState.keyLineOptions.map((option) => (
                <div key={option.id} className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg">
                  <button
                    onClick={() => {
                      console.log('Client: Key line vote button pressed for option:', option.id);
                      handleVote('keyline', option.id);
                    }}
                    disabled={!!userVotes.keyline}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg"
                  >
                    Vote
                  </button>
                  <div className="flex-1">
                    <p className="text-white text-lg">
                      {option.text}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {option.votes} votes
                    </p>
                  </div>
                </div>
              ))}
              {userVotes.keyline && (
                <p className="text-green-400 text-sm">
                  ✓ You have voted in this phase
                </p>
              )}
            </div>
          )}

          {/* Key Word Voting */}
          {poemState.phase === 'keyword' && (
            <div className="space-y-4">
              <p className="text-lg text-gray-300">
                Choose the key word for lines 2, 6, and 9:
              </p>
              {poemState.keyWordOptions.map((option) => (
                <div key={option.id} className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg">
                  <button
                    onClick={() => {
                      console.log('Client: Key word vote button pressed for option:', option.id);
                      handleVote('keyword', option.id);
                    }}
                    disabled={!!userVotes.keyword}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg"
                  >
                    Vote
                  </button>
                  <div className="flex-1">
                    <p className="text-white text-lg">
                      {option.text}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {option.votes} votes
                    </p>
                  </div>
                </div>
              ))}
              {userVotes.keyword && (
                <p className="text-green-400 text-sm">
                  ✓ You have voted in this phase
                </p>
              )}
            </div>
          )}

          {/* Interactive Mood Setting */}
          {poemState.phase === 'mood' && (
            <div className="space-y-4">
              <p className="text-lg text-gray-300">
                Adjust mood variables (1-10 scale):
              </p>
              <p className="text-sm text-gray-400">
                Use + and - buttons to set your preferred mood levels
              </p>
              
              {MOOD_VARIABLES.map((moodName) => {
                const variable = poemState.moodVariables[moodName];
                const userValue = localMoodValues[moodName] || 5;
                
                return (
                  <div key={moodName} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-yellow-400 font-bold text-lg capitalize">
                        {moodName}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            console.log('Client: Mood decrease button pressed for', moodName);
                            updateMoodValue(moodName, -1);
                          }}
                          disabled={!!userVotes.mood || userValue <= 1}
                          className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 text-white w-8 h-8 rounded"
                        >
                          -
                        </button>
                        <span className="text-white font-bold text-xl w-8 text-center">
                          {userValue}
                        </span>
                        <button
                          onClick={() => {
                            console.log('Client: Mood increase button pressed for', moodName);
                            updateMoodValue(moodName, 1);
                          }}
                          disabled={!!userVotes.mood || userValue >= 10}
                          className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 text-white w-8 h-8 rounded"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">
                        {getMoodDescription(moodName, userValue)}
                      </span>
                      <span className="text-gray-500">
                        Community avg: {variable.value.toFixed(1)} ({variable.votes} votes)
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {!userVotes.mood && (
                <button
                  onClick={() => {
                    console.log('Client: Submit mood settings button pressed');
                    handleVote('mood', undefined, localMoodValues);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-lg font-bold"
                >
                  Submit Mood Settings
                </button>
              )}
              {userVotes.mood && (
                <p className="text-green-400 text-sm">
                  ✓ You have voted in this phase
                </p>
              )}
            </div>
          )}

          {/* Generation Phase */}
          {poemState.phase === 'generation' && (
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-300">
                Generating today's poem...
              </p>
              <p className="text-sm text-gray-400">
                Based on community votes
              </p>
              <button
                onClick={() => {
                  console.log('Client: Generate poem button pressed');
                  handleGenerate();
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-lg font-bold"
              >
                Generate Poem Now
              </button>
            </div>
          )}

          {/* Published Poem */}
          {poemState.phase === 'published' && poemState.generatedPoem && (
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-300 font-bold">
                Today's Collaborative Poem:
              </p>
              <div className="bg-gray-700 p-6 rounded-lg space-y-2 text-left max-w-2xl mx-auto">
                <p className="text-red-400 font-bold text-lg">
                  {poemState.generatedPoem.keyLine}
                </p>
                <p className="text-yellow-400 font-bold text-lg">
                  {poemState.generatedPoem.keyWord}
                </p>
                <p className="text-white text-lg">
                  {poemState.generatedPoem.line3}
                </p>
                <p className="text-white text-lg">
                  {poemState.generatedPoem.line4}
                </p>
                <p className="text-white text-lg">
                  {poemState.generatedPoem.line5}
                </p>
                <p className="text-yellow-400 font-bold text-lg">
                  {poemState.generatedPoem.keyWord}
                </p>
                <p className="text-white text-lg">
                  {poemState.generatedPoem.line7}
                </p>
                <p className="text-white text-lg">
                  {poemState.generatedPoem.line8}
                </p>
                <p className="text-yellow-400 font-bold text-lg">
                  {poemState.generatedPoem.keyWord}
                </p>
                <p className="text-white text-lg">
                  {poemState.generatedPoem.line10}
                </p>
                <p className="text-red-400 font-bold text-lg">
                  {poemState.generatedPoem.keyLine.replace(/[,:;—-]$/, '') + '.'}
                </p>
              </div>
              <p className="text-gray-400 text-sm">
                Created: {new Date(poemState.generatedPoem.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Initialize the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Root container not found');
}