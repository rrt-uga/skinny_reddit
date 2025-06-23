import React, { useState } from 'react';
import { MoodVariable } from '../../shared/types/poem';

interface MoodVotingProps {
  moodVariables: Record<string, MoodVariable>;
  onVote: (moodValues: Record<string, number>) => void;
}

export const MoodVoting: React.FC<MoodVotingProps> = ({ moodVariables, onVote }) => {
  const [localValues, setLocalValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    Object.keys(moodVariables).forEach(key => {
      initial[key] = Math.round(moodVariables[key].value);
    });
    return initial;
  });

  const handleSliderChange = (moodName: string, value: number) => {
    setLocalValues(prev => ({
      ...prev,
      [moodName]: value
    }));
  };

  const handleSubmit = () => {
    onVote(localValues);
  };

  const getMoodColor = (value: number) => {
    if (value <= 3) return 'from-blue-500 to-cyan-500';
    if (value <= 7) return 'from-green-500 to-yellow-500';
    return 'from-orange-500 to-red-500';
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">Set the Mood</h3>
        <p className="text-gray-300 text-sm">
          Adjust each mood variable from 1-10 to influence the poem's emotional tone
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(moodVariables).map(([moodName, variable]) => {
          const currentValue = localValues[moodName];
          const averageValue = variable.value;
          
          return (
            <div key={moodName} className="bg-gray-800 rounded-lg p-4 border border-gray-600">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-medium capitalize text-purple-300">
                  {moodName}
                </h4>
                <div className="text-right">
                  <div className="text-white font-bold">{currentValue}</div>
                  <div className="text-xs text-gray-400">
                    {getMoodDescription(moodName, currentValue)}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={currentValue}
                  onChange={(e) => handleSliderChange(moodName, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, 
                      rgb(59, 130, 246) 0%, 
                      rgb(16, 185, 129) 50%, 
                      rgb(239, 68, 68) 100%)`
                  }}
                />
              </div>

              {variable.votes > 0 && (
                <div className="text-xs text-gray-400">
                  Community average: {averageValue.toFixed(1)} ({variable.votes} votes)
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={handleSubmit}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105"
        >
          Submit Mood Settings
        </button>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};