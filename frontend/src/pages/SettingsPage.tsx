import { useState, useEffect } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { getCredentials, saveCredentials, deleteCredentials, getPreferences, updatePreferences, deleteAccount } from '../services/api';
import { UserPreferences } from '../types';
import toast from 'react-hot-toast';
import DeleteAccountDialog from '../components/DeleteAccountDialog';

interface CredentialsData {
  hasCredentials: boolean;
  agentId?: string;
}

export default function SettingsPage() {
  const { userProfile, signOut } = useAuth();
  const [credentials, setCredentials] = useState<CredentialsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [formData, setFormData] = useState({
    apiKey: '',
    agentId: '',
  });

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    loadCredentials();
    loadPreferences();
  }, []);

  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      const data = await getCredentials();
      setCredentials(data);
      if (data.agentId) {
        setFormData((prev) => ({ ...prev, agentId: data.agentId || '' }));
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      toast.error('Failed to load credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.apiKey || !formData.agentId) {
      toast.error('Please fill in both API Key and Agent ID');
      return;
    }

    try {
      setIsSaving(true);
      await saveCredentials({
        apiKey: formData.apiKey,
        agentId: formData.agentId,
      });
      toast.success('Credentials saved successfully!');
      await loadCredentials();
      setFormData((prev) => ({ ...prev, apiKey: '' }));
    } catch (error: any) {
      console.error('Failed to save credentials:', error);
      const message = error.response?.data?.detail || 'Failed to save credentials';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove your ElevenLabs credentials? You will use the default system credentials after deletion.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteCredentials();
      toast.success('Credentials removed successfully');
      setFormData({ apiKey: '', agentId: '' });
      await loadCredentials();
    } catch (error) {
      console.error('Failed to delete credentials:', error);
      toast.error('Failed to delete credentials');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Failed to load preferences');
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;

    try {
      setIsSavingPrefs(true);
      await updatePreferences(preferences);
      toast.success('Preferences saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      await deleteAccount();
      toast.success('Account deleted successfully. Redirecting...');

      // Sign out and redirect to landing page
      await signOut();
      window.location.href = '/'; // Force full page reload

    } catch (error: any) {
      console.error('Failed to delete account:', error);
      const message = error.response?.data?.detail || 'Failed to delete account. Please try again.';
      toast.error(message);
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account and ElevenLabs integration</p>
        </div>

        <div className="space-y-6">
          {/* User Profile Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{userProfile?.email}</p>
              </div>
              {userProfile?.displayName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Display Name</label>
                  <p className="mt-1 text-gray-900">{userProfile.displayName}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Plan</label>
                <p className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 capitalize">
                    {userProfile?.plan || 'Free'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Provider</label>
                <p className="mt-1 text-gray-900 capitalize">{userProfile?.provider}</p>
              </div>
              <div className="pt-4 border-t">
                <button
                  onClick={() => signOut()}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* ElevenLabs Credentials Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">ElevenLabs Configuration</h2>

            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-3">How to get your ElevenLabs credentials:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Sign up or log in at <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="underline font-medium">elevenlabs.io</a></li>
                <li>Click your <strong>profile avatar</strong> (bottom-left) → select <strong>"Profile + API key"</strong></li>
                <li>In the <strong>API Keys</strong> section, click <strong>"+ Create API Key"</strong> and copy it (starts with <code className="bg-blue-100 px-1 rounded">sk_</code>)</li>
                <li>Go to <a href="https://elevenlabs.io/app/agents" target="_blank" rel="noopener noreferrer" className="underline font-medium">Agents</a> in the left sidebar → click <strong>"+ Create Agent"</strong></li>
                <li>Configure your agent (voice, system prompt, etc.), then go to the <strong>Widget</strong> tab</li>
                <li>Copy your <strong>Agent ID</strong> (starts with <code className="bg-blue-100 px-1 rounded">agent_</code>)</li>
                <li>Paste both credentials below and click <strong>Save</strong></li>
              </ol>
              <div className="mt-4 pt-3 border-t border-blue-200">
                <a 
                  href="/guide?tab=elevenlabs-setup" 
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  📖 View our detailed ElevenLabs Setup Guide →
                </a>
              </div>
            </div>

            {credentials?.hasCredentials && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 flex-shrink-0" /> You have configured your own ElevenLabs credentials. Your custom agent will be used for interviews and coaching.
                </p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <div className="mt-1 relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    id="apiKey"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="sk_..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">Your API key starts with "sk_"</p>
              </div>

              <div>
                <label htmlFor="agentId" className="block text-sm font-medium text-gray-700">
                  Agent ID
                </label>
                <input
                  type="text"
                  id="agentId"
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  placeholder="agent_..."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-sm text-gray-500">Your Conversational AI agent ID starts with "agent_"</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSaving || !formData.apiKey || !formData.agentId}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save Credentials'}
                </button>

                {credentials?.hasCredentials && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isDeleting ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Target Job Preferences Section */}
          {preferences && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Target Job Preferences</h2>
              <p className="text-sm text-gray-600 mb-4">
                Set your default target role and company. These will be pre-filled when starting new interview sessions.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Target Role
                  </label>
                  <input
                    type="text"
                    value={preferences.default_role || ''}
                    onChange={(e) => setPreferences({...preferences, default_role: e.target.value || undefined})}
                    placeholder="e.g., Software Engineer, Product Manager, DevSecOps Engineer"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave empty to enter each time</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Target Company
                  </label>
                  <input
                    type="text"
                    value={preferences.default_company || ''}
                    onChange={(e) => setPreferences({...preferences, default_company: e.target.value || undefined})}
                    placeholder="e.g., Google, Microsoft, Amazon"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave empty to enter each time</p>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleSavePreferences}
                  disabled={isSavingPrefs}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isSavingPrefs ? 'Saving...' : 'Save Target Job Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* Interview Preferences Section */}
          {preferences && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Interview Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Interview Type
                  </label>
                  <select
                    value={preferences.default_interview_type}
                    onChange={(e) => setPreferences({...preferences, default_interview_type: e.target.value as any})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="behavioral">Behavioral (STAR method)</option>
                    <option value="technical">Technical</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Length
                  </label>
                  <select
                    value={preferences.default_interview_length}
                    onChange={(e) => setPreferences({...preferences, default_interview_length: e.target.value as any})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="short">Short (5-7 questions, ~10 min)</option>
                    <option value="medium">Medium (10-12 questions, ~20 min)</option>
                    <option value="long">Long (15-20 questions, ~30 min)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={preferences.difficulty_level}
                    onChange={(e) => setPreferences({...preferences, difficulty_level: e.target.value as any})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="easy">Easy (entry-level questions)</option>
                    <option value="medium">Medium (mid-level questions)</option>
                    <option value="hard">Hard (senior-level questions)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Voice Preferences Section */}
          {preferences && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Voice Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice Speed: {preferences.voice_speed}x
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.1"
                    value={preferences.voice_speed}
                    onChange={(e) => setPreferences({...preferences, voice_speed: parseFloat(e.target.value)})}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Slower (0.8x)</span>
                    <span>Normal (1.0x)</span>
                    <span>Faster (1.2x)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Show Real-Time Metrics</label>
                    <p className="text-sm text-gray-500">Display filler word counter and speaking pace during interview</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences({...preferences, show_real_time_metrics: !preferences.show_real_time_metrics})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.show_real_time_metrics ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.show_real_time_metrics ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Preferences Section */}
          {preferences && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                    <p className="text-sm text-gray-500">Receive emails about your progress and feedback</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences({...preferences, email_notifications: !preferences.email_notifications})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.email_notifications ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.email_notifications ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Practice Reminders</label>
                    <p className="text-sm text-gray-500">Remind me to practice regularly</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences({...preferences, practice_reminders: !preferences.practice_reminders})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.practice_reminders ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.practice_reminders ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Weekly Summary</label>
                    <p className="text-sm text-gray-500">Send weekly progress reports</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences({...preferences, weekly_summary: !preferences.weekly_summary})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.weekly_summary ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.weekly_summary ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Preferences Button */}
          {preferences && (
            <div className="bg-white shadow rounded-lg p-6">
              <button
                onClick={handleSavePreferences}
                disabled={isSavingPrefs}
                className="w-full bg-indigo-600 text-white px-4 py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSavingPrefs ? 'Saving Preferences...' : 'Save All Preferences'}
              </button>
            </div>
          )}

          {/* Delete Account - DANGER ZONE */}
          <div className="bg-white shadow rounded-lg p-6 border-2 border-red-200">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Delete Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            <button
              onClick={() => setShowDeleteDialog(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-medium transition-colors"
            >
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeletingAccount}
      />
    </div>
  );
}
