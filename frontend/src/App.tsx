import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProductTour } from './components/onboarding/ProductTour';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import SetupWizard from './pages/SetupWizard';
import InterviewScreen from './pages/InterviewScreen';
import TextInterviewScreen from './pages/TextInterviewScreen';
import FeedbackDashboard from './pages/FeedbackDashboard';
import CoachScreen from './pages/CoachScreen';
import SettingsPage from './pages/SettingsPage';
import GuidePage from './pages/GuidePage';
import SessionHistoryPage from './pages/SessionHistoryPage';
import SavedJobsPage from './pages/SavedJobsPage';
import JobComparisonPage from './pages/JobComparisonPage';
import JobDetailsPage from './pages/JobDetailsPage';
import ResumeManagementPage from './pages/ResumeManagementPage';

function App() {
  return (
    <AuthProvider>
      <ProductTour />
      <Layout>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/guide/:section" element={<GuidePage />} />
          <Route path="/signin" element={<SignInPage />} />

          {/* Protected routes - require authentication */}
          <Route
            path="/setup"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <SetupWizard />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/interview"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <InterviewScreen />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/text-interview"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <TextInterviewScreen />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/feedback"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <FeedbackDashboard />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/coach"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <CoachScreen />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <SettingsPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/resume"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <ResumeManagementPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <SessionHistoryPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/saved-jobs"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <SavedJobsPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/compare-jobs"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <JobComparisonPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/job/:jobId"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <JobDetailsPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

export default App;
