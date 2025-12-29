import { CheckIcon, ExclamationTriangleIcon, ClockIcon, KeyIcon, LinkIcon, QuestionMarkCircleIcon, WrenchScrewdriverIcon, ShieldCheckIcon, ComputerDesktopIcon } from '@heroicons/react/24/solid';

// ElevenLabs logo URL (black on white per brand guidelines)
const ELEVENLABS_LOGO_URL = 'https://11labs-nonprd-15f22c1d.s3.eu-west-3.amazonaws.com/0b9cd3e1-9fad-4a5b-b3a0-c96b0a1f1d2b/elevenlabs-logo-black.png';

export function ElevenLabsSetupContent() {
  return (
    <div className="space-y-8">
      {/* Header with ElevenLabs Logo */}
      <section className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm p-2 flex-shrink-0">
            <img
              src={ELEVENLABS_LOGO_URL}
              alt="ElevenLabs"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">ElevenLabs Setup Guide</h3>
            <p className="text-sm text-gray-500">Powered by ElevenLabs Conversational AI</p>
          </div>
        </div>
        <p className="text-lg text-gray-700">
          <strong>Quick Start:</strong> Set up your own ElevenLabs Conversational AI agent in just{' '}
          <strong className="text-gray-900">5 minutes</strong> to power your personalized interview coaching voice experience.
        </p>
      </section>

      {/* Text Interview Alternative */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <ComputerDesktopIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Don't have an ElevenLabs account yet?</h4>
            <p className="text-sm text-blue-800">
              You can still practice interviews using <strong>Text Interview Mode</strong>!
              It uses the same AI technology with text-based conversation.
              Voice interviews with ElevenLabs provide a more realistic experience, but text mode
              is always available as an alternative.
            </p>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          CoachMic uses ElevenLabs' Conversational AI technology to provide you with realistic, voice-based mock interviews.
          By setting up your own ElevenLabs agent, you get:
        </p>
        <ul className="grid md:grid-cols-2 gap-3">
          <li className="flex items-start gap-2 bg-green-50 p-3 rounded-lg">
            <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span><strong>Personalized voice coaching</strong> - Natural conversation with AI</span>
          </li>
          <li className="flex items-start gap-2 bg-green-50 p-3 rounded-lg">
            <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span><strong>Custom AI behavior</strong> - Tailored to your resume and target role</span>
          </li>
          <li className="flex items-start gap-2 bg-green-50 p-3 rounded-lg">
            <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span><strong>Your own usage quota</strong> - Separate from CoachMic's shared limits</span>
          </li>
          <li className="flex items-start gap-2 bg-green-50 p-3 rounded-lg">
            <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span><strong>Full control</strong> - Manage your agent anytime</span>
          </li>
        </ul>
      </section>

      {/* What You'll Need */}
      <section className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <KeyIcon className="w-5 h-5 text-gray-700" />
          What You'll Need
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-semibold">Credential</th>
                <th className="text-left py-2 px-3 font-semibold">Format</th>
                <th className="text-left py-2 px-3 font-semibold">Where to Find</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-3 font-medium">API Key</td>
                <td className="py-2 px-3"><code className="bg-gray-100 px-2 py-1 rounded text-xs">sk_xxxxxxxxxxxxxxxx</code></td>
                <td className="py-2 px-3">Developers → API Keys</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">Agent ID</td>
                <td className="py-2 px-3"><code className="bg-gray-100 px-2 py-1 rounded text-xs">agent_xxxxxxxxxxxxxxxx</code></td>
                <td className="py-2 px-3">Agent Dashboard → Widget tab</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 1: Sign Up */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Step 1: Create an ElevenLabs Account</h2>

        <div className="bg-white border rounded-lg p-5 mb-4">
          <h4 className="font-semibold mb-4">Sign Up and Complete Onboarding:</h4>
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>Go to <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-medium">elevenlabs.io</a> and click <strong>"Get Started Free"</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Sign up with <strong>Google</strong>, <strong>GitHub</strong>, or <strong>Email</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <div>
                <span className="block"><strong>"Choose your style"</strong> - Select any style, then click <strong>Continue</strong></span>
                <span className="text-gray-500 text-xs">(This is for ElevenLabs' personalization - doesn't affect CoachMic)</span>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
              <div>
                <span className="block"><strong>"Help us personalize"</strong> - Enter your name, select English, click <strong>Next</strong></span>
                <span className="text-gray-500 text-xs">(You can skip or fill out other fields as you prefer)</span>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">5</span>
              <span><strong>"How did you hear about us?"</strong> - Click <strong>Skip</strong></span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="font-mono bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">6</span>
              <div className="flex-1">
                <span className="block font-medium text-indigo-900"><strong>"Choose your platform"</strong> - Select <strong>"Agents Platform"</strong></span>
                <div className="mt-2 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                  <p className="text-indigo-800 text-xs">
                    <strong>Important:</strong> Make sure to select "Agents Platform" (conversational AI).
                    This is required for CoachMic's voice interview feature.
                  </p>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">7</span>
              <span>Click <strong>Continue</strong> to enter the dashboard</span>
            </li>
          </ol>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Time:</strong> ~1 minute</span>
        </div>
      </section>

      {/* Step 2: Create Blank Agent */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Step 2: Create a Blank Agent</h2>
        <p className="text-gray-600 mb-4">
          Now you'll create the AI agent. CoachMic will send all the interview configuration, so you just need a blank agent.
        </p>

        <div className="bg-white border rounded-lg p-5 mb-4">
          <h4 className="font-semibold mb-4">Steps:</h4>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>In the dashboard, click <strong>"Agents"</strong> in the left sidebar</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Click the <strong>"+ New Agent"</strong> button</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Select <strong>"Blank Agent"</strong> from the template options</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
              <span>Enter an agent name: <code className="bg-gray-100 px-2 py-0.5 rounded">CoachMic Interview</code> (or any name you prefer)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">5</span>
              <span>Click <strong>"Create Agent"</strong></span>
            </li>
          </ol>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> You don't need to configure the system prompt, first message, or voice.
            CoachMic sends these automatically based on your interview settings.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Time:</strong> ~30 seconds</span>
        </div>
      </section>

      {/* Step 3: Security Settings */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          Step 3: Enable Security Overrides
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">CRITICAL</span>
        </h2>
        <p className="text-gray-600 mb-4">
          This step is <strong>essential</strong>. Without enabling overrides, CoachMic cannot customize your interview.
        </p>

        <div className="bg-white border-2 border-red-200 rounded-lg p-5 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <ShieldCheckIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900">Security Settings Are Required</h4>
              <p className="text-sm text-red-700">If you skip this step, the agent will not respond correctly to CoachMic.</p>
            </div>
          </div>

          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-red-100 text-red-800 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>While viewing your agent, click on the <strong>"Security"</strong> tab</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-red-100 text-red-800 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Find the <strong>"Allow Overrides"</strong> section</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-red-100 text-red-800 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Enable these <strong>required</strong> options:</span>
            </li>
          </ol>

          {/* Required Overrides */}
          <div className="mt-4 ml-9">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Required for CoachMic:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2 bg-green-100 p-3 rounded border-2 border-green-300">
                <CheckIcon className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">System prompt</span>
              </div>
              <div className="flex items-center gap-2 bg-green-100 p-3 rounded border-2 border-green-300">
                <CheckIcon className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">First message</span>
              </div>
              <div className="flex items-center gap-2 bg-green-100 p-3 rounded border-2 border-green-300">
                <CheckIcon className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">Agent language</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 uppercase font-semibold mt-4 mb-2">Optional (for customization):</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                <CheckIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Voice</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                <CheckIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Voice speed</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                <CheckIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Voice stability</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <p className="text-sm text-indigo-800">
            <strong>Why this matters:</strong> Enabling overrides allows CoachMic to send the interviewer instructions,
            first greeting, and customize everything based on your resume, target role, and company.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Time:</strong> ~30 seconds</span>
        </div>
      </section>

      {/* Step 4: Publish Agent */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Step 4: Publish Your Agent</h2>
        <p className="text-gray-600 mb-4">
          You must publish the agent for it to accept API calls from CoachMic.
        </p>

        <div className="bg-white border rounded-lg p-5 mb-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>While viewing your agent, look for the <strong>"Publish"</strong> button (usually in the top right)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Click <strong>"Publish"</strong> to make your agent live</span>
            </li>
          </ol>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span><strong>Don't forget to publish!</strong> The agent must be published to accept API calls from CoachMic.</span>
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Time:</strong> ~10 seconds</span>
        </div>
      </section>

      {/* Step 5: Get Agent ID */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Step 5: Copy Your Agent ID</h2>
        <p className="text-gray-600 mb-4">
          Now you need to find and copy your Agent ID from the Widget tab.
        </p>

        <div className="bg-white border rounded-lg p-5 mb-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>While viewing your agent, click on the <strong>"Widget"</strong> tab</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Find your <strong>Agent ID</strong> - it starts with <code className="bg-gray-100 px-2 py-0.5 rounded">agent_</code></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Click the <strong>copy icon</strong> to copy the Agent ID</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
              <span>Save it somewhere safe - you'll need it for CoachMic</span>
            </li>
          </ol>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Your Agent ID Format:</p>
          <code className="bg-gray-800 text-green-400 px-4 py-2 rounded block text-sm">
            agent_xxxxxxxxxxxxxxxxxxxxxxxx
          </code>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Time:</strong> ~20 seconds</span>
        </div>
      </section>

      {/* Step 6: Create API Key */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Step 6: Create Your API Key</h2>
        <p className="text-gray-600 mb-4">
          The API key allows CoachMic to securely communicate with ElevenLabs on your behalf.
        </p>

        <div className="bg-white border rounded-lg p-5 mb-4">
          <h4 className="font-semibold mb-4">Steps:</h4>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>Click <strong>"Developers"</strong> in the left sidebar (or go to the main dashboard)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Click on <strong>"API Keys"</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Click <strong>"+ Create API Key"</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
              <span>Name your key (e.g., <code className="bg-gray-100 px-2 py-0.5 rounded">CoachMic</code>)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">5</span>
              <span><strong>Grant the required permission:</strong></span>
            </li>
          </ol>

          {/* Required Permission */}
          <div className="mt-4 ml-9 bg-green-50 rounded-lg p-4 border-2 border-green-200">
            <h5 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
              <CheckIcon className="w-5 h-5 text-green-600" />
              Required API Key Permission:
            </h5>
            <div className="flex items-center gap-3 bg-white p-3 rounded border border-green-300">
              <CheckIcon className="w-5 h-5 text-green-600" />
              <div>
                <span className="font-semibold text-green-900">ElevenLabs Agents: Read</span>
                <p className="text-xs text-green-700">This is the minimum permission needed for CoachMic voice interviews</p>
              </div>
            </div>
          </div>

          <ol start={6} className="space-y-3 text-sm mt-4">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">6</span>
              <span>Click <strong>"Create"</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">7</span>
              <span><strong>IMPORTANT:</strong> Click the copy icon to copy your API key immediately</span>
            </li>
          </ol>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <p className="text-sm text-amber-800 flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span><strong>Warning:</strong> You can only view your API key once! Store it somewhere safe. If you lose it, you'll need to create a new one.</span>
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Your API Key Format:</p>
          <code className="bg-gray-800 text-green-400 px-4 py-2 rounded block text-sm">
            sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
          </code>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Time:</strong> ~1 minute</span>
        </div>
      </section>

      {/* Step 7: Add to CoachMic */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Step 7: Add Credentials to CoachMic</h2>
        <p className="text-gray-600 mb-4">
          Now add your credentials to CoachMic to start using your personalized interviewer.
        </p>

        <div className="bg-white border rounded-lg p-5 mb-4">
          <h4 className="font-semibold mb-4">Steps:</h4>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>Open the <strong>CoachMic</strong> application</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Navigate to <strong>Settings</strong> (click your profile or the gear icon)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Find the <strong>"ElevenLabs Configuration"</strong> section</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
              <span>Enter your credentials:</span>
            </li>
          </ol>

          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-semibold">Field</th>
                  <th className="text-left py-2 px-3 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium">API Key</td>
                  <td className="py-2 px-3">Your API key from Step 6 (<code className="bg-gray-100 px-1 rounded text-xs">sk_...</code>)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">Agent ID</td>
                  <td className="py-2 px-3">Your Agent ID from Step 5 (<code className="bg-gray-100 px-1 rounded text-xs">agent_...</code>)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ol start={5} className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">5</span>
              <span>Click <strong>"Save Credentials"</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                <CheckIcon className="w-4 h-4" />
              </span>
              <span className="text-green-700 font-medium">You should see a green success message!</span>
            </li>
          </ol>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Time:</strong> ~30 seconds</span>
        </div>
      </section>

      {/* Success */}
      <section className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-2xl font-semibold text-green-800 mb-2">You're All Set!</p>
        <p className="text-green-700 mb-4">Your ElevenLabs integration is complete. Start practicing for your interviews!</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full text-green-800 text-sm">
          <ClockIcon className="w-4 h-4" />
          <span><strong>Total Setup Time:</strong> ~5 minutes</span>
        </div>
      </section>

      {/* Troubleshooting */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-7 h-7 text-gray-600" />
          Troubleshooting
        </h2>
        <p className="text-gray-600 mb-6">Common issues and solutions:</p>

        <div className="space-y-4">
          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium flex items-center gap-2 hover:bg-gray-50">
              <span className="text-red-500">X</span> "Invalid API Key" or "Agent Not Found" Error
            </summary>
            <div className="px-4 pb-4 text-sm">
              <p className="text-gray-600 mb-2"><strong>Cause:</strong> API key is incorrect, missing permissions, or Agent ID is wrong</p>
              <p className="font-medium mb-1">Solution:</p>
              <ol className="list-decimal ml-5 text-gray-600 space-y-1">
                <li>Go to <a href="https://elevenlabs.io/app" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">ElevenLabs Dashboard</a> → Developers → API Keys</li>
                <li>Create a new API key with <strong>ElevenLabs Agents: Read</strong> permission</li>
                <li>Verify your Agent ID from the Widget tab (starts with <code className="bg-gray-100 px-1 rounded">agent_</code>)</li>
                <li>Make sure the agent is <strong>Published</strong></li>
                <li>Update both credentials in CoachMic Settings</li>
              </ol>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium flex items-center gap-2 hover:bg-gray-50">
              <span className="text-red-500">X</span> "Override Not Allowed" Error
            </summary>
            <div className="px-4 pb-4 text-sm">
              <p className="text-gray-600 mb-2"><strong>Cause:</strong> Security overrides are not enabled on your agent</p>
              <p className="font-medium mb-1">Solution:</p>
              <ol className="list-decimal ml-5 text-gray-600 space-y-1">
                <li>Go to <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">ElevenLabs Agents</a></li>
                <li>Click on your agent</li>
                <li>Go to <strong>Security</strong> tab</li>
                <li>Enable: <strong>System prompt</strong>, <strong>First message</strong>, and <strong>Agent language</strong></li>
                <li>Click <strong>Publish</strong> again to save changes</li>
              </ol>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium flex items-center gap-2 hover:bg-gray-50">
              <span className="text-red-500">X</span> No Audio / Silent Interviewer
            </summary>
            <div className="px-4 pb-4 text-sm">
              <p className="text-gray-600 mb-2"><strong>Cause:</strong> Browser microphone permissions or audio issues</p>
              <p className="font-medium mb-1">Solution:</p>
              <ol className="list-decimal ml-5 text-gray-600 space-y-1">
                <li>Check your browser has microphone permission for CoachMic</li>
                <li>Ensure your system volume is not muted</li>
                <li>Try refreshing the page</li>
                <li>Try a different browser (Chrome recommended)</li>
              </ol>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium flex items-center gap-2 hover:bg-gray-50">
              <span className="text-red-500">X</span> "Quota Exceeded" Error
            </summary>
            <div className="px-4 pb-4 text-sm">
              <p className="text-gray-600 mb-2"><strong>Cause:</strong> You've used all your ElevenLabs free tier credits</p>
              <p className="font-medium mb-1">Solution:</p>
              <ol className="list-decimal ml-5 text-gray-600 space-y-1">
                <li>Check your usage at <a href="https://elevenlabs.io/app/settings/usage" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">elevenlabs.io/app/settings/usage</a></li>
                <li>Wait for your monthly quota to reset, or</li>
                <li>Upgrade to a paid ElevenLabs plan for more credits, or</li>
                <li>Use <strong>Text Interview Mode</strong> in CoachMic (no ElevenLabs quota needed)</li>
              </ol>
            </div>
          </details>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <QuestionMarkCircleIcon className="w-7 h-7 text-gray-600" />
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
              Is ElevenLabs free to use?
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              <p>Yes! ElevenLabs offers a free tier that includes:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>10,000 characters per month for text-to-speech</li>
                <li>Access to the Conversational AI platform</li>
                <li>Access to the voice library</li>
              </ul>
              <p className="mt-2">This is usually enough for several practice interviews per month.</p>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
              Can I use CoachMic without ElevenLabs?
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              <p><strong>Yes!</strong> CoachMic offers <strong>Text Interview Mode</strong> that works without ElevenLabs:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Same AI-powered interview questions</li>
                <li>Type your answers instead of speaking</li>
                <li>Perfect for quiet environments or accessibility</li>
                <li>Uses Gemini AI for real-time conversation</li>
              </ul>
              <p className="mt-2">Voice interviews with ElevenLabs provide a more realistic experience, but text mode is always available.</p>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
              Do I need to configure the system prompt or voice?
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              <p><strong>No!</strong> CoachMic automatically sends:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>The interviewer's personality and behavior instructions</li>
                <li>The first greeting message</li>
                <li>Context about your resume, role, and target company</li>
              </ul>
              <p className="mt-2">You just need a blank agent with overrides enabled.</p>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
              Why do I need to enable overrides?
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              <p>Enabling overrides allows CoachMic to customize the interview based on:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>The specific job role you're practicing for</li>
                <li>The company you're targeting (with AI research)</li>
                <li>Your resume and background</li>
                <li>The type of interview (behavioral, technical, etc.)</li>
              </ul>
              <p className="mt-2">Without overrides, the agent won't receive these customizations.</p>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
              Is my API key secure?
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              <p>Yes! CoachMic encrypts your API key before storing it. We never display your full API key after you save it, and it's never exposed to other users.</p>
            </div>
          </details>

          <details className="bg-white border rounded-lg">
            <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
              What's the minimum API permission I need?
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              <p>You only need <strong>ElevenLabs Agents: Read</strong> permission for CoachMic to work. This allows CoachMic to:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Start voice interview sessions</li>
                <li>Send your interview configuration to the agent</li>
              </ul>
              <p className="mt-2">You don't need write permissions or other API scopes.</p>
            </div>
          </details>
        </div>
      </section>

      {/* Quick Reference */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <LinkIcon className="w-7 h-7 text-gray-600" />
          Quick Reference
        </h2>

        <div className="bg-gray-900 text-white rounded-lg p-6 mb-6 font-mono text-sm">
          <p className="text-gray-400 mb-4">Your Credentials Checklist:</p>
          <div className="space-y-3">
            <div>
              <span className="text-gray-400">API Key:    </span>
              <span className="text-green-400">sk_________________________________</span>
              <span className="text-gray-500 text-xs block ml-12">(from Developers → API Keys with "ElevenLabs Agents: Read")</span>
            </div>
            <div>
              <span className="text-gray-400">Agent ID:   </span>
              <span className="text-green-400">agent_____________________________</span>
              <span className="text-gray-500 text-xs block ml-12">(from Agents → Your Agent → Widget → PUBLISHED)</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <h4 className="font-semibold p-4 bg-gray-50 border-b">Important Links</h4>
          <div className="divide-y">
            <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="flex justify-between items-center p-4 hover:bg-gray-50">
              <span>ElevenLabs Home</span>
              <span className="text-indigo-600 text-sm">elevenlabs.io</span>
            </a>
            <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="flex justify-between items-center p-4 hover:bg-gray-50">
              <span>Agents Dashboard</span>
              <span className="text-indigo-600 text-sm">elevenlabs.io/app/conversational-ai</span>
            </a>
            <a href="https://elevenlabs.io/app/settings/usage" target="_blank" rel="noopener noreferrer" className="flex justify-between items-center p-4 hover:bg-gray-50">
              <span>Usage & Billing</span>
              <span className="text-indigo-600 text-sm">elevenlabs.io/app/settings/usage</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="text-center text-sm text-gray-500 pt-8 border-t">
        <p><strong>Last Updated:</strong> December 2024</p>
        <p><strong>Compatible with:</strong> ElevenLabs Conversational AI Platform, CoachMic v1.0+</p>
      </section>
    </div>
  );
}
