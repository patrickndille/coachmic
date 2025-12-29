import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TOUR_KEY = 'coachmic_tour_completed';
const LANDING_TOUR_KEY = 'coachmic_landing_tour_shown';

// Landing page tour - just welcome
const landingSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div>
        <h2 className="text-xl font-bold mb-2">Welcome to CoachMic! 👋</h2>
        <p className="mb-3">Your AI-powered interview coach that helps you practice and improve your interview skills.</p>
        <p className="text-sm text-gray-600">Click "Start Free Practice" to begin your journey!</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
];

// Setup page tour - detailed walkthrough
const setupSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div>
        <h2 className="text-xl font-bold mb-2">Let's Set Up Your Interview! 🎯</h2>
        <p>We'll walk you through the setup process step by step.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="resume-upload"]',
    content: (
      <div>
        <p className="font-medium mb-1">📄 Upload Your Resume</p>
        <p className="text-sm">Our AI will analyze it and create personalized interview questions based on YOUR experience.</p>
      </div>
    ),
    disableBeacon: true,
    disableScrolling: false,
  },
  {
    target: '[data-tour="job-discovery"]',
    content: (
      <div>
        <p className="font-medium mb-1">💼 Discover Matching Jobs</p>
        <p className="text-sm">Find real job opportunities that match your skills. Practice for specific roles you're interested in!</p>
      </div>
    ),
    disableBeacon: true,
    disableScrolling: false,
  },
  {
    target: '[data-tour="interview-config"]',
    content: (
      <div>
        <p className="font-medium mb-1">⚙️ Configure Your Interview</p>
        <p className="text-sm">Choose your target role, company, and interview type (behavioral, technical, or mixed).</p>
      </div>
    ),
    disableBeacon: true,
    disableScrolling: false,
  },
  {
    target: '[data-tour="start-interview"]',
    content: (
      <div>
        <p className="font-medium mb-1">🎤 Start Your Practice Interview</p>
        <p className="text-sm">Click here when you're ready! Speak naturally - our AI interviewer will listen and respond just like a real interview.</p>
      </div>
    ),
    disableBeacon: true,
    disableScrolling: false,
  },
];

export function ProductTour() {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const isLandingPage = location.pathname === '/';
    const isSetupPage = location.pathname === '/setup';
    const tourCompleted = localStorage.getItem(TOUR_KEY);
    const landingTourShown = localStorage.getItem(LANDING_TOUR_KEY);

    // Reset state when changing pages
    setRun(false);
    setStepIndex(0);

    if (isLandingPage && !landingTourShown) {
      // Show welcome tour on landing page (first visit only)
      const timer = setTimeout(() => {
        setSteps(landingSteps);
        setRun(true);
      }, 800);
      return () => clearTimeout(timer);
    } else if (isSetupPage && !tourCompleted) {
      // Show setup tour when user navigates to setup page
      const timer = setTimeout(() => {
        setSteps(setupSteps);
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const handleCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    const isLandingPage = location.pathname === '/';
    const isSetupPage = location.pathname === '/setup';

    // Handle step changes
    if (type === 'step:after') {
      if (action === 'next') {
        setStepIndex(index + 1);
      } else if (action === 'prev') {
        setStepIndex(index - 1);
      }
    }

    // Handle tour completion
    if (finishedStatuses.includes(status)) {
      if (isLandingPage) {
        localStorage.setItem(LANDING_TOUR_KEY, 'true');
      } else if (isSetupPage) {
        localStorage.setItem(TOUR_KEY, 'true');
      }
      setRun(false);
      setStepIndex(0);
    }

    // Handle close/skip
    if (action === 'close' || action === 'skip') {
      if (isLandingPage) {
        localStorage.setItem(LANDING_TOUR_KEY, 'true');
      } else if (isSetupPage) {
        localStorage.setItem(TOUR_KEY, 'true');
      }
      setRun(false);
      setStepIndex(0);
    }
  };

  // Only render on landing or setup pages
  if (location.pathname !== '/' && location.pathname !== '/setup') {
    return null;
  }

  if (steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      scrollOffset={100}
      callback={handleCallback}
      floaterProps={{
        disableAnimation: true,
      }}
      styles={{
        options: {
          primaryColor: '#4F46E5',
          zIndex: 10000,
          arrowColor: '#fff',
          backgroundColor: '#fff',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          textColor: '#1a1a2e',
        },
        buttonNext: {
          backgroundColor: '#4F46E5',
          fontSize: '14px',
          borderRadius: '6px',
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#64748b',
          fontSize: '14px',
        },
        buttonSkip: {
          color: '#94a3b8',
          fontSize: '14px',
        },
        tooltip: {
          borderRadius: '8px',
          padding: '16px',
        },
        tooltipContent: {
          padding: '8px 0',
        },
        spotlight: {
          borderRadius: '8px',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Got it!',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
}
