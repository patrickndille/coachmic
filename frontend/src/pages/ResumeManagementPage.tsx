import { useState, useEffect } from 'react';
import {
  DocumentArrowDownIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import {
  listResumeVersions,
  getResumeVersionDownloadUrl,
  deleteResumeVersion,
  setCurrentResumeVersion,
  generateImprovedPDF,
} from '../services/api';
import { useApp } from '../context/AppContext';
import { ResumeVersion } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/common/ConfirmModal';

export default function ResumeManagementPage() {
  const { state } = useApp();
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGeneratePDFModal, setShowGeneratePDFModal] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<ResumeVersion | null>(null);
  const [setAsCurrentOnGenerate, setSetAsCurrentOnGenerate] = useState(true);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      const response = await listResumeVersions();
      if (response.success) {
        setVersions(response.versions);
        setCurrentVersionId(response.currentVersionId || null);
      }
    } catch (error) {
      console.error('Failed to load resume versions:', error);
      toast.error('Failed to load resume versions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (version: ResumeVersion) => {
    try {
      setIsDownloading(version.versionId);
      const response = await getResumeVersionDownloadUrl(version.versionId);

      // Open download URL in new tab
      window.open(response.downloadUrl, '_blank');
      toast.success('Download started');
    } catch (error) {
      console.error('Failed to download resume:', error);
      toast.error('Failed to download resume');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDeleteClick = (version: ResumeVersion) => {
    if (version.versionId === currentVersionId) {
      toast.error('Cannot delete current resume. Set a different version as current first.');
      return;
    }
    setVersionToDelete(version);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!versionToDelete) return;

    try {
      setIsDeleting(versionToDelete.versionId);
      setShowDeleteModal(false);
      await deleteResumeVersion(versionToDelete.versionId);
      toast.success('Resume version deleted');
      await loadVersions();
    } catch (error: any) {
      console.error('Failed to delete resume:', error);
      toast.error(error.message || 'Failed to delete resume');
    } finally {
      setIsDeleting(null);
      setVersionToDelete(null);
    }
  };

  const handleSetCurrent = async (version: ResumeVersion) => {
    if (version.versionId === currentVersionId) return;

    try {
      await setCurrentResumeVersion(version.versionId);
      setCurrentVersionId(version.versionId);
      toast.success(`Set "${version.fileName}" as current resume`);
    } catch (error) {
      console.error('Failed to set current resume:', error);
      toast.error('Failed to set current resume');
    }
  };

  const handleGeneratePDFClick = () => {
    if (!state.sessionId) {
      toast.error('No active session. Please upload a resume first.');
      return;
    }
    setSetAsCurrentOnGenerate(true); // Default to true
    setShowGeneratePDFModal(true);
  };

  const handleGeneratePDFConfirm = async () => {
    if (!state.sessionId) return;

    try {
      setShowGeneratePDFModal(false);
      setIsGeneratingPDF(true);
      const response = await generateImprovedPDF(state.sessionId, setAsCurrentOnGenerate);

      if (response.success && response.version) {
        toast.success('Improved resume PDF generated!');
        await loadVersions();
      } else {
        toast.error(response.message || 'Failed to generate PDF');
      }
    } catch (error: any) {
      console.error('Failed to generate PDF:', error);
      toast.error(error.message || 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your resumes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Resume Management</h1>
        <p className="mt-2 text-gray-600">
          Manage your resume versions. Your resumes are stored securely and linked to your interview sessions.
        </p>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex items-center gap-4">
        <a
          href="/setup"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
          Upload New Resume
        </a>

        {state.setup?.improvedResumeMarkdown && (
          <button
            onClick={handleGeneratePDFClick}
            disabled={isGeneratingPDF}
            className="inline-flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {isGeneratingPDF ? (
              <>
                <div className="animate-spin h-5 w-5 mr-2 border-b-2 border-indigo-600 rounded-full" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5 mr-2" />
                Generate Improved PDF
              </>
            )}
          </button>
        )}
      </div>

      {/* Version Count */}
      <div className="mb-4 text-sm text-gray-500">
        {versions.length} of 10 resume versions used
      </div>

      {/* Resume List */}
      {versions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No resumes yet</h3>
          <p className="mt-2 text-gray-500">
            Upload your first resume to get started with interview practice.
          </p>
          <a
            href="/setup"
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Upload Resume
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => {
            const isCurrent = version.versionId === currentVersionId;

            return (
              <div
                key={version.versionId}
                className={`bg-white rounded-lg shadow-sm border ${
                  isCurrent ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'
                } p-4`}
              >
                <div className="flex items-start justify-between">
                  {/* File Info */}
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${
                      version.isAiImproved ? 'bg-purple-100' : 'bg-gray-100'
                    }`}>
                      {version.isAiImproved ? (
                        <SparklesIcon className="h-6 w-6 text-purple-600" />
                      ) : (
                        <DocumentTextIcon className="h-6 w-6 text-gray-600" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{version.fileName}</h3>
                        {isCurrent && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleSolid className="h-3 w-3 mr-1" />
                            Current
                          </span>
                        )}
                        {version.isAiImproved && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            AI Improved
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-gray-500 space-x-4">
                        <span>{version.fileType.toUpperCase()}</span>
                        <span>{formatFileSize(version.fileSize)}</span>
                        <span>{formatDate(version.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {!isCurrent && (
                      <button
                        onClick={() => handleSetCurrent(version)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Set as current"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDownload(version)}
                      disabled={isDownloading === version.versionId}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Download"
                    >
                      {isDownloading === version.versionId ? (
                        <div className="animate-spin h-5 w-5 border-b-2 border-blue-600 rounded-full" />
                      ) : (
                        <DocumentArrowDownIcon className="h-5 w-5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteClick(version)}
                      disabled={isCurrent || isDeleting === version.versionId}
                      className={`p-2 rounded-lg transition-colors ${
                        isCurrent
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                      } disabled:opacity-50`}
                      title={isCurrent ? 'Cannot delete current resume' : 'Delete'}
                    >
                      {isDeleting === version.versionId ? (
                        <div className="animate-spin h-5 w-5 border-b-2 border-red-600 rounded-full" />
                      ) : (
                        <TrashIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900">About Resume Versioning</h4>
        <ul className="mt-2 text-sm text-blue-800 space-y-1">
          <li>• You can store up to 10 resume versions</li>
          <li>• Each interview session is linked to a specific resume version</li>
          <li>• When you reach 10 versions, the oldest non-current version is automatically removed</li>
          <li>• AI-improved resumes are marked with a sparkle icon</li>
        </ul>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setVersionToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Resume?"
        message={
          versionToDelete
            ? `Are you sure you want to delete "${versionToDelete.fileName}"? This action cannot be undone.`
            : 'Are you sure you want to delete this resume?'
        }
        confirmText="Delete"
        isDestructive
        isLoading={isDeleting !== null}
      />

      {/* Generate PDF Modal */}
      <ConfirmModal
        isOpen={showGeneratePDFModal}
        onClose={() => setShowGeneratePDFModal(false)}
        onConfirm={handleGeneratePDFConfirm}
        title="Generate Improved PDF?"
        message={
          <div className="space-y-4">
            <p>Generate a PDF from your AI-improved resume.</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsCurrentOnGenerate}
                onChange={(e) => setSetAsCurrentOnGenerate(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Set as current resume</span>
            </label>
          </div>
        }
        confirmText="Generate PDF"
        isLoading={isGeneratingPDF}
      />
    </div>
  );
}
