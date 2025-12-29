/**
 * ResumeTabContent - Reusable resume viewer/editor for Application Tools panel
 *
 * Features:
 * - Loads improved resume from API or global state
 * - Edit mode with markdown editor
 * - Copy to clipboard
 * - Print/Download
 */

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import { useApp } from '../../context/AppContext';
import { getImprovedResume } from '../../services/api';
import {
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ResumeTabContentProps {
  /** Optional job title for print/download naming */
  jobTitle?: string;
}

export function ResumeTabContent({ jobTitle }: ResumeTabContentProps) {
  const { state } = useApp();
  const [resumeMarkdown, setResumeMarkdown] = useState<string | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Resume editing state
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [editedResumeMarkdown, setEditedResumeMarkdown] = useState<string>('');

  // Load resume on mount
  useEffect(() => {
    if (resumeMarkdown) return; // Already loaded

    // First check global state
    if (state.setup.improvedResumeMarkdown) {
      setResumeMarkdown(state.setup.improvedResumeMarkdown);
      return;
    }

    // Otherwise fetch from API
    if (state.sessionId) {
      setIsLoadingResume(true);
      setResumeError(null);
      getImprovedResume(state.sessionId)
        .then((response) => {
          if (response.success && response.improvedResumeMarkdown) {
            setResumeMarkdown(response.improvedResumeMarkdown);
          } else {
            setResumeError('No improved resume found. Generate one in the Setup Wizard first.');
          }
        })
        .catch((err) => {
          console.error('Failed to fetch improved resume:', err);
          setResumeError('Failed to load resume. Please try again.');
        })
        .finally(() => {
          setIsLoadingResume(false);
        });
    }
  }, [state.sessionId, state.setup.improvedResumeMarkdown, resumeMarkdown]);

  // Loading state
  if (isLoadingResume) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 p-4">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p>Loading resume...</p>
      </div>
    );
  }

  // Error state
  if (resumeError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center p-4">
        <DocumentTextIcon className="w-12 h-12 mb-4 text-gray-400" />
        <p className="mb-4">{resumeError}</p>
      </div>
    );
  }

  // No resume available
  if (!resumeMarkdown) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center p-4">
        <DocumentTextIcon className="w-12 h-12 mb-4 text-gray-400" />
        <p>No resume available</p>
        <p className="text-sm mt-2">Upload and improve your resume in the Setup Wizard</p>
      </div>
    );
  }

  const handleToggleEdit = () => {
    if (isEditingResume) {
      // Switch to preview mode
      setIsEditingResume(false);
    } else {
      // Switch to edit mode
      setEditedResumeMarkdown(resumeMarkdown);
      setIsEditingResume(true);
    }
  };

  const handleCopy = () => {
    const content = isEditingResume ? editedResumeMarkdown : resumeMarkdown;
    navigator.clipboard.writeText(content || '');
    toast.success('Resume copied to clipboard!');
  };

  const handleDownload = () => {
    const content = isEditingResume ? editedResumeMarkdown : resumeMarkdown;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Resume - ${jobTitle || 'My Resume'}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
            h3 { font-size: 14px; margin-top: 16px; margin-bottom: 4px; }
            p { margin: 8px 0; }
            ul { margin: 8px 0; padding-left: 20px; }
            li { margin: 4px 0; }
            @media print { body { margin: 0; padding: 20px; } }
          </style>
        </head>
        <body>
          ${content.replace(/\n/g, '<br/>')}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="p-4">
      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleToggleEdit}
          className={`flex-1 text-sm py-2 flex items-center justify-center gap-2 ${
            isEditingResume ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          {isEditingResume ? (
            <>
              <EyeIcon className="w-4 h-4" />
              Preview
            </>
          ) : (
            <>
              <PencilSquareIcon className="w-4 h-4" />
              Edit
            </>
          )}
        </button>
        <button
          onClick={handleCopy}
          className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
        >
          <ClipboardDocumentIcon className="w-4 h-4" />
          Copy
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Download
        </button>
      </div>

      {/* Resume Content - Edit or Preview Mode */}
      {isEditingResume ? (
        <div data-color-mode="light">
          <MDEditor
            value={editedResumeMarkdown}
            onChange={(value) => setEditedResumeMarkdown(value || '')}
            height={500}
            preview="edit"
          />
          <p className="text-xs text-gray-500 mt-2">
            Tip: Customize your resume for this specific job. Changes are local and won't affect your original resume.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{resumeMarkdown}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
