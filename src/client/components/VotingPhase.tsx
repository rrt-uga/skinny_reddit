import React from 'react';
import { VotingOption } from '../../shared/types/poem';

interface VotingPhaseProps {
  options: VotingOption[];
  onVote: (optionId: string) => void;
  title: string;
  description: string;
}

export const VotingPhase: React.FC<VotingPhaseProps> = ({ 
  options, 
  onVote, 
  title, 
  description 
}) => {
  const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-300 text-sm">{description}</p>
        {totalVotes > 0 && (
          <p className="text-purple-300 text-sm mt-2">
            Total votes: {totalVotes}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {options.map((option) => {
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
          
          return (
            <div key={option.id} className="relative">
              <button
                onClick={() => onVote(option.id)}
                className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600 hover:border-purple-400 group"
              >
                <div className="flex justify-between items-center">
                  <span className="text-white group-hover:text-purple-300 transition-colors">
                    {option.text}
                  </span>
                  <span className="text-purple-300 font-semibold">
                    {option.votes} votes
                  </span>
                </div>
                
                {percentage > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};