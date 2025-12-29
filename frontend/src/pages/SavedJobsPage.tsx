import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSavedJobs, unsaveJob } from '../services/api';
import { JobMatch } from '../types';
import { BriefcaseIcon, BookmarkIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, EnvelopeIcon } from '@heroicons/react/24/solid';
import { FunnelIcon, MagnifyingGlassIcon, ChartBarSquareIcon } from '@heroicons/react/24/outline';
import { useApp } from '../context/AppContext';

type FilterTab = 'all' | 'applied' | 'interviewing' | 'with-cover-letter' | 'pending';

export default function SavedJobsPage() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const [savedJobs, setSavedJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Filter jobs based on active tab
  const filteredJobs = useMemo(() => {
    switch (activeFilter) {
      case 'applied':
        return savedJobs.filter(job => job.applied || job.applicationStatus === 'applied');
      case 'interviewing':
        return savedJobs.filter(job => job.applicationStatus === 'interviewing');
      case 'with-cover-letter':
        return savedJobs.filter(job => !!job.coverLetter);
      case 'pending':
        return savedJobs.filter(job => !job.applied && !job.applicationStatus);
      default:
        return savedJobs;
    }
  }, [savedJobs, activeFilter]);

  // Get filter counts - MUST be before any early returns!
  const filterCounts = useMemo(() => ({
    all: savedJobs.length,
    applied: savedJobs.filter(job => job.applied || job.applicationStatus === 'applied').length,
    interviewing: savedJobs.filter(job => job.applicationStatus === 'interviewing').length,
    'with-cover-letter': savedJobs.filter(job => !!job.coverLetter).length,
    pending: savedJobs.filter(job => !job.applied && !job.applicationStatus).length,
  }), [savedJobs]);

  useEffect(() => {
    loadSavedJobs();
  }, []);

  async function loadSavedJobs() {
    try {
      setLoading(true);
      const response = await getSavedJobs();
      console.log('[SavedJobs] Raw response:', JSON.stringify(response, null, 2));
      
      // Filter out any malformed jobs to prevent crashes
      const validJobs = (response.jobs || []).filter((match, index) => {
        if (!match?.job?.jobId) {
          console.error(`[SavedJobs] Malformed job at index ${index}:`, match);
          return false;
        }
        return true;
      });
      
      setSavedJobs(validJobs);
    } catch (error) {
      console.error('[SavedJobs] Failed to load:', error);
      toast.error('Failed to load saved jobs');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsave(jobId: string, jobTitle: string) {
    try {
      await unsaveJob(jobId);
      setSavedJobs(jobs => jobs.filter(j => j.job.jobId !== jobId));
      toast.success(`Removed "${jobTitle}" from saved jobs`);
    } catch (error) {
      console.error('[SavedJobs] Failed to unsave:', error);
      toast.error('Failed to remove job');
    }
  }

  function handlePracticeForJob(match: JobMatch) {
    // Update setup with this job's details
    dispatch({
      type: 'UPDATE_SETUP',
      payload: {
        targetRole: match.job.title,
        targetCompany: match.job.company,
      },
    });
    toast.success(`Ready to practice for ${match.job.title} at ${match.job.company}`);
    // Navigate directly to Step 4 (interview type/join) with all fields pre-filled
    navigate('/setup?step=type');
  }

  async function handleApply(match: JobMatch) {
    // Navigate to job details page instead of opening external link directly
    // Cache the job first
    dispatch({ type: 'CACHE_JOBS', payload: [match] });
    navigate(`/job/${encodeURIComponent(match.job.jobId)}`);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Saved Jobs</h1>
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (savedJobs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Saved Jobs</h1>
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4">🔖</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No saved jobs yet</h2>
          <p className="text-gray-600 mb-6">
            Save jobs you're interested in to easily find them later and prepare for interviews.
          </p>
          <Link to="/setup" className="btn-primary inline-block">
            Discover Jobs
          </Link>
        </div>
      </div>
    );
  }

  const filterTabs: { id: FilterTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'applied', label: 'Applied', icon: <CheckCircleIcon className="w-4 h-4" /> },
    { id: 'interviewing', label: 'Interviewing' },
    { id: 'with-cover-letter', label: 'With Cover Letter', icon: <EnvelopeIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Saved Jobs</h1>
          <p className="text-gray-600">
            {savedJobs.length} {savedJobs.length === 1 ? 'job' : 'jobs'} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/compare-jobs"
            className="btn-secondary flex items-center gap-2"
          >
            <ChartBarSquareIcon className="w-5 h-5" />
            Compare Jobs
          </Link>
          <button
            onClick={() => navigate('/setup?step=role')}
            className="btn-secondary flex items-center gap-2"
          >
            <MagnifyingGlassIcon className="w-5 h-5" />
            Search Jobs
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${activeFilter === tab.id
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {tab.icon}
              {tab.label}
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === tab.id ? 'bg-white/20' : 'bg-gray-200'
              }`}>
                {filterCounts[tab.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filtered Jobs Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs match this filter</h3>
          <p className="text-gray-600 mb-4">Try selecting a different filter to see your saved jobs.</p>
          <button
            onClick={() => setActiveFilter('all')}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            View all jobs
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((match) => (
            <SavedJobCard
              key={match.job.jobId}
              match={match}
              onUnsave={() => handleUnsave(match.job.jobId, match.job.title)}
              onPractice={() => handlePracticeForJob(match)}
              onApply={() => handleApply(match)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SavedJobCardProps {
  match: JobMatch;
  onUnsave: () => void;
  onPractice: () => void;
  onApply: () => void;
}

function SavedJobCard({ match, onUnsave, onPractice, onApply }: SavedJobCardProps) {
  const fitScore = match.fitAnalysis?.overallMatch || 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 relative">
      {/* Saved Bookmark Indicator */}
      <button
        onClick={onUnsave}
        className="absolute top-4 right-4 text-primary-600 hover:text-red-600 transition-colors"
        title="Remove from saved jobs"
      >
        <BookmarkIcon className="h-6 w-6" />
      </button>

      {/* Job Info */}
      <div className="mb-4 pr-8">
        <div className="flex items-start gap-3 mb-2">
          <div className="p-2 bg-primary-100 rounded-lg">
            <BriefcaseIcon className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
              {match.job.title}
            </h3>
            <p className="text-gray-600">{match.job.company}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
          <span>{match.job.location}</span>
          {match.job.remoteType === 'remote' && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Remote
            </span>
          )}
        </div>

        {match.job.salaryRange && (
          <p className="text-sm text-green-600 font-medium mt-2">
            ${(match.job.salaryRange.minSalary || 0) / 1000}k - ${(match.job.salaryRange.maxSalary || 0) / 1000}k
          </p>
        )}
      </div>

      {/* Fit Score */}
      {fitScore > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Match Score</span>
            <span className={`text-sm font-semibold ${
              fitScore >= 80 ? 'text-green-600' :
              fitScore >= 60 ? 'text-blue-600' :
              'text-gray-600'
            }`}>
              {fitScore}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                fitScore >= 80 ? 'bg-green-500' :
                fitScore >= 60 ? 'bg-blue-500' :
                'bg-gray-400'
              }`}
              style={{ width: `${fitScore}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Strength */}
      {match.fitAnalysis?.strengthsForRole && match.fitAnalysis.strengthsForRole.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs font-medium text-green-700 mb-1">Top Strength</p>
          <p className="text-sm text-gray-700 line-clamp-2">
            {match.fitAnalysis.strengthsForRole[0]}
          </p>
        </div>
      )}

      {/* Status Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Cover Letter Badge */}
        {match.coverLetter && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
            <EnvelopeIcon className="h-3 w-3" />
            Cover Letter Ready
          </span>
        )}
        
        {/* Application Status Badge */}
        {match.applicationStatus && match.applicationStatus !== 'saved' && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            match.applicationStatus === 'applied' ? 'bg-blue-100 text-blue-700' :
            match.applicationStatus === 'interviewing' ? 'bg-yellow-100 text-yellow-700' :
            match.applicationStatus === 'offered' ? 'bg-green-100 text-green-700' :
            match.applicationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
            match.applicationStatus === 'ghosted' ? 'bg-gray-100 text-gray-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            <CheckCircleIcon className="h-3 w-3" />
            {match.applicationStatus.charAt(0).toUpperCase() + match.applicationStatus.slice(1)}
          </span>
        )}
        
        {/* Legacy Applied Badge (for backwards compatibility) */}
        {match.applied && !match.applicationStatus && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircleIcon className="h-3 w-3" />
            Applied
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onApply}
          className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          View & Apply
        </button>
        <button
          onClick={onPractice}
          className="flex-1 btn-primary text-sm py-2"
        >
          Practice Interview
        </button>
      </div>
    </div>
  );
}
