import React from 'react';
import { SkinnyPoem } from '../../shared/types/poem';

interface PoemDisplayProps {
  poem: SkinnyPoem;
}

export const PoemDisplay: React.FC<PoemDisplayProps> = ({ poem }) => {
  const formatPoemText = (poem: SkinnyPoem): string[] => {
    return [
      poem.keyLine,                    // Line 1
      poem.keyWord,                    // Line 2
      poem.line3,                      // Line 3
      poem.line4,                      // Line 4
      poem.line5,                      // Line 5
      poem.keyWord,                    // Line 6 (same as line 2)
      poem.line7,                      // Line 7
      poem.line8,                      // Line 8
      poem.keyWord,                    // Line 9 (same as line 2)
      poem.line10,                     // Line 10
      poem.keyLine.replace(/[,:;—-]$/, '') + '.' // Line 11 (same as line 1 but with period)
    ];
  };

  const poemLines = formatPoemText(poem);
  
  const getMoodIntensity = (mood: Record<string, number>) => {
    const total = Object.values(mood).reduce((sum, val) => sum + val, 0);
    return total / Object.keys(mood).length;
  };

  const getDominantMoods = (mood: Record<string, number>) => {
    return Object.entries(mood)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([name, value]) => ({ name, value }));
  };

  const moodIntensity = getMoodIntensity(poem.mood);
  const dominantMoods = getDominantMoods(poem.mood);

  const getBackgroundGradient = () => {
    if (moodIntensity <= 4) return 'from-blue-900 via-indigo-900 to-purple-900';
    if (moodIntensity <= 7) return 'from-purple-900 via-pink-900 to-red-900';
    return 'from-red-900 via-orange-900 to-yellow-900';
  };

  const downloadPoem = () => {
    const poemText = poemLines.join('\n');
    const moodText = dominantMoods.map(m => `${m.name}: ${m.value.toFixed(1)}`).join(', ');
    const fullText = `${poemText}\n\n--- Mood ---\n${moodText}\n\nGenerated: ${new Date(poem.createdAt).toLocaleDateString()}`;
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skinny-poem-${new Date(poem.createdAt).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sharePoem = async () => {
    const poemText = poemLines.join('\n');
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Skinny Poem',
          text: poemText,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(poemText);
        alert('Poem copied to clipboard!');
      } catch (error) {
        console.log('Error copying to clipboard:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Poem Display */}
      <div className={`bg-gradient-to-br ${getBackgroundGradient()} p-8 rounded-xl border border-gray-600 shadow-2xl`}>
        <div className="text-center space-y-3">
          {poemLines.map((line, index) => {
            const isKeyLine = index === 0 || index === 10;
            const isKeyWord = index === 1 || index === 5 || index === 8;
            
            return (
              <div
                key={index}
                className={`
                  ${isKeyLine ? 'text-xl font-bold text-yellow-200' : ''}
                  ${isKeyWord ? 'text-lg font-semibold text-purple-200' : ''}
                  ${!isKeyLine && !isKeyWord ? 'text-base text-gray-200' : ''}
                  transition-all duration-300 hover:scale-105
                `}
                style={{
                  animationDelay: `${index * 0.2}s`,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mood Visualization */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-600">
        <h4 className="text-lg font-semibold mb-4 text-center text-purple-300">
          Poem Mood Profile
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dominantMoods.map((mood, index) => (
            <div key={mood.name} className="text-center">
              <div className="text-sm text-gray-400 mb-1 capitalize">
                {mood.name}
              </div>
              <div className="text-2xl font-bold text-white">
                {mood.value.toFixed(1)}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all duration-1000 ${
                    index === 0 ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                    index === 1 ? 'bg-gradient-to-r from-blue-500 to-purple-500' :
                    'bg-gradient-to-r from-green-500 to-blue-500'
                  }`}
                  style={{ 
                    width: `${(mood.value / 10) * 100}%`,
                    animationDelay: `${index * 0.3}s`
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={downloadPoem}
          className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Poem
        </button>
        
        <button
          onClick={sharePoem}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Share Poem
        </button>
      </div>

      <div className="text-center text-sm text-gray-400">
        Created: {new Date(poem.createdAt).toLocaleDateString()} at {new Date(poem.createdAt).toLocaleTimeString()}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};