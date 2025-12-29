/**
 * Tests for LandingPage component
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../test/testUtils';
import LandingPage from '../LandingPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LandingPage', () => {
  it('renders the landing page', () => {
    render(<LandingPage />);

    expect(
      screen.getByText(/Practice Interviews Out Loud/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Get AI Feedback. Land the Job./i)).toBeInTheDocument();
  });

  it('displays value propositions', () => {
    render(<LandingPage />);

    expect(screen.getByText('Voice-First')).toBeInTheDocument();
    expect(screen.getByText('Resume-Aware')).toBeInTheDocument();
    expect(screen.getByText('Real Feedback')).toBeInTheDocument();
  });

  it('shows the CTA button', () => {
    render(<LandingPage />);

    const ctaButton = screen.getByRole('button', {
      name: /Start Free Practice/i,
    });
    expect(ctaButton).toBeInTheDocument();
  });

  it('navigates to setup when CTA is clicked', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    const ctaButton = screen.getByRole('button', {
      name: /Start Free Practice/i,
    });

    await user.click(ctaButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/setup');
    });
  });

  it('displays trust indicators', () => {
    render(<LandingPage />);

    // Check for the trust indicator text in the hero section
    expect(screen.getByText(/No account required • 5-minute interview • Instant feedback/i)).toBeInTheDocument();
  });

  it('displays the hero icon', () => {
    render(<LandingPage />);

    // The hero now uses MicrophoneIcon from Heroicons
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});
