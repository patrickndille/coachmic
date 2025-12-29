/**
 * SessionCoverLetterContent - Cover letter display/edit for session-based (non-saved job) flow
 *
 * Used in ApplicationToolsPanel when there's a cover letter in AppContext but no saved job.
 * Allows viewing, editing, and copying the cover letter.
 * Edits are persisted to AppContext (session-level).
 */

import { useState } from 'react';
import {
  PencilSquareIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../../context/AppContext';
import toast from 'react-hot-toast';

interface SessionCoverLetterContentProps {
  coverLetter: string;
  targetRole?: string;
  targetCompany?: string;
}

export function SessionCoverLetterContent({
  coverLetter,
  targetRole,
  targetCompany,
}: SessionCoverLetterContentProps) {
  const { dispatch } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(coverLetter);
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    // Update AppContext with edited cover letter
    dispatch({
      type: 'UPDATE_SETUP',
      payload: { coverLetter: editedText },
    });
    setIsEditing(false);
    toast.success('Cover letter updated!');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedText : coverLetter);
    setCopied(true);
    toast.success('Cover letter copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Cover Letter</h3>
        {(targetRole || targetCompany) && (
          <p className="text-sm text-gray-500 mt-1">
            Generated for {targetRole}{targetRole && targetCompany ? ' at ' : ''}{targetCompany}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            if (isEditing) {
              handleSave();
            } else {
              setEditedText(coverLetter);
              setIsEditing(true);
            }
          }}
          className={`flex-1 text-sm py-2 flex items-center justify-center gap-2 ${
            isEditing ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          {isEditing ? (
            <>
              <CheckCircleIcon className="w-4 h-4" />
              Save
            </>
          ) : (
            <>
              <PencilSquareIcon className="w-4 h-4" />
              Edit
            </>
          )}
        </button>
        {isEditing ? (
          <button
            onClick={() => {
              setIsEditing(false);
              setEditedText(coverLetter);
            }}
            className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
          >
            <EyeIcon className="w-4 h-4" />
            Cancel
          </button>
        ) : (
          <button
            onClick={handleCopy}
            className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        )}
      </div>

      {/* Content - Edit or View Mode */}
      {isEditing ? (
        <div>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-96 p-4 border border-gray-300 rounded-lg text-sm text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            placeholder="Edit your cover letter..."
          />
          <p className="text-xs text-gray-500 mt-2">
            Tip: Customize your cover letter for this specific application. Click Save to keep changes.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
            {coverLetter}
          </div>
        </div>
      )}
    </div>
  );
}
