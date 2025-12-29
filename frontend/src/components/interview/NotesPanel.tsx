import { XMarkIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { useApp } from '../../context/AppContext';

interface NotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

import { StarStoryCard } from '../common/StarStoryCard';

export function NotesPanel({ isOpen, onClose }: NotesPanelProps) {
  const { state } = useApp();
  
  const resumeData = state.setup.resumeParsedData;
  const talkingPoints = resumeData?.talkingPoints;
  const starStories = resumeData?.starStories || [];

  if (!isOpen) return null;

  const hasContent = talkingPoints?.elevatorPitch || starStories.length > 0;

  return (
    <>
      {/* Mobile: Full-screen modal overlay */}
      <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div
        className={`
          fixed z-50 bg-white shadow-xl
          
          /* Mobile: Full-screen modal */
          inset-0 
          
          /* Desktop: Fixed right side panel */
          lg:inset-y-0 lg:right-0 lg:left-auto
          lg:w-[400px] lg:border-l lg:border-gray-200
          lg:top-16
          
          flex flex-col
          transition-transform duration-300
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <LightBulbIcon className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Interview Notes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close notes panel"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {hasContent ? (
            <>
              {/* Elevator Pitch Section */}
              {talkingPoints?.elevatorPitch && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Elevator Pitch</h3>
                  </div>
                  <p className="text-gray-700 text-sm italic leading-relaxed">
                    "{talkingPoints.elevatorPitch}"
                  </p>
                  
                  {/* Key Strengths */}
                  {talkingPoints.keyStrengths && talkingPoints.keyStrengths.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                        Key Strengths
                      </p>
                      <div className="space-y-2">
                        {talkingPoints.keyStrengths.map((strength, i) => (
                          <div
                            key={i}
                            className="pl-3 py-2 bg-white/70 text-gray-700 text-sm rounded-lg border-l-3 border-indigo-300 leading-relaxed"
                          >
                            {strength}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STAR Stories Section */}
              {starStories.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-gray-900">
                      Prepared STAR Stories ({starStories.length})
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Tap to expand each story. Use these for behavioral questions.
                  </p>
                  <div className="space-y-2">
                    {starStories.map((story, index) => (
                      <StarStoryCard key={index} story={story} />
                    ))}
                  </div>
                </div>
              )}

              {/* Unique Value Proposition */}
              {talkingPoints?.uniqueValue && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                    Your Unique Value
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{talkingPoints.uniqueValue}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <LightBulbIcon className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">No interview notes available</p>
              <p className="text-sm text-gray-400 mt-1">
                Upload a resume to generate STAR stories and elevator pitch
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            💡 Use your elevator pitch for "Tell me about yourself"
          </p>
        </div>
      </div>
    </>
  );
}
