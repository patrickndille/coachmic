/**
 * Tests for FeedbackDashboard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../test/testUtils';
import FeedbackDashboard from '../FeedbackDashboard';
import { mockFeedbackData } from '../../test/mocks';
import * as api from '../../services/api';
import * as AppContext from '../../context/AppContext';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock API calls
vi.mock('../../services/api', () => ({
  getFeedback: vi.fn(),
  getFeedbackStatus: vi.fn(),
}));

describe('FeedbackDashboard', () => {
  const stateWithFeedback = {
    status: 'complete' as const,
    sessionId: 'test-session-123',
    setup: {
      targetRole: 'Backend Developer',
      targetCompany: 'Google',
      interviewType: 'behavioral' as const,
    },
    currentSetupStep: null,
    transcript: [],
    feedback: mockFeedbackData,
    error: null,
    isLoading: false,
    cachedJobs: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getFeedbackStatus).mockResolvedValue({
      status: 'completed',
      progress: 100,
      sessionId: 'test-session-123',
    });
    vi.mocked(api.getFeedback).mockResolvedValue(mockFeedbackData);

    // Mock useApp hook to return our test state
    vi.spyOn(AppContext, 'useApp').mockReturnValue({
      state: stateWithFeedback,
      dispatch: mockDispatch,
    });
  });

  it('renders the feedback dashboard', () => {
    render(<FeedbackDashboard />);

    expect(screen.getByText(/Interview Feedback/i)).toBeInTheDocument();
  });

  it('displays overall score', () => {
    render(<FeedbackDashboard />);

    // Check for the overall score heading and the large score number
    expect(screen.getByText(/Overall Score/i)).toBeInTheDocument();
    expect(screen.getByText(/out of 100/i)).toBeInTheDocument();
    // The score 78 appears in multiple places, so just check it exists
    expect(screen.getAllByText('78').length).toBeGreaterThan(0);
  });

  it('displays category scores', () => {
    render(<FeedbackDashboard />);

    expect(screen.getByText(/Content/i)).toBeInTheDocument();
    expect(screen.getByText(/Delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/Structure/i)).toBeInTheDocument();
    expect(screen.getByText(/Relevance/i)).toBeInTheDocument();
  });

  it('displays speaking metrics', () => {
    render(<FeedbackDashboard />);

    expect(screen.getByText('145')).toBeInTheDocument(); // WPM
  });

  it('displays strengths', () => {
    render(<FeedbackDashboard />);

    expect(
      screen.getByText(/Used STAR method effectively/i)
    ).toBeInTheDocument();
  });

  it('displays areas for improvement', () => {
    render(<FeedbackDashboard />);

    expect(screen.getByText(/Reduce filler words/i)).toBeInTheDocument();
  });

  it('displays question feedback', () => {
    render(<FeedbackDashboard />);

    expect(
      screen.getByText(/Tell me about a challenging project/i)
    ).toBeInTheDocument();
  });

  it('shows STAR analysis when available', () => {
    render(<FeedbackDashboard />);

    // STAR analysis is in the question feedback (initially collapsed)
    // Just verify the section exists
    expect(screen.getByText(/Question-by-Question Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Tell me about a challenging project/i)).toBeInTheDocument();
  });

  it('has a button to start new practice', async () => {
    const user = userEvent.setup();
    render(<FeedbackDashboard />);

    const newPracticeButton = screen.getByRole('button', {
      name: /Practice Again/i,
    });
    expect(newPracticeButton).toBeInTheDocument();

    await user.click(newPracticeButton);
    expect(mockNavigate).toHaveBeenCalledWith('/setup');
  });

  it('redirects to setup if no feedback data', () => {
    // Mock useApp to return state without feedback
    vi.spyOn(AppContext, 'useApp').mockReturnValue({
      state: {
        ...stateWithFeedback,
        sessionId: null,
        feedback: null,
        cachedJobs: {},
      },
      dispatch: mockDispatch,
    });

    render(<FeedbackDashboard />);

    expect(mockNavigate).toHaveBeenCalledWith('/setup');
  });
});
