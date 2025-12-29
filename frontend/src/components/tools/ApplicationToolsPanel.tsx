/**
 * ApplicationToolsPanel - Unified 5-tab panel for application tools
 *
 * Used in: Job Details, Interview Room, Coaching Room
 *
 * Tabs:
 * - Resume: View/edit improved resume
 * - Cover: Generate cover letter (requires job context)
 * - Notes: Elevator pitch, key strengths, STAR stories
 * - Tips: Interview tips and best practices
 * - Intel: Company intel (requires job/company context)
 */

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import { useApp } from '../../context/AppContext';
import { ResumeTabContent } from './ResumeTabContent';
import { NotesTabContent } from './NotesTabContent';
import { TipsTabContent } from './TipsTabContent';
import { SessionCoverLetterContent } from './SessionCoverLetterContent';
import { CoverLetterTab } from '../job/CoverLetterTab';
import { CompanyIntelPanel } from '../company';
import { JobMatch, CompanyIntel } from '../../types';

export type ApplicationToolsTab = 'resume' | 'cover' | 'notes' | 'tips' | 'intel';

interface ApplicationToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Default tab to show when opening */
  defaultTab?: ApplicationToolsTab;
  /** Job context for Cover Letter and Intel tabs */
  job?: JobMatch;
  /** Callback when job is updated (cover letter saved) */
  onJobUpdate?: (updates: Partial<JobMatch>) => void;
  /** Company name for Intel tab (fallback when no job) */
  companyName?: string;
  /** Target role for Intel tab (fallback when no job) */
  targetRole?: string;
  /** Job title for resume print/download */
  jobTitle?: string;
  /** Panel width (default 440px) */
  width?: number;
  /** Panel title */
  title?: string;
}

export function ApplicationToolsPanel({
  isOpen,
  onClose,
  defaultTab = 'resume',
  job,
  onJobUpdate,
  companyName,
  targetRole,
  jobTitle,
  // width prop is deprecated - responsive sizing is handled via Tailwind classes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  width: _width = 440,
  title = 'Application Tools',
}: ApplicationToolsPanelProps) {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<ApplicationToolsTab>(defaultTab);
  const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(null);

  // Reset tab when closed/reopened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Load company intel from job, AppContext, or fallback props (priority order)
  useEffect(() => {
    if (isOpen) {
      // Priority: job prop > AppContext > null
      if (job?.companyIntel) {
        setCompanyIntel(job.companyIntel);
      } else if (state.setup.companyIntel) {
        setCompanyIntel(state.setup.companyIntel);
      } else {
        setCompanyIntel(null);
      }
    }
  }, [isOpen, job, state.setup.companyIntel]);

  // Check if we have notes content
  const resumeData = state.setup.resumeParsedData;
  const hasNotes = !!(
    resumeData?.talkingPoints?.elevatorPitch ||
    (resumeData?.starStories && resumeData.starStories.length > 0)
  );

  // Determine company/role from job, AppContext, or fallback props
  const effectiveCompanyName = job?.job.company || companyName || state.setup.targetCompany;
  const effectiveTargetRole = job?.job.title || targetRole || state.setup.targetRole;
  const effectiveJobTitle = jobTitle || effectiveTargetRole;

  // Determine cover letter from job or AppContext
  const effectiveCoverLetter = job?.coverLetter || state.setup.coverLetter;

  if (!isOpen) return null;

  const tabs: { id: ApplicationToolsTab; label: string; icon: React.ElementType; badge?: boolean }[] = [
    { id: 'resume', label: 'Resume', icon: DocumentTextIcon },
    { id: 'cover', label: 'Cover', icon: EnvelopeIcon, badge: !!effectiveCoverLetter },
    { id: 'notes', label: 'Notes', icon: ChatBubbleLeftRightIcon, badge: hasNotes },
    { id: 'tips', label: 'Tips', icon: LightBulbIcon },
    { id: 'intel', label: 'Intel', icon: BuildingOffice2Icon, badge: !!companyIntel },
  ];

  return (
    <>
      {/* Overlay - only on mobile when panel covers full width */}
      <div
        className="fixed inset-0 z-40 bg-black/50 sm:hidden"
        onClick={onClose}
      />

      {/* Panel - responsive sizing
          - Mobile (<640px): Full screen modal starting below app header (with overlay)
          - Tablet (>=640px): Right sidebar, 320px (no overlay, can interact with main content)
          - Desktop (>=768px): Right sidebar, 380px
          - Large (>=1024px): Right sidebar, 440px
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <span className="text-lg font-semibold text-gray-900">{title}</span>
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
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-2 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && <span className="w-2 h-2 bg-green-500 rounded-full" />}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Resume Tab */}
          {activeTab === 'resume' && <ResumeTabContent jobTitle={effectiveJobTitle} />}

          {/* Cover Letter Tab */}
          {activeTab === 'cover' && (
            job ? (
              <CoverLetterTab
                job={job}
                resumeMarkdown={state.setup.improvedResumeMarkdown || null}
                onJobUpdate={onJobUpdate || (() => {})}
              />
            ) : effectiveCoverLetter ? (
              // Show editable cover letter from AppContext (session-generated)
              <SessionCoverLetterContent
                coverLetter={effectiveCoverLetter}
                targetRole={effectiveTargetRole}
                targetCompany={effectiveCompanyName}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <EnvelopeIcon className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500">Cover letter generation</p>
                <p className="text-sm text-gray-400 mt-1">
                  Save a job to generate a tailored cover letter
                </p>
              </div>
            )
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && <NotesTabContent />}

          {/* Tips Tab */}
          {activeTab === 'tips' && <TipsTabContent />}

          {/* Intel Tab */}
          {activeTab === 'intel' && (
            effectiveCompanyName ? (
              <div className="p-4">
                <CompanyIntelPanel
                  companyName={effectiveCompanyName}
                  targetRole={effectiveTargetRole || undefined}
                  intel={companyIntel}
                  onIntelGenerated={(intel) => {
                    setCompanyIntel(intel);
                    // Update job if available
                    if (onJobUpdate) {
                      onJobUpdate({ companyIntel: intel });
                    }
                    // Also update AppContext for session-level persistence
                    dispatch({
                      type: 'UPDATE_SETUP',
                      payload: { companyIntel: intel },
                    });
                  }}
                  jobId={job?.job.jobId}
                  isJobSaved={job?.saved}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <BuildingOffice2Icon className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500">Company Intel</p>
                <p className="text-sm text-gray-400 mt-1">
                  Select a job or set a target company to view intel
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
