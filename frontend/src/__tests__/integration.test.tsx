/**
 * Integration tests for user flows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

// Mock axios before importing anything else
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  return {
    default: {
      ...mockAxiosInstance,
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

import { render } from '../test/testUtils';
import App from '../App';
import axios from 'axios';

// Store mocked axios for potential use in tests
vi.mocked(axios);

describe('User Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('renders the app', () => {
    render(<App />);

    // App should render without crashing
    expect(screen.getByText(/Practice Interviews Out Loud/i)).toBeInTheDocument();
  });

  it('shows landing page by default', () => {
    render(<App />);

    // Should start on landing page
    expect(screen.getByText(/Practice Interviews Out Loud/i)).toBeInTheDocument();
    expect(screen.getByText(/Get AI Feedback. Land the Job./i)).toBeInTheDocument();
  });
});

describe('State Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('loads initial state from localStorage', () => {
    const savedState = {
      version: 1,
      sessionId: 'test-123',
      setup: {
        targetRole: 'Backend Developer',
        targetCompany: 'Google',
        interviewType: 'behavioral',
      },
      status: 'idle',
      transcript: [],
      feedback: null,
    };

    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(savedState));

    render(<App />);

    // App should load state from localStorage and render landing page
    expect(screen.getByText(/Practice Interviews Out Loud/i)).toBeInTheDocument();
  });
});
