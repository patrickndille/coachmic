import { 
  LightBulbIcon, 
  CheckIcon, 
  XMarkIcon,
  MicrophoneIcon,
  ClockIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ComputerDesktopIcon,
  UserIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';

interface InterviewTipsContentProps {
  compact?: boolean; // Single-column layout for side panels
}

export function InterviewTipsContent({ compact = false }: InterviewTipsContentProps) {
  // Grid classes based on compact mode
  const gridTwoCols = compact ? 'grid grid-cols-1 gap-4' : 'grid md:grid-cols-2 gap-6';
  const gridFourCols = compact ? 'grid grid-cols-2 gap-3' : 'grid sm:grid-cols-2 md:grid-cols-4 gap-4';
  
  return (
    <div className="space-y-8">
      {/* Hero Introduction */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-100">
        <div className="flex items-start gap-4">
          <div className="bg-white p-3 rounded-full shadow-sm">
            <LightBulbIcon className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Interview Tips & Best Practices</h2>
            <p className="text-gray-700">
              Expert strategies to maximize your CoachMic practice sessions and ace your real interviews.
            </p>
          </div>
        </div>
      </section>

      {/* Before Your Session */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ComputerDesktopIcon className="w-6 h-6 text-primary-600" />
          Before Your Practice Session
        </h2>

        <div className={gridTwoCols}>
          {/* Environment Setup */}
          <div className="bg-white border rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">🏠</span>
              Environment Setup
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Find a quiet space</p>
                  <p className="text-sm text-gray-500">Background noise affects speech recognition</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Use headphones</p>
                  <p className="text-sm text-gray-500">Prevents audio feedback loops</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Good lighting</p>
                  <p className="text-sm text-gray-500">Helps you stay alert and focused</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Close other apps</p>
                  <p className="text-sm text-gray-500">Minimize distractions and browser lag</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Technical Preparation */}
          <div className="bg-white border rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">⚙️</span>
              Technical Preparation
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Test your microphone</p>
                  <p className="text-sm text-gray-500">Record yourself first to check quality</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Use Chrome browser</p>
                  <p className="text-sm text-gray-500">Best compatibility with voice features</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Stable internet</p>
                  <p className="text-sm text-gray-500">At least 1 Mbps connection</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Charge your device</p>
                  <p className="text-sm text-gray-500">Sessions can run 15-20 minutes</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Mental Preparation */}
        <div className="bg-white border rounded-lg p-5 mt-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">🧠</span>
            Mental Preparation
          </h3>
          <div className={gridFourCols}>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl mb-2">📄</p>
              <p className="font-medium text-gray-900 text-sm">Review your resume</p>
              <p className="text-xs text-gray-500">Refresh your memory on key achievements</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl mb-2">⭐</p>
              <p className="font-medium text-gray-900 text-sm">Prepare STAR stories</p>
              <p className="text-xs text-gray-500">Have 5-7 examples ready</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl mb-2">🎯</p>
              <p className="font-medium text-gray-900 text-sm">Set your intention</p>
              <p className="text-xs text-gray-500">What do you want to practice?</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl mb-2">😌</p>
              <p className="font-medium text-gray-900 text-sm">Relax</p>
              <p className="text-xs text-gray-500">This is practice, not the real thing!</p>
            </div>
          </div>
        </div>
      </section>

      {/* During the Interview */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <MicrophoneIcon className="w-6 h-6 text-primary-600" />
          During the Interview
        </h2>

        {/* Do's and Don'ts */}
        <div className={`${gridTwoCols} mb-6`}>
          {/* Do's */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-green-800">
              <CheckIcon className="w-6 h-6" />
              Do This
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span className="text-green-900">Speak clearly and at a natural pace</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span className="text-green-900">Pause to gather your thoughts (2-5 seconds is natural)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span className="text-green-900">Use "I" statements to highlight your contributions</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span className="text-green-900">Give specific examples with real numbers</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span className="text-green-900">Structure answers with the STAR method</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600">✓</span>
                <span className="text-green-900">Keep answers to 1-2 minutes per question</span>
              </li>
            </ul>
          </div>

          {/* Don'ts */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-red-800">
              <XMarkIcon className="w-6 h-6" />
              Avoid This
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-red-600">✗</span>
                <span className="text-red-900">Mumbling or speaking too quickly</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-600">✗</span>
                <span className="text-red-900">Rushing into answers without thinking</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-600">✗</span>
                <span className="text-red-900">Overusing "we" when you mean yourself</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-600">✗</span>
                <span className="text-red-900">Being vague or giving generic answers</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-600">✗</span>
                <span className="text-red-900">Rambling without structure</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-600">✗</span>
                <span className="text-red-900">Using filler words excessively (um, uh, like)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pacing Guidelines */}
        <div className="bg-white border rounded-lg p-5 mb-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-600" />
            Pacing Guidelines
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <p className="text-3xl font-bold text-blue-700">120-150</p>
              <p className="text-sm text-blue-800 font-medium">Words per minute</p>
              <p className="text-xs text-blue-600">Target speaking speed</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
              <p className="text-3xl font-bold text-purple-700">1-2</p>
              <p className="text-sm text-purple-800 font-medium">Minutes per answer</p>
              <p className="text-xs text-purple-600">Ideal response length</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <p className="text-3xl font-bold text-green-700">2-5</p>
              <p className="text-sm text-green-800 font-medium">Second pause</p>
              <p className="text-xs text-green-600">Before answering (natural)</p>
            </div>
          </div>
        </div>

        {/* Body Language */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-amber-800">
            <UserIcon className="w-5 h-5" />
            Body Language Matters (Even in Voice Interviews!)
          </h3>
          <p className="text-sm text-amber-800 mb-4">
            Your posture and expressions affect your voice quality and confidence:
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-amber-200">
              <p className="text-2xl mb-2">🧍</p>
              <p className="font-medium text-gray-900">Sit up straight</p>
              <p className="text-xs text-gray-600">Improves voice projection</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-amber-200">
              <p className="text-2xl mb-2">😊</p>
              <p className="font-medium text-gray-900">Smile</p>
              <p className="text-xs text-gray-600">It comes through in your voice</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-amber-200">
              <p className="text-2xl mb-2">🙌</p>
              <p className="font-medium text-gray-900">Use hand gestures</p>
              <p className="text-xs text-gray-600">Helps with natural speech flow</p>
            </div>
          </div>
        </div>
      </section>

      {/* Handling Tough Questions */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
          Handling Tough Questions
        </h2>

        <div className="space-y-4">
          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>"Tell me about a time you failed"</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600 border-t bg-gray-50">
              <p className="mb-2"><strong>Strategy:</strong> Choose a real failure, but focus on what you learned and how you grew.</p>
              <p className="mb-2"><strong>Structure:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Briefly describe the situation (20%)</li>
                <li>Own your mistake—no blame-shifting (10%)</li>
                <li>Explain what you learned (40%)</li>
                <li>Show how you've applied that lesson since (30%)</li>
              </ul>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>"What's your greatest weakness?"</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600 border-t bg-gray-50">
              <p className="mb-2"><strong>Strategy:</strong> Choose a real weakness you're actively improving. Avoid clichés like "I'm a perfectionist."</p>
              <p className="mb-2"><strong>Good examples:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>"I used to struggle with delegation, but I've been practicing..."</li>
                <li>"Public speaking was challenging, so I joined Toastmasters..."</li>
                <li>"I tend to over-research before decisions, so I've set time limits..."</li>
              </ul>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>"Why are you leaving your current job?"</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600 border-t bg-gray-50">
              <p className="mb-2"><strong>Strategy:</strong> Stay positive. Focus on what you're moving toward, not what you're running from.</p>
              <p className="mb-2"><strong>Good approaches:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Seeking growth opportunities not available in current role</li>
                <li>Excited about this company's mission/technology/culture</li>
                <li>Looking for new challenges in [specific area]</li>
              </ul>
              <p className="mt-2 text-red-600"><strong>Never:</strong> Badmouth your current employer or colleagues.</p>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>"Where do you see yourself in 5 years?"</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600 border-t bg-gray-50">
              <p className="mb-2"><strong>Strategy:</strong> Show ambition while aligning with the company's potential career paths.</p>
              <p className="mb-2"><strong>Template:</strong></p>
              <p className="bg-white p-3 rounded border italic">
                "In 5 years, I see myself having grown into a [senior role] where I can [specific contributions]. I'm excited about [company]'s focus on [area], and I hope to become an expert in [skill] while mentoring others along the way."
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* After the Interview */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-primary-600" />
          After Your Practice Session
        </h2>

        <div className="bg-white border rounded-lg p-5">
          <div className={gridTwoCols}>
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-500" />
                Review Your Feedback
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Check your overall score and per-question breakdown</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Read the STAR analysis for each answer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Identify patterns in your weak areas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Note specific suggestions for improvement</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5 text-purple-500" />
                Improvement Strategy
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Use post-interview coaching for weak questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Practice again in 2-3 days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Compare scores to track progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600">→</span>
                  <span>Target 70+ score before real interviews</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Reference Card */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Quick Reference Card</h2>
        <div className="bg-gray-900 text-white rounded-lg p-6">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-primary-300 mb-3">Before</h4>
              <ul className="space-y-1 text-gray-300">
                <li>✓ Quiet space</li>
                <li>✓ Headphones</li>
                <li>✓ Chrome browser</li>
                <li>✓ Resume reviewed</li>
                <li>✓ STAR stories ready</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-300 mb-3">During</h4>
              <ul className="space-y-1 text-gray-300">
                <li>✓ Speak clearly</li>
                <li>✓ Pause before answering</li>
                <li>✓ Use "I" statements</li>
                <li>✓ Give specific examples</li>
                <li>✓ 1-2 min per answer</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-purple-300 mb-3">After</h4>
              <ul className="space-y-1 text-gray-300">
                <li>✓ Review all feedback</li>
                <li>✓ Identify weak areas</li>
                <li>✓ Use coaching features</li>
                <li>✓ Practice again in 2-3 days</li>
                <li>✓ Track your progress</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
