import { XMarkIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { InterviewTipsContent } from '../guide';

interface TipsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TipsPanel({ isOpen, onClose }: TipsPanelProps) {
  if (!isOpen) return null;

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
            <QuestionMarkCircleIcon className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Interview Tips</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close tips panel"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <InterviewTipsContent compact />
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            💡 Review these tips before starting your interview
          </p>
        </div>
      </div>
    </>
  );
}
