import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getActiveSession } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CreateSessionResponse } from '../types';

export function useActiveSession() {
  const [activeSession, setActiveSession] = useState<CreateSessionResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { state } = useApp();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for active session on mount and when sessionId changes
  // Wait for auth to be ready before making API calls
  useEffect(() => {
    // Don't check if auth is still loading or user is not authenticated
    if (authLoading) {
      console.log('[useActiveSession] Waiting for auth to initialize...');
      return;
    }

    if (!isAuthenticated) {
      console.log('[useActiveSession] User not authenticated, skipping session check');
      setActiveSession(null);
      return;
    }

    const checkActiveSession = async () => {
      try {
        setIsChecking(true);
        const session = await getActiveSession();
        setActiveSession(session);
      } catch (error) {
        console.error('[useActiveSession] Error checking active session:', error);
        setActiveSession(null);
      } finally {
        setIsChecking(false);
      }
    };

    checkActiveSession();
    // Re-check when route changes (e.g., after interview ends and navigates to /feedback)
    // This ensures we detect when session status changes to "completed"
  }, [state.sessionId, isAuthenticated, authLoading, location.pathname]);

  // Manual refresh function - can be called after interview ends
  const refreshActiveSession = useCallback(async () => {
    try {
      setIsChecking(true);
      const session = await getActiveSession();
      setActiveSession(session);
    } catch (error) {
      // 404 = no active session, which is expected after completion
      setActiveSession(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const resumeSession = () => {
    // Only navigate if there's an actual active session from backend
    if (!activeSession) {
      console.log('[useActiveSession] No active session to resume');
      return;
    }

    // Use session status and interview mode to determine destination
    switch (activeSession.status) {
      case 'interviewing':
      case 'paused':
        // Route based on interview mode
        if (activeSession.interviewMode === 'text') {
          navigate('/text-interview');
        } else {
          navigate('/interview');
        }
        break;
      case 'coaching':
        navigate('/coaching');
        break;
      case 'created':
      default:
        // Use ?continue= to load the same session without creating a new one
        navigate(`/setup?continue=${activeSession.sessionId}`);
        break;
    }
  };

  // Only consider it an "active session" if backend returned one
  // Active statuses: created, interviewing, paused, coaching (NOT completed)
  const hasActiveSession = Boolean(activeSession);

  // Separate flag for when user has recent feedback to view
  const hasFeedbackToView = Boolean(state.feedback);

  return {
    activeSession,
    hasActiveSession,
    hasFeedbackToView,
    resumeSession,
    refreshActiveSession,
    isChecking,
  };
}
