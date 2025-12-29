import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSavedJobs } from '../services/api';
import { JobMatch } from '../types';
import { CheckCircleIcon, XCircleIcon, MapPinIcon, CurrencyDollarIcon, BuildingOfficeIcon, ChartBarSquareIcon, BookmarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function JobComparisonPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [savedJobs, setSavedJobs] = useState<JobMatch[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedJobs();
  }, []);

  // Auto-select jobs from query params
  useEffect(() => {
    const jobIds = searchParams.get('jobs')?.split(',') || [];
    if (jobIds.length > 0 && savedJobs.length > 0) {
      const selected = savedJobs.filter(job => jobIds.includes(job.job.jobId));
      setSelectedJobs(selected.slice(0, 3)); // Max 3 jobs
    }
  }, [searchParams, savedJobs]);

  async function loadSavedJobs() {
    try {
      const response = await getSavedJobs();
      setSavedJobs(response.jobs);
    } catch (error) {
      console.error('Failed to load saved jobs:', error);
      toast.error('Unable to load saved jobs');
    } finally {
      setLoading(false);
    }
  }

  function toggleJobSelection(job: JobMatch) {
    if (selectedJobs.find(j => j.job.jobId === job.job.jobId)) {
      setSelectedJobs(selectedJobs.filter(j => j.job.jobId !== job.job.jobId));
    } else if (selectedJobs.length < 3) {
      setSelectedJobs([...selectedJobs, job]);
    } else {
      toast.error('You can only compare up to 3 jobs at once');
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Loading saved jobs...</p>
        </div>
      </div>
    );
  }

  if (savedJobs.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <ChartBarSquareIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Saved Jobs to Compare</h2>
          <p className="text-gray-600 mb-6">
            Save at least 2 jobs to use the comparison feature
          </p>
          <Link to="/setup" className="btn-primary">
            Discover Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Compare Jobs</h1>
          <p className="text-gray-600">
            Select up to 3 jobs to compare side-by-side
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/saved-jobs"
            className="btn-secondary flex items-center gap-2"
          >
            <BookmarkIcon className="w-5 h-5" />
            Saved Jobs
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

      {/* Job Selection */}
      {selectedJobs.length < 3 && (
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3">
            Select Jobs to Compare ({selectedJobs.length}/3)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedJobs
              .filter(job => !selectedJobs.find(s => s.job.jobId === job.job.jobId))
              .map((job) => (
                <button
                  key={job.job.jobId}
                  onClick={() => toggleJobSelection(job)}
                  className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <div className="font-medium text-gray-900 mb-1">{job.job.title}</div>
                  <div className="text-sm text-gray-600">{job.job.company}</div>
                  <div className="mt-2 inline-block px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                    {Math.round(job.fitAnalysis.overallMatch)}% Match
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {selectedJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700 w-48">Criteria</th>
                  {selectedJobs.map((match) => (
                    <th key={match.job.jobId} className="p-4 text-left min-w-[280px]">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">
                            {match.job.title}
                          </div>
                          <div className="text-sm text-gray-600">{match.job.company}</div>
                        </div>
                        <button
                          onClick={() => toggleJobSelection(match)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Overall Match */}
                <ComparisonRow
                  label="Overall Match"
                  icon={<CheckCircleIcon className="w-5 h-5 text-primary-500" />}
                >
                  {selectedJobs.map((match) => (
                    <div key={match.job.jobId} className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: `${match.fitAnalysis.overallMatch}%` }}
                        />
                      </div>
                      <span className="font-semibold text-primary-600">
                        {Math.round(match.fitAnalysis.overallMatch)}%
                      </span>
                    </div>
                  ))}
                </ComparisonRow>

                {/* Location */}
                <ComparisonRow
                  label="Location"
                  icon={<MapPinIcon className="w-5 h-5 text-gray-500" />}
                >
                  {selectedJobs.map((match) => (
                    <div key={match.job.jobId}>
                      <div className="font-medium text-gray-900">{match.job.location}</div>
                      <div className="text-sm text-gray-600 capitalize">{match.job.remoteType}</div>
                    </div>
                  ))}
                </ComparisonRow>

                {/* Salary */}
                <ComparisonRow
                  label="Salary Range"
                  icon={<CurrencyDollarIcon className="w-5 h-5 text-green-500" />}
                >
                  {selectedJobs.map((match) => (
                    <div key={match.job.jobId} className="font-medium text-gray-900">
                      {match.job.salaryRange
                        ? `$${match.job.salaryRange.minSalary?.toLocaleString()} - $${match.job.salaryRange.maxSalary?.toLocaleString()}`
                        : 'Not disclosed'}
                    </div>
                  ))}
                </ComparisonRow>

                {/* Employment Type */}
                <ComparisonRow
                  label="Employment Type"
                  icon={<BuildingOfficeIcon className="w-5 h-5 text-blue-500" />}
                >
                  {selectedJobs.map((match) => (
                    <div key={match.job.jobId} className="capitalize text-gray-900">
                      {match.job.employmentType}
                    </div>
                  ))}
                </ComparisonRow>

                {/* Skills Match */}
                <ComparisonRow label="Skills Match">
                  {selectedJobs.map((match) => (
                    <div key={match.job.jobId}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${match.fitAnalysis.skillMatch}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-green-600">
                          {Math.round(match.fitAnalysis.skillMatch)}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {match.fitAnalysis.skillMatches?.length || 0} matching skills
                      </div>
                    </div>
                  ))}
                </ComparisonRow>

                {/* Experience Match */}
                <ComparisonRow label="Experience Match">
                  {selectedJobs.map((match) => (
                    <div key={match.job.jobId}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${match.fitAnalysis.experienceMatch}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-purple-600">
                          {Math.round(match.fitAnalysis.experienceMatch)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </ComparisonRow>

                {/* Top Strengths */}
                <ComparisonRow label="Your Strengths for Role">
                  {selectedJobs.map((match) => (
                    <ul key={match.job.jobId} className="space-y-1">
                      {match.fitAnalysis.strengthsForRole.slice(0, 3).map((strength, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  ))}
                </ComparisonRow>

                {/* Potential Concerns */}
                <ComparisonRow label="Potential Concerns">
                  {selectedJobs.map((match) => (
                    <ul key={match.job.jobId} className="space-y-1">
                      {match.fitAnalysis.potentialConcerns.slice(0, 3).map((concern, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <XCircleIcon className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  ))}
                </ComparisonRow>

                {/* Interview Prep Priority */}
                <ComparisonRow label="Top Prep Focus">
                  {selectedJobs.map((match) => (
                    <div key={match.job.jobId} className="space-y-1">
                      {match.fitAnalysis.preparationPriority.slice(0, 2).map((item, i) => (
                        <div key={i} className="text-sm">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              item.urgency === 'high'
                                ? 'bg-red-100 text-red-700'
                                : item.urgency === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.topic}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </ComparisonRow>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedJobs.length > 0 && (
        <div className="mt-8 flex justify-center gap-4">
          {selectedJobs.map((match) => (
            <Link
              key={match.job.jobId}
              to="/setup"
              state={{ selectedJob: match }}
              className="btn-primary px-6"
            >
              Practice for {match.job.company}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface ComparisonRowProps {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode[];
}

function ComparisonRow({ label, icon, children }: ComparisonRowProps) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="p-4 font-medium text-gray-700">
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
      </td>
      {children.map((child, index) => (
        <td key={index} className="p-4">
          {child}
        </td>
      ))}
    </tr>
  );
}
