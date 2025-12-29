import { useState, useRef, useEffect, useCallback } from 'react';
import { JobMatch } from '../../types';
import { useApp } from '../../context/AppContext';
import { generateCoverLetterStream } from '../../services/api';
import toast from 'react-hot-toast';
import {
  SparklesIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface CoverLetterTabProps {
  job: JobMatch;
  resumeMarkdown: string | null;
  onJobUpdate: (updates: Partial<JobMatch>) => void;
}

export function CoverLetterTab({ job, resumeMarkdown, onJobUpdate }: CoverLetterTabProps) {
  const { state } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string>(job.coverLetter || '');
  const [displayedText, setDisplayedText] = useState<string>(job.coverLetter || '');
  const [copied, setCopied] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState<string>('');
  
  // Typewriter effect refs
  const typewriterQueueRef = useRef<string[]>([]);
  const typewriterActiveRef = useRef(false);
  const displayedTextRef = useRef(job.coverLetter || '');
  const isGeneratingRef = useRef(false); // Track generation state for useEffect

  // Reset state when job changes (but NOT during active generation)
  useEffect(() => {
    // Don't reset during generation - the onComplete handler will set the final state
    if (isGeneratingRef.current) return;
    
    setCoverLetter(job.coverLetter || '');
    setDisplayedText(job.coverLetter || '');
    displayedTextRef.current = job.coverLetter || '';
  }, [job.job.jobId, job.coverLetter]);

  // Process typewriter queue (this logic will be adapted for streaming chunks)
  const processTypewriterQueue = useCallback(() => {
    if (typewriterQueueRef.current.length === 0) {
      typewriterActiveRef.current = false;
      return;
    }

    typewriterActiveRef.current = true;
    const charsToAdd = typewriterQueueRef.current.splice(0, 3).join('');
    displayedTextRef.current += charsToAdd;
    setDisplayedText(displayedTextRef.current);

    requestAnimationFrame(() => {
      setTimeout(processTypewriterQueue, 10);
    });
  }, []);

  async function handleGenerate() {
    if (!resumeMarkdown) {
      toast.error('Please generate an improved resume first in the Setup Wizard');
      return;
    }

    if (!job.job.description) {
      toast.error('Job description is required to generate a cover letter');
      return;
    }

    setIsGenerating(true);
    isGeneratingRef.current = true; // Track generation state
    setCoverLetter('');
    setDisplayedText('');
    displayedTextRef.current = '';
    typewriterQueueRef.current = []; // Clear queue for new generation

    try {
      await generateCoverLetterStream(
        job.job.jobId,
        {
          jobData: job.job,
          resumeMarkdown,
          targetRole: state.setup.targetRole,
          targetCompany: job.job.company,
        },
        (chunk) => {
          // Append chunk to the typewriter queue
          typewriterQueueRef.current.push(...chunk.split(''));
          // Process the queue to simulate typing effect
          if (!typewriterActiveRef.current) {
            processTypewriterQueue();
          }
        },
        (fullText) => {
          // Stop typewriter and set final text directly
          typewriterQueueRef.current = []; // Clear any remaining characters
          typewriterActiveRef.current = false;
          
          // Set final displayed text to the complete response
          displayedTextRef.current = fullText;
          setDisplayedText(fullText);
          setCoverLetter(fullText);
          
          // Mark generation as complete BEFORE calling onJobUpdate
          isGeneratingRef.current = false;
          setIsGenerating(false);
          
          onJobUpdate({
            coverLetter: fullText,
            coverLetterGeneratedAt: new Date().toISOString(),
            saved: true,
            autoSaved: !job.saved,
          });
          
          if (!job.saved) {
            toast.success('Cover letter generated! Job saved to your list.');
          } else {
            toast.success('Cover letter generated!');
          }
        },
        (error) => {
          console.error('Failed to generate cover letter:', error);
          toast.error('Failed to generate cover letter. Please try again.');
          isGeneratingRef.current = false;
          setIsGenerating(false);
        }
      );
    } catch (err) {
      console.error('Unhandled error in generateCoverLetterStream:', err);
      toast.error('An unexpected error occurred.');
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  }

  return (
    <div className="p-4">
      {/* Generate Button */}
      {!coverLetter && !isGenerating && (
        <div className="text-center py-8">
          <SparklesIcon className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Generate Cover Letter
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Create a personalized cover letter tailored to this job using your resume and AI.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!resumeMarkdown}
            className="btn-primary flex items-center justify-center gap-2 mx-auto"
          >
            <SparklesIcon className="w-5 h-5" />
            Generate with AI
          </button>
          {!resumeMarkdown && (
            <p className="text-xs text-amber-600 mt-3">
              ⚠️ Upload and improve your resume first
            </p>
          )}
        </div>
      )}

      {/* Generating State */}
      {isGenerating && (
        <div className="py-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600">Generating cover letter...</span>
          </div>
          
          {/* Typewriter Display */}
          {displayedText && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {displayedText}
                <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-0.5" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cover Letter Display */}
      {coverLetter && !isGenerating && (
        <>
          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                if (isEditing) {
                  // Save changes and switch to preview mode
                  setCoverLetter(editedText);
                  setDisplayedText(editedText);
                  displayedTextRef.current = editedText;
                  setIsEditing(false);
                  // Update job with edited cover letter
                  onJobUpdate({
                    coverLetter: editedText,
                  });
                  toast.success('Cover letter updated!');
                } else {
                  // Switch to edit mode
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
                  setEditedText('');
                }}
                className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
              >
                <EyeIcon className="w-4 h-4" />
                Cancel
              </button>
            ) : (
              <button
                onClick={() => {
                  const textToCopy = coverLetter;
                  navigator.clipboard.writeText(textToCopy);
                  setCopied(true);
                  toast.success('Cover letter copied!');
                  setTimeout(() => setCopied(false), 2000);
                }}
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
            <button
              onClick={handleGenerate}
              className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Regenerate
            </button>
          </div>

          {/* Generated Info */}
          {job.coverLetterGeneratedAt && !isEditing && (
            <p className="text-xs text-gray-500 mb-3">
              Generated {new Date(job.coverLetterGeneratedAt).toLocaleString()}
            </p>
          )}

          {/* Cover Letter Content - Edit or View Mode */}
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
                {displayedText}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
