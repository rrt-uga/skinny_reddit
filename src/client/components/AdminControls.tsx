import React, { useState } from 'react';
import { PoemPhase } from '../../shared/types/poem';

interface AdminControlsProps {
  currentPhase: PoemPhase;
  onSimulate: () => void;
  onGenerate: () => void;
}

export const AdminControls: React.FC<AdminControlsProps> = ({ 
  currentPhase, 
  onSimulate, 
  onGenerate 
}) => {
  const [showControls, setShowControls] = useState(false);

  const getSimulateButtonText = () => {
    switch (currentPhase) {
      case 'keyline': return 'Skip to Keyword Voting';
      case 'keyword': return 'Skip to Mood Setting';
      case 'mood': return 'Skip to Generation';
      case 'generation': return 'Generate Poem Now';
      default: return 'No Action Available';
    }
  };

  const canSimulate = ['keyline', 'keyword', 'mood'].includes(currentPhase);
  const canGenerate = currentPhase === 'generation';

  if (!canSimulate && !canGenerate) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-gray-600 pt-6">
      <div className="text-center">
        <button
          onClick={() => setShowControls(!showControls)}
          className="text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          {showControls ? 'Hide' : 'Show'} Admin Controls
        </button>
        
        {showControls && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold mb-4 text-yellow-300">
              Admin Controls
            </h4>
            <p className="text-sm text-gray-300 mb-4">
              These controls allow moderators to simulate phase completion for testing purposes.
            </p>
            
            <div className="space-y-3">
              {canSimulate && (
                <button
                  onClick={onSimulate}
                  className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                >
                  {getSimulateButtonText()}
                </button>
              )}
              
              {canGenerate && (
                <button
                  onClick={onGenerate}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ml-2"
                >
                  Force Generate Poem
                </button>
              )}
            </div>
            
            <p className="text-xs text-gray-400 mt-3">
              Note: In production, these controls would be restricted to subreddit moderators.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};