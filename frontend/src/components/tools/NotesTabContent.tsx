/**
 * NotesTabContent - Reusable notes content for Application Tools panel
 *
 * Displays:
 * - Elevator Pitch
 * - Key Strengths
 * - STAR Stories (expandable cards)
 * - Unique Value Proposition
 */

import { LightBulbIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { useApp } from '../../context/AppContext';
import { StarStoryCard } from '../common/StarStoryCard';

export function NotesTabContent() {
  const { state } = useApp();

  const resumeData = state.setup.resumeParsedData;
  const talkingPoints = resumeData?.talkingPoints;
  const starStories = resumeData?.starStories || [];

  const hasContent = talkingPoints?.elevatorPitch || starStories.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <LightBulbIcon className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-500">No interview notes available</p>
        <p className="text-sm text-gray-400 mt-1">
          Upload a resume to generate STAR stories and elevator pitch
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
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

      {/* Footer hint */}
      <div className="text-center pt-2">
        <p className="text-xs text-gray-500">
          Use your elevator pitch for "Tell me about yourself"
        </p>
      </div>
    </div>
  );
}
