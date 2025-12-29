import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QuestionMarkCircleIcon, UserCircleIcon, ChartBarIcon, PlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { MicrophoneIcon } from '@heroicons/react/24/solid';
import { Menu } from '@headlessui/react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useActiveSession } from '../../hooks/useActiveSession';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { userProfile, isAuthenticated, signOut } = useAuth();
  const { hasActiveSession, hasFeedbackToView, resumeSession, isChecking } = useActiveSession();
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);

  const isInterviewActive = state.status === 'interviewing';

  function handleNewSession() {
    dispatch({ type: 'RESET_SESSION' });
    localStorage.removeItem('coachmic_session');
    setShowNewSessionModal(false);
    navigate('/setup');
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-[60]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-2 lg:pr-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1">
            <MicrophoneIcon className="w-8 h-8 text-primary-600" />
            <span className="font-semibold text-xl text-gray-900">CoachMic</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2 sm:gap-4">
            {isInterviewActive && (
              <span className="flex items-center gap-1 sm:gap-2 text-sm text-green-600" title="Interview in Progress">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="hidden sm:inline">Interview in Progress</span>
              </span>
            )}

            {/* Leave Room button - visible on Interview and Text Interview pages */}
            {(location.pathname === '/interview' || location.pathname === '/text-interview') && (
              <button
                onClick={() => navigate('/setup?step=type')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Leave Interview Room"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Leave Room</span>
              </button>
            )}

            {isAuthenticated && hasActiveSession && location.pathname !== '/setup' && location.pathname !== '/interview' && location.pathname !== '/text-interview' && (
              <button
                onClick={resumeSession}
                disabled={isChecking}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50"
                title="Continue Session"
              >
                <MicrophoneIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Continue Session</span>
              </button>
            )}

            {isAuthenticated && location.pathname !== '/' && !isInterviewActive && (
              <button
                onClick={() => setShowNewSessionModal(true)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                title="New Session"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden sm:inline">New Session</span>
              </button>
            )}

            {isAuthenticated && hasFeedbackToView && location.pathname !== '/feedback' && (
              <Link
                to="/feedback"
                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                title="View Feedback"
              >
                <ChartBarIcon className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">View Feedback</span>
              </Link>
            )}

            <Link
              to="/guide"
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              <QuestionMarkCircleIcon className="w-4 h-4" />
              <span className="hidden sm:inline">User Guide</span>
            </Link>

            {/* User Menu or Sign In */}
            {isAuthenticated ? (
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none">
                  {userProfile?.photoURL ? (
                    <img
                      src={userProfile.photoURL}
                      alt={userProfile.displayName || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <UserCircleIcon className="w-8 h-8 text-gray-400" />
                  )}
                  <span className="hidden sm:inline font-medium">
                    {userProfile?.displayName || 'Account'}
                  </span>
                </Menu.Button>

                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[100]">
                  <div className="py-1">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {userProfile?.displayName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {userProfile?.email}
                      </p>
                    </div>

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/history"
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block px-4 py-2 text-sm text-gray-700`}
                        >
                          Interviews
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/saved-jobs"
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block px-4 py-2 text-sm text-gray-700`}
                        >
                          Saved Jobs
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/compare-jobs"
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block px-4 py-2 text-sm text-gray-700`}
                        >
                          Compare Jobs
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/resume"
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block px-4 py-2 text-sm text-gray-700`}
                        >
                          Resume
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/settings"
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block px-4 py-2 text-sm text-gray-700`}
                        >
                          Settings
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => signOut()}
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block w-full text-left px-4 py-2 text-sm text-red-600`}
                        >
                          Sign Out
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Menu>
            ) : (
              <Link
                to="/signin"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* New Session Confirmation Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowNewSessionModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start New Session?</h3>
            <p className="text-gray-600 mb-6">
              Your current session will be cleared. Any unsaved progress will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewSessionModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleNewSession}
                className="btn-primary"
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
