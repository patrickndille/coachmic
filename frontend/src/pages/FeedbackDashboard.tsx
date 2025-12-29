import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { getFeedback, getFeedbackStatus } from '../services/api';
import { FeedbackData, QuestionFeedback } from '../types';
import { HelpTooltip } from '../components/common';
import { helpContent } from '../utils/helpContent';
import { SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type FeedbackStatus = 'loading' | 'processing' | 'ready' | 'error';

export default function FeedbackDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, dispatch } = useApp();
  const [status, setStatus] = useState<FeedbackStatus>('loading');
  const [progress, setProgress] = useState(0);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [historicalFeedback, setHistoricalFeedback] = useState<FeedbackData | null>(null);

  // Get session ID from URL param (for history) or fall back to current state
  const urlSessionId = searchParams.get('session');
  const sessionId = urlSessionId || state.sessionId;

  // Track if we're viewing a historical session (not the current one)
  const isHistoricalView = !!(urlSessionId && urlSessionId !== state.sessionId);

  // Poll for feedback status
  const checkFeedbackStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await getFeedbackStatus(sessionId);

      if (response.status === 'completed') {
        // Fetch the complete feedback
        const feedbackData = await getFeedback(sessionId);

        if (isHistoricalView) {
          // Store historical feedback in local state (don't pollute global state)
          setHistoricalFeedback(feedbackData);
        } else {
          // Store current session feedback in global state
          dispatch({ type: 'SET_FEEDBACK', payload: feedbackData });
          dispatch({ type: 'SET_STATUS', payload: 'complete' });
        }
        setStatus('ready');
      } else if (response.status === 'processing') {
        setProgress(response.progress || 0);
        setStatus('processing');
        // Continue polling
        setTimeout(checkFeedbackStatus, 2000);
      } else if (response.status === 'failed') {
        setStatus('error');
        toast.error('Failed to generate feedback. Please try again.');
      }
    } catch (error) {
      console.error('Error checking feedback status:', error);
      // If we already have feedback, use it
      const existingFeedback = isHistoricalView ? historicalFeedback : state.feedback;
      if (existingFeedback) {
        setStatus('ready');
      } else {
        setStatus('error');
      }
    }
  }, [sessionId, isHistoricalView, state.feedback, historicalFeedback, dispatch]);

  // Initial load - runs when session ID changes or when viewing historical feedback
  useEffect(() => {
    // Reset historical feedback when URL changes
    if (isHistoricalView) {
      setHistoricalFeedback(null);
      setStatus('loading');
      checkFeedbackStatus();
    } else if (state.feedback) {
      // Use cached feedback for current session
      setStatus('ready');
    } else if (sessionId) {
      checkFeedbackStatus();
    } else {
      navigate('/setup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, navigate]);

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  // Render loading state
  if (status === 'loading' || status === 'processing') {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Analyzing Your Interview</h2>
          <p className="text-gray-600 mb-4">
            Our AI is reviewing your responses and generating personalized feedback...
          </p>
          {status === 'processing' && (
            <div className="w-64 mx-auto">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{progress}% complete</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">😔</span>
          <h2 className="text-xl font-semibold mb-2">Unable to Generate Feedback</h2>
          <p className="text-gray-600 mb-6">
            We encountered an issue analyzing your interview. Please try again.
          </p>
          <div className="flex justify-center gap-4">
            <button onClick={checkFeedbackStatus} className="btn-primary">
              Retry
            </button>
            <button onClick={() => navigate('/setup')} className="btn-secondary">
              Start New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use historical feedback when viewing from history, otherwise use current session feedback
  const feedback = (isHistoricalView ? historicalFeedback : state.feedback) as FeedbackData;

  // Safety check - if feedback is null (e.g., after reset), don't render
  if (!feedback) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Feedback</h1>
          <p className="text-gray-600">
            {/* Use feedback data for role/company (supports historical sessions) */}
            {feedback.targetRole || state.setup.targetRole}
            {(feedback.targetCompany || state.setup.targetCompany) &&
              ` at ${feedback.targetCompany || state.setup.targetCompany}`}
          </p>
        </div>

        {/* Overall Score Card */}
        <div className="card mb-8 text-center">
          <h2 className="text-lg font-medium text-gray-600 mb-2">Overall Score</h2>
          <div
            className={`text-6xl font-bold mb-2 ${getScoreColor(feedback.overallScore)}`}
          >
            {feedback.overallScore}
          </div>
          <p className="text-gray-500">out of 100</p>

          {/* Category Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-sm text-gray-500">Content</p>
              <p className={`text-2xl font-semibold ${getScoreColor(feedback.categoryScores.content)}`}>
                {feedback.categoryScores.content}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivery</p>
              <p className={`text-2xl font-semibold ${getScoreColor(feedback.categoryScores.delivery)}`}>
                {feedback.categoryScores.delivery}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Structure</p>
              <p className={`text-2xl font-semibold ${getScoreColor(feedback.categoryScores.structure)}`}>
                {feedback.categoryScores.structure}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Relevance</p>
              <p className={`text-2xl font-semibold ${getScoreColor(feedback.categoryScores.relevance)}`}>
                {feedback.categoryScores.relevance}
              </p>
            </div>
          </div>
        </div>

        {/* Speaking Metrics */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold mb-4">Speaking Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm text-gray-500">Words per Minute</p>
                <HelpTooltip {...helpContent.speakingMetrics.wpm} />
              </div>
              <p className="text-2xl font-semibold">
                {feedback.speakingMetrics.wordsPerMinute}
              </p>
              <p className="text-xs text-gray-400">Target: 120-150 WPM</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm text-gray-500">Filler Words</p>
                <HelpTooltip {...helpContent.speakingMetrics.fillerWords} />
              </div>
              <p className="text-2xl font-semibold">
                {feedback.speakingMetrics.fillerWordCount}
              </p>
              <p className="text-xs text-gray-400">
                Common: {feedback.speakingMetrics.fillerWords.slice(0, 3).join(', ')}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm text-gray-500">Avg. Response Time</p>
                <HelpTooltip {...helpContent.speakingMetrics.responseTime} />
              </div>
              <p className="text-2xl font-semibold">
                {feedback.speakingMetrics.averageResponseTime}s
              </p>
              <p className="text-xs text-gray-400">Time before answering</p>
            </div>
          </div>
        </div>

        {/* Strengths & Areas for Improvement */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-500" /> Strengths
            </h2>
            <ul className="space-y-2">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-yellow-500">△</span> Areas to Improve
            </h2>
            <ul className="space-y-2">
              {feedback.areasForImprovement.map((area, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Question-by-Question Feedback */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold mb-4">Question-by-Question Analysis</h2>
          <div className="space-y-4">
            {feedback.questionFeedback.map((qf: QuestionFeedback, index: number) => (
              <div
                key={qf.questionId}
                className="border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedQuestion(
                      expandedQuestion === qf.questionId ? null : qf.questionId
                    )
                  }
                  className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${getScoreBg(
                        qf.score
                      )} ${getScoreColor(qf.score)}`}
                    >
                      {qf.score}
                    </span>
                    <div>
                      <p className="font-medium">Question {index + 1}</p>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {qf.question}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400">
                    {expandedQuestion === qf.questionId ? (
                      <ChevronUpIcon className="w-5 h-5" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5" />
                    )}
                  </span>
                </button>

                {expandedQuestion === qf.questionId && (
                  <div className="p-4 border-t bg-white">
                    <div className="mb-4">
                      <p className="font-medium text-gray-700 mb-1">Question:</p>
                      <p className="text-gray-600">{qf.question}</p>
                    </div>

                    <div className="mb-4">
                      <p className="font-medium text-gray-700 mb-1">Your Answer:</p>
                      <p className="text-gray-600 bg-gray-50 p-3 rounded">
                        {qf.userResponse}
                      </p>
                    </div>

                    {qf.starAnalysis && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-gray-700">STAR Analysis:</p>
                          <HelpTooltip {...helpContent.starMethod} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2 bg-blue-50 rounded">
                            <p className="text-xs font-medium text-blue-700">Situation</p>
                            <p className="text-sm">
                              {qf.starAnalysis.situation || 'Not detected'}
                            </p>
                          </div>
                          <div className="p-2 bg-green-50 rounded">
                            <p className="text-xs font-medium text-green-700">Task</p>
                            <p className="text-sm">{qf.starAnalysis.task || 'Not detected'}</p>
                          </div>
                          <div className="p-2 bg-yellow-50 rounded">
                            <p className="text-xs font-medium text-yellow-700">Action</p>
                            <p className="text-sm">
                              {qf.starAnalysis.action || 'Not detected'}
                            </p>
                          </div>
                          <div className="p-2 bg-purple-50 rounded">
                            <p className="text-xs font-medium text-purple-700">Result</p>
                            <p className="text-sm">
                              {qf.starAnalysis.result || 'Not detected'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="font-medium text-gray-700 mb-1">Feedback:</p>
                      <p className="text-gray-600">{qf.feedback}</p>
                    </div>

                    {qf.suggestedImprovement && (
                      <div className="mt-3 p-3 bg-primary-50 rounded">
                        <p className="text-sm font-medium text-primary-700">
                          Suggested Improvement:
                        </p>
                        <p className="text-sm text-primary-600">{qf.suggestedImprovement}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Coach Access Card */}
        <div className="card mb-8 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-start gap-4">
            <SparklesIcon className="w-10 h-10 text-primary-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Want to Improve Your Answers?</h3>
              <p className="text-gray-600 text-sm mb-3">
                Work with our AI coach to understand your feedback, practice better versions of your
                answers, and create an action plan for your next interview.
              </p>
              <button
                onClick={() => navigate('/coach?type=post_interview')}
                className="btn-primary"
              >
                Start Coaching Session
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              // Navigate to setup with restore param to clone session data
              // This allows user to practice the same role/company again
              // SetupWizard will create a NEW session with the cloned data
              const sessionToRestore = sessionId;
              navigate(`/setup?restore=${sessionToRestore}`);
            }}
            className="btn-primary"
          >
            Practice Again
          </button>
          <button
            onClick={() => navigate('/coach?type=pre_interview')}
            className="btn-secondary"
          >
            Pre-Interview Coaching
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
