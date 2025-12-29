import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useApp } from '../../context/AppContext';
import { getImprovedResume } from '../../services/api';

interface ResumePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResumePanel({ isOpen, onClose }: ResumePanelProps) {
  const { state } = useApp();
  const [resumeMarkdown, setResumeMarkdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch resume from API if not in global state
  useEffect(() => {
    if (isOpen && !resumeMarkdown) {
      // First check global state
      if (state.setup.improvedResumeMarkdown) {
        setResumeMarkdown(state.setup.improvedResumeMarkdown);
        return;
      }

      // Otherwise fetch from API
      if (state.sessionId) {
        setIsLoading(true);
        setError(null);
        getImprovedResume(state.sessionId)
          .then((response) => {
            if (response.success && response.improvedResumeMarkdown) {
              setResumeMarkdown(response.improvedResumeMarkdown);
            } else {
              setError('No improved resume found. Generate one in the Setup Wizard first.');
            }
          })
          .catch((err) => {
            console.error('Failed to fetch improved resume:', err);
            setError('Failed to load resume. Please try again.');
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, [isOpen, state.sessionId, state.setup.improvedResumeMarkdown, resumeMarkdown]);

  // Update local state when global state changes
  useEffect(() => {
    if (state.setup.improvedResumeMarkdown) {
      setResumeMarkdown(state.setup.improvedResumeMarkdown);
    }
  }, [state.setup.improvedResumeMarkdown]);

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
            <DocumentTextIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">My Resume</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close resume panel"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p>Loading your resume...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <DocumentTextIcon className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">{error}</p>
            </div>
          ) : resumeMarkdown ? (
            <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-xl prose-h1:font-bold prose-h1:mb-3 prose-h2:text-base prose-h2:font-semibold prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-1 prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2 prose-p:text-gray-700 prose-p:my-2 prose-p:text-sm prose-strong:text-gray-900 prose-ul:my-2 prose-li:my-1 prose-li:text-sm">
              <ReactMarkdown>{resumeMarkdown}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <DocumentTextIcon className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">No resume available</p>
              <p className="text-sm text-gray-400 mt-1">Generate an improved resume in the Setup Wizard</p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            💡 Reference your resume while answering interview questions
          </p>
        </div>
      </div>
    </>
  );
}
