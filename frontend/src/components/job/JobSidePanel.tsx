import { useState, useEffect } from 'react';
import { JobMatch, CompanyIntel } from '../../types';
import { useApp } from '../../context/AppContext';
import { CoverLetterTab } from './CoverLetterTab';
import { ApplicationTipsTab } from './ApplicationTipsTab';
import { CompanyIntelPanel } from '../company';
import { ResumeTabContent, NotesTabContent } from '../tools';
import {
  XMarkIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  LightBulbIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

export type JobSidePanelTab = 'resume' | 'cover-letter' | 'notes' | 'tips' | 'intel';

interface JobSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: JobSidePanelTab;
  onTabChange: (tab: JobSidePanelTab) => void;
  job: JobMatch;
  onJobUpdate: (updates: Partial<JobMatch>) => void;
}

export function JobSidePanel({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  job,
  onJobUpdate,
}: JobSidePanelProps) {
  const { state } = useApp();
  const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(null);

  // Load company intel from job data (job-specific) when job changes
  useEffect(() => {
    if (isOpen) {
      // If job is saved and has company_intel, use it
      if (job.saved && job.companyIntel) {
        console.log('[JobSidePanel] Loading company intel from saved job data');
        setCompanyIntel(job.companyIntel);
      } else {
        // Reset intel when viewing a different job without saved intel
        setCompanyIntel(null);
      }
    }
  }, [isOpen, job.job.jobId, job.saved, job.companyIntel]);

  // Check if resume has notes (STAR stories, talking points)
  const resumeData = state.setup.resumeParsedData;
  const hasNotes = !!(resumeData?.talkingPoints?.elevatorPitch || (resumeData?.starStories && resumeData.starStories.length > 0));

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay - only on mobile when panel covers full width */}
      <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={onClose} />

      {/* Panel - responsive sizing
          - Mobile (<640px): Full width below app header (with overlay)
          - Tablet (>=640px): 320px sidebar (no overlay, can interact with main content)
          - Desktop (>=768px): 380px sidebar
          - Large (>=1024px): 440px sidebar
      */}
      <div
        className={`
          fixed z-50 bg-white shadow-xl flex flex-col
          transition-transform duration-300
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}

          top-16 bottom-0 right-0 left-0
          sm:left-auto sm:w-[320px] sm:border-l sm:border-gray-200
          md:w-[380px]
          lg:w-[440px]
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">Application Tools</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => onTabChange('resume')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'resume'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4" />
            Resume
          </button>
          <button
            onClick={() => onTabChange('cover-letter')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'cover-letter'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <EnvelopeIcon className="w-4 h-4" />
            Cover
            {job.coverLetter && (
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => onTabChange('notes')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'notes'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            Notes
            {hasNotes && (
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => onTabChange('tips')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'tips'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <LightBulbIcon className="w-4 h-4" />
            Tips
          </button>
          <button
            onClick={() => onTabChange('intel')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'intel'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <BuildingOffice2Icon className="w-4 h-4" />
            Intel
            {companyIntel && (
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Resume Tab */}
          {activeTab === 'resume' && (
            <ResumeTabContent jobTitle={job.job.title} />
          )}

          {/* Cover Letter Tab */}
          {activeTab === 'cover-letter' && (
            <CoverLetterTab
              job={job}
              resumeMarkdown={state.setup.improvedResumeMarkdown || null}
              onJobUpdate={onJobUpdate}
            />
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <NotesTabContent />
          )}

          {/* Tips Tab */}
          {activeTab === 'tips' && (
            <ApplicationTipsTab job={job} />
          )}

          {/* Intel Tab */}
          {activeTab === 'intel' && (
            <div className="p-4">
              <CompanyIntelPanel
                companyName={job.job.company}
                targetRole={job.job.title}
                intel={companyIntel}
                onIntelGenerated={(intel) => {
                  setCompanyIntel(intel);
                  // Also update the job object if we want to persist locally
                  onJobUpdate({ companyIntel: intel });
                }}
                jobId={job.job.jobId}
                isJobSaved={job.saved}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
