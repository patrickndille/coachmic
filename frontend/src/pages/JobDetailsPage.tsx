import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getJobDetails, saveJob, unsaveJob, markJobApplied, getSavedJobs } from '../services/api';
import { triggerArtifactGeneration } from '../services/artifacts';
import { JobMatch, ApplicationStatus } from '../types';
import { JobSidePanel, JobSidePanelTab } from '../components/job';
import {
  BriefcaseIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  BookmarkIcon,
  ArrowLeftIcon,
  ClockIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon, PlayIcon } from '@heroicons/react/24/solid';

export default function JobDetailsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [job, setJob] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApplicationIframe, setShowApplicationIframe] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const iframeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Side panel state
  const [activePanelTab, setActivePanelTab] = useState<JobSidePanelTab>('resume');
  const [showSidePanel, setShowSidePanel] = useState(true);

  // Load job from cache, saved jobs, or API
  useEffect(() => {
    async function loadJob() {
      if (!jobId) {
        setError('No job ID provided');
        setLoading(false);
        return;
      }

      // First check cache (can be done without auth)
      const cachedJob = state.cachedJobs[jobId];
      if (cachedJob) {
        console.log('[JobDetails] Found in local cache');
        setJob(cachedJob);
        setLoading(false);
        return;
      }

      // Wait for auth to be ready before making API calls
      if (authLoading) {
        console.log('[JobDetails] Waiting for auth to initialize...');
        return;
      }

      if (!isAuthenticated) {
        console.log('[JobDetails] User not authenticated, cannot load job from API');
        setError('Please sign in to view job details.');
        setLoading(false);
        return;
      }

      // Try to find in saved jobs first (includes cached fit_analysis)
      try {
        console.log('[JobDetails] Not in cache, checking saved jobs...');
        const savedJobsResponse = await getSavedJobs();
        const savedJob = savedJobsResponse.jobs.find(j => j.job.jobId === jobId);
        if (savedJob) {
          console.log('[JobDetails] Found in saved jobs, using cached fit analysis');
          setJob(savedJob);
          dispatch({ type: 'CACHE_JOBS', payload: [savedJob] });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log('[JobDetails] Could not check saved jobs:', err);
        // Continue to API fallback
      }

      // Fetch from API as last resort
      try {
        console.log('[JobDetails] Fetching from API...');
        const jobData = await getJobDetails(jobId);
        setJob(jobData);
        // Cache it
        dispatch({ type: 'CACHE_JOBS', payload: [jobData] });
      } catch (err) {
        console.error('[JobDetails] Failed to load job:', err);
        setError('Failed to load job details. The job may no longer be available.');
      } finally {
        setLoading(false);
      }
    }

    loadJob();
  }, [jobId, state.cachedJobs, dispatch, authLoading, isAuthenticated]);

  // Cleanup iframe timeout on unmount
  useEffect(() => {
    return () => {
      if (iframeTimeoutRef.current) {
        clearTimeout(iframeTimeoutRef.current);
      }
    };
  }, []);

  // Handle bookmark toggle
  async function handleToggleSave() {
    if (!job || !jobId) return;
    setIsSaving(true);

    try {
      if (job.saved) {
        await unsaveJob(jobId);
        setJob({ ...job, saved: false, autoSaved: false });
        dispatch({ type: 'UPDATE_CACHED_JOB', payload: { jobId, updates: { saved: false, autoSaved: false } } });
        toast.success('Removed from saved jobs');
      } else {
        // Pass fitAnalysis, job data, and companyIntel to persist all job-specific data
        await saveJob(jobId, job.fitAnalysis, job.job, job.companyIntel as Record<string, unknown> | undefined);
        setJob({ ...job, saved: true, autoSaved: false });
        dispatch({ type: 'UPDATE_CACHED_JOB', payload: { jobId, updates: { saved: true, autoSaved: false } } });
        toast.success('Job saved!');

        // Trigger background artifact generation for any missing artifacts
        const needsCoverLetter = !job.coverLetter;
        const needsIntel = !job.companyIntel;
        if (needsCoverLetter || needsIntel) {
          triggerArtifactGeneration(jobId, {
            coverLetter: needsCoverLetter,
            companyIntel: needsIntel,
            resumeMarkdown: state.setup.improvedResumeMarkdown || undefined,
            targetRole: job.job.title,
            targetCompany: job.job.company,
            jobData: job.job,
          });
        }
      }
    } catch (err) {
      console.error('[JobDetails] Failed to toggle save:', err);
      toast.error('Failed to update saved status');
    } finally {
      setIsSaving(false);
    }
  }

  // Handle apply click - show iframe
  function handleApplyClick() {
    if (!job?.job.url) {
      toast.error('No application link available');
      return;
    }
    setShowApplicationIframe(true);
    setIframeBlocked(false);
    
    // Most job sites block iframe embedding, so we collapse after a short delay
    // This gives time for the iframe to attempt loading
    iframeTimeoutRef.current = setTimeout(() => {
      console.log('[JobDetails] Collapsing iframe after timeout (assuming blocked)');
      setIframeBlocked(true);
    }, 2000); // 2 second timeout then collapse
  }

  // Handle iframe error (site blocked embedding)
  function handleIframeError() {
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
    }
    setIframeBlocked(true);
  }

  // Open in new tab (fallback)
  function handleOpenInNewTab() {
    if (job?.job.url) {
      window.open(job.job.url, '_blank', 'noopener,noreferrer');
    }
  }

  // Mark as applied
  async function handleMarkApplied() {
    if (!job || !jobId) return;

    try {
      await markJobApplied(jobId);
      const updates = {
        applied: true,
        applicationStatus: 'applied' as ApplicationStatus,
        appliedAt: new Date().toISOString(),
      };
      setJob({ ...job, ...updates });
      dispatch({ type: 'UPDATE_CACHED_JOB', payload: { jobId, updates } });
      toast.success('Marked as applied! Good luck! 🍀');
      setShowApplicationIframe(false);
    } catch (err) {
      console.error('[JobDetails] Failed to mark as applied:', err);
      toast.error('Failed to update status');
    }
  }

  // Close iframe
  function handleCancelApplication() {
    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
    }
    setShowApplicationIframe(false);
    setIframeBlocked(false);
  }

  // Start practice interview for this job
  function handlePracticeInterview() {
    if (!job) return;
    dispatch({
      type: 'UPDATE_SETUP',
      payload: {
        targetRole: job.job.title,
        targetCompany: job.job.company,
      },
    });
    // Navigate directly to Step 4 (interview type/join) with all fields pre-filled
    navigate('/setup?step=type');
    toast.success(`Ready to practice for ${job.job.title}!`);
  }

  // Format salary
  function formatSalary(salaryRange?: { minSalary?: number; maxSalary?: number; currency?: string }) {
    if (!salaryRange) return null;
    const min = salaryRange.minSalary ? `$${(salaryRange.minSalary / 1000).toFixed(0)}k` : '';
    const max = salaryRange.maxSalary ? `$${(salaryRange.maxSalary / 1000).toFixed(0)}k` : '';
    if (min && max) return `${min} - ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !job) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Job Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This job could not be loaded.'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(-1)} className="btn-secondary">
              Go Back
            </button>
            <Link to="/setup" className="btn-primary">
              Browse Jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job.job.salaryRange);
  const fitScore = job.fitAnalysis?.overallMatch || 0;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showSidePanel ? 'lg:pr-[420px]' : ''}`}>
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleSave}
                disabled={isSaving}
                className={`p-2 rounded-lg transition-colors ${
                  job.saved
                    ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                    : 'text-gray-500 hover:text-primary-600 hover:bg-gray-100'
                }`}
                title={job.saved ? 'Remove from saved' : 'Save job'}
              >
                {job.saved ? (
                  <BookmarkSolidIcon className="w-6 h-6" />
                ) : (
                  <BookmarkIcon className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => setShowSidePanel(!showSidePanel)}
                className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  showSidePanel
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {showSidePanel ? 'Hide Panel' : 'Tools Panel'}
              </button>
            </div>
          </div>
        </div>

        {/* Job Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 sm:p-6">
            {/* Application Iframe Overlay */}
            {showApplicationIframe && (
              <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Apply to {job.job.company}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenInNewTab}
                      className="text-sm text-primary-600 hover:text-primary-800"
                    >
                      Open in New Tab ↗
                    </button>
                    <button
                      onClick={handleCancelApplication}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Only show iframe if not blocked */}
                {!iframeBlocked && (
                  <iframe
                    src={job.job.url}
                    className="w-full h-[500px] border-0"
                    title={`Apply to ${job.job.title}`}
                    onError={handleIframeError}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                )}

                <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    💡 Copy your resume and cover letter from the side panel
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleCancelApplication} className="btn-secondary text-sm">
                      Cancel
                    </button>
                    <button onClick={handleMarkApplied} className="btn-primary text-sm">
                      ✓ Mark as Applied
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Job Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start gap-4">
                {/* Company Logo Placeholder */}
                <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  {job.job.companyLogo ? (
                    <img
                      src={job.job.companyLogo}
                      alt={job.job.company}
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <BriefcaseIcon className="w-8 h-8 text-primary-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">{job.job.title}</h1>
                  <p className="text-lg text-gray-600 mb-3">{job.job.company}</p>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="w-4 h-4" />
                      {job.job.location}
                      {job.job.remoteType === 'remote' && (
                        <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          Remote
                        </span>
                      )}
                    </span>
                    {salary && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CurrencyDollarIcon className="w-4 h-4" />
                        {salary}
                      </span>
                    )}
                    {job.job.employmentType && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {job.job.employmentType}
                      </span>
                    )}
                  </div>

                  {/* Applied Badge */}
                  {job.applied && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                      <CheckCircleIcon className="w-4 h-4" />
                      Applied {job.appliedAt && `on ${new Date(job.appliedAt).toLocaleDateString()}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Match Score */}
              {fitScore > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Match Score</span>
                    <span
                      className={`text-lg font-bold ${
                        fitScore >= 80
                          ? 'text-green-600'
                          : fitScore >= 60
                          ? 'text-blue-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {fitScore}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        fitScore >= 80
                          ? 'bg-green-500'
                          : fitScore >= 60
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                      }`}
                      style={{ width: `${fitScore}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handlePracticeInterview}
                  className="flex-1 sm:flex-none btn-secondary flex items-center justify-center gap-2"
                >
                  <PlayIcon className="w-5 h-5" />
                  Practice Interview
                </button>
                {job.job.url && !job.applied && (
                  <button
                    onClick={handleApplyClick}
                    className="flex-1 sm:flex-none btn-primary flex items-center justify-center gap-2"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>

            {/* Fit Analysis */}
            {job.fitAnalysis && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Fit Analysis</h2>

                {/* Match Scores */}
                {(job.fitAnalysis.overallMatch > 0 || job.fitAnalysis.skillMatch > 0) && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-primary-600">{job.fitAnalysis.overallMatch || 0}%</div>
                      <div className="text-xs text-gray-500">Overall Match</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{job.fitAnalysis.skillMatch || 0}%</div>
                      <div className="text-xs text-gray-500">Skill Match</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{job.fitAnalysis.experienceMatch || 0}%</div>
                      <div className="text-xs text-gray-500">Experience</div>
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Strengths */}
                  {job.fitAnalysis.strengthsForRole && job.fitAnalysis.strengthsForRole.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h3 className="font-medium text-green-800 mb-2">✅ Your Strengths</h3>
                      <ul className="space-y-1">
                        {job.fitAnalysis.strengthsForRole.slice(0, 3).map((strength, i) => (
                          <li key={i} className="text-sm text-green-700">
                            • {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Areas to Address */}
                  {job.fitAnalysis.potentialConcerns && job.fitAnalysis.potentialConcerns.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-4">
                      <h3 className="font-medium text-amber-800 mb-2">⚠️ Areas to Address</h3>
                      <ul className="space-y-1">
                        {job.fitAnalysis.potentialConcerns.slice(0, 3).map((concern, i) => (
                          <li key={i} className="text-sm text-amber-700">
                            • {concern}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Show message if no analysis data */}
                {(!job.fitAnalysis.strengthsForRole || job.fitAnalysis.strengthsForRole.length === 0) &&
                 (!job.fitAnalysis.potentialConcerns || job.fitAnalysis.potentialConcerns.length === 0) &&
                 job.fitAnalysis.overallMatch === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    Detailed fit analysis is not available for this job. Try refreshing the page.
                  </p>
                )}

                {/* Career Trajectory */}
                {job.careerTrajectory && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="font-medium text-gray-800 mb-2">📈 Career Path</h3>
                    <p className="text-sm text-gray-600">
                      {job.careerTrajectory.growthPath || job.careerTrajectory.currentFit}
                    </p>
                    {job.careerTrajectory.timeToNextLevel && (
                      <p className="text-sm text-gray-500 mt-1">
                        Estimated time to next level: {job.careerTrajectory.timeToNextLevel}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Job Description */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h2>
              <div className="prose prose-sm max-w-none text-gray-600">
                {job.job.description.split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Requirements */}
            {job.job.requirements?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>
                <ul className="space-y-2">
                  {job.job.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-600">
                      <span className="text-primary-500 mt-1">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Nice to Have */}
            {job.job.niceToHave?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Nice to Have</h2>
                <ul className="space-y-2">
                  {job.job.niceToHave.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-600">
                      <span className="text-gray-400 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Benefits */}
            {job.job.benefits?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Benefits</h2>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {job.job.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-600">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <JobSidePanel
        isOpen={showSidePanel}
        onClose={() => setShowSidePanel(false)}
        activeTab={activePanelTab}
        onTabChange={setActivePanelTab}
        job={job}
        onJobUpdate={(updates: Partial<JobMatch>) => {
          if (jobId) {
            setJob({ ...job, ...updates });
            dispatch({ type: 'UPDATE_CACHED_JOB', payload: { jobId, updates } });
          }
        }}
      />
    </div>
  );
}
