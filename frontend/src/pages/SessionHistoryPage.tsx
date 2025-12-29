import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { getSessionHistory, deleteSession } from '../services/api';
import { SessionSummary } from '../types';
import { ChartBarIcon, CalendarIcon, BriefcaseIcon, ClipboardDocumentListIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ScoreTrendChart } from '../components/history/ScoreTrendChart';

export default function SessionHistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      const data = await getSessionHistory(20, 0);
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (error) {
      console.error('[History] Failed to load:', error);
      toast.error('Failed to load session history');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Your Interviews</h1>
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Your Interviews</h1>
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <ClipboardDocumentListIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No interviews yet</h2>
          <p className="text-gray-600 mb-6">Complete your first interview to see your progress here!</p>
          <Link to="/setup" className="btn-primary inline-block">
            Start Your First Interview
          </Link>
        </div>
      </div>
    );
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) {
      return;
    }

    try {
      await deleteSession(sessionId);
      setSessions(sessions.filter(s => s.sessionId !== sessionId));
      setTotal(prev => prev - 1);
      toast.success('Session deleted');
    } catch (error) {
      console.error('[History] Delete failed:', error);
      toast.error('Failed to delete session');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Your Interviews</h1>
        <p className="text-gray-600">
          {total} {total === 1 ? 'interview' : 'interviews'} completed
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Interviews"
          value={total}
          icon={<ChartBarIcon className="h-6 w-6" />}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Average Score"
          value={calculateAverageScore(sessions)}
          icon={<ChartBarIcon className="h-6 w-6" />}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          title="This Month"
          value={calculateThisMonth(sessions)}
          icon={<CalendarIcon className="h-6 w-6" />}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Score Trend Chart */}
      <div className="mb-8">
        <ScoreTrendChart sessions={sessions} />
      </div>

      {/* Session List */}
      <div className="space-y-4">
        {sessions.map((session) => (
          <SessionCard
            key={session.sessionId}
            session={session}
            onDelete={handleDeleteSession}
          />
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

interface SessionCardProps {
  session: SessionSummary;
  onDelete: (sessionId: string) => void;
}

function SessionCard({ session, onDelete }: SessionCardProps) {
  const date = new Date(session.createdAt);
  const formattedDate = format(date, 'MMM d, yyyy');
  const formattedTime = format(date, 'h:mm a');

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Session Info */}
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <BriefcaseIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{session.targetRole}</h3>
              {session.targetCompany && (
                <p className="text-gray-600">{session.targetCompany}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
                <span>{formattedDate} • {formattedTime}</span>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                  {session.interviewType}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(session.status)}`}>
                  {getStatusLabel(session.status)}
                </span>
                {session.hasResumeData && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    Resume Analyzed
                  </span>
                )}
                {session.hasImprovedResume && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                    Resume Improved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Score & Actions */}
        <div className="flex items-center gap-4">
          {session.overallScore !== undefined && session.overallScore !== null && (
            <div className="text-right">
              <div className="text-3xl font-bold text-primary-600">{session.overallScore}</div>
              <p className="text-xs text-gray-600">Overall Score</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {/* Not Started - show Continue Session */}
            {session.status === 'created' && (
              <button
                onClick={() => continueSession(session)}
                className="btn-primary text-sm"
              >
                Continue Session
              </button>
            )}

            {/* In Progress or Paused - show Resume Session */}
            {(session.status === 'interviewing' || session.status === 'paused') && (
              <button
                onClick={() => resumeSession(session)}
                className="btn-primary text-sm"
              >
                Resume Session
              </button>
            )}

            {/* Completed with feedback - show View Feedback */}
            {session.status === 'completed' && session.overallScore !== undefined && (
              <Link
                to={`/feedback?session=${session.sessionId}`}
                className="btn-secondary text-sm"
              >
                View Feedback
              </Link>
            )}

            {/* Completed - show Practice Again */}
            {session.status === 'completed' && (
              <button
                onClick={() => retrySession(session)}
                className="btn-outline text-sm"
              >
                Practice Again
              </button>
            )}

            <button
              onClick={() => onDelete(session.sessionId)}
              className="flex items-center justify-center gap-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
              title="Delete session"
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'interviewing':
      return 'bg-blue-100 text-blue-700';
    case 'paused':
      return 'bg-yellow-100 text-yellow-700';
    case 'created':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'interviewing':
      return 'In Progress';
    case 'paused':
      return 'Paused';
    case 'created':
      return 'Not Started';
    default:
      return status;
  }
}

function calculateAverageScore(sessions: SessionSummary[]): string {
  const sessionsWithScores = sessions.filter(
    (s) => s.overallScore !== undefined && s.overallScore !== null
  );

  if (sessionsWithScores.length === 0) {
    return 'N/A';
  }

  const total = sessionsWithScores.reduce((sum, s) => sum + (s.overallScore || 0), 0);
  const average = Math.round(total / sessionsWithScores.length);
  return average.toString();
}

function calculateThisMonth(sessions: SessionSummary[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return sessions.filter((s) => {
    const sessionDate = new Date(s.createdAt);
    return sessionDate >= startOfMonth;
  }).length;
}

function retrySession(session: SessionSummary) {
  // For completed sessions - create NEW session with cloned data
  window.location.href = `/setup?clone=${session.sessionId}`;
}

function continueSession(session: SessionSummary) {
  // For "created" (Not Started) sessions - load SAME session, no cloning
  window.location.href = `/setup?continue=${session.sessionId}`;
}

function resumeSession(session: SessionSummary) {
  // For "interviewing" or "paused" sessions - go directly to interview room
  window.location.href = `/interview?session=${session.sessionId}`;
}
