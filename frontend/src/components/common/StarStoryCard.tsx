import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { StarStory } from '../../types';

export function StarStoryCard({ story }: { story: StarStory }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="font-medium text-gray-900 text-sm">{story.theme}</span>
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="p-3 space-y-3 text-sm">
          <div>
            <span className="font-semibold text-indigo-600">Situation:</span>
            <p className="text-gray-700 mt-1">{story.situation}</p>
          </div>
          <div>
            <span className="font-semibold text-indigo-600">Task:</span>
            <p className="text-gray-700 mt-1">{story.task}</p>
          </div>
          <div>
            <span className="font-semibold text-indigo-600">Action:</span>
            <p className="text-gray-700 mt-1">{story.action}</p>
          </div>
          <div>
            <span className="font-semibold text-indigo-600">Result:</span>
            <p className="text-gray-700 mt-1">{story.result}</p>
          </div>
          {story.metrics && story.metrics.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {story.metrics.map((metric, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full"
                >
                  {metric}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
