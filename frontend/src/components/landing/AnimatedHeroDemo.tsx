import { useState, useEffect } from 'react';
import { MicrophoneIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

interface Message {
  id: number;
  type: 'ai' | 'user';
  text: string;
  delay: number;
}

interface FeedbackItem {
  label: string;
  value: string;
  color: string;
}

const conversation: Message[] = [
  {
    id: 1,
    type: 'ai',
    text: "Tell me about a time you led a project under tight deadlines...",
    delay: 0,
  },
  {
    id: 2,
    type: 'user',
    text: "In my previous role as a Senior Engineer, I led a critical migration project with only 3 weeks until launch. I organized daily standups, delegated tasks based on team strengths, and we delivered 2 days early.",
    delay: 2500,
  },
];

const feedbackItems: FeedbackItem[] = [
  { label: 'Overall Score', value: '92/100', color: 'text-green-600' },
  { label: 'STAR Method', value: 'Excellent', color: 'text-blue-600' },
  { label: 'Speaking Pace', value: '145 WPM', color: 'text-indigo-600' },
];

export default function AnimatedHeroDemo() {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [typingMessage, setTypingMessage] = useState<number | null>(null);
  const [displayedText, setDisplayedText] = useState<{ [key: number]: string }>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [animationCycle, setAnimationCycle] = useState(0);

  // Reset and restart animation
  useEffect(() => {
    const resetAnimation = () => {
      setVisibleMessages([]);
      setTypingMessage(null);
      setDisplayedText({});
      setShowFeedback(false);
      setIsRecording(false);
    };

    resetAnimation();

    // Start first message
    const timer1 = setTimeout(() => {
      setTypingMessage(1);
      setVisibleMessages([1]);
    }, 500);

    // Show user recording state
    const timer2 = setTimeout(() => {
      setIsRecording(true);
    }, 3500);

    // Start user message
    const timer3 = setTimeout(() => {
      setIsRecording(false);
      setTypingMessage(2);
      setVisibleMessages([1, 2]);
    }, 4500);

    // Show feedback
    const timer4 = setTimeout(() => {
      setShowFeedback(true);
    }, 9000);

    // Restart cycle
    const timer5 = setTimeout(() => {
      setAnimationCycle((prev) => prev + 1);
    }, 13000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, [animationCycle]);

  // Typing effect
  useEffect(() => {
    if (typingMessage === null) return;

    const message = conversation.find((m) => m.id === typingMessage);
    if (!message) return;

    const fullText = message.text;
    let currentIndex = 0;

    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayedText((prev) => ({
          ...prev,
          [typingMessage]: fullText.slice(0, currentIndex),
        }));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setTypingMessage(null);
      }
    }, message.type === 'ai' ? 30 : 20);

    return () => clearInterval(typingInterval);
  }, [typingMessage]);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Main Demo Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-white text-sm font-medium">CoachMic Interview</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-white/80 text-xs">
              {isRecording ? 'Recording...' : 'Connected'}
            </span>
          </div>
        </div>

        {/* Conversation Area - Fixed height on mobile to prevent layout push */}
        <div className="p-4 space-y-4 h-[320px] lg:h-auto lg:min-h-[280px] overflow-hidden bg-gradient-to-b from-gray-50 to-white">
          {/* AI Message */}
          {visibleMessages.includes(1) && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1 font-medium">AI Interviewer</div>
                <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100">
                  <p className="text-gray-800">
                    {displayedText[1] || ''}
                    {typingMessage === 1 && (
                      <span className="inline-block w-0.5 h-4 bg-primary-500 ml-0.5 animate-blink" />
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center justify-center gap-3 py-4 animate-fade-in">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <MicrophoneIcon className="w-6 h-6 text-red-500" />
                </div>
                <div className="absolute inset-0 rounded-full bg-red-400 opacity-30 animate-ping" />
              </div>
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-400 rounded-full animate-sound-wave"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      height: '20px',
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500">Listening...</span>
            </div>
          )}

          {/* User Message */}
          {visibleMessages.includes(2) && !isRecording && (
            <div className="flex items-start gap-3 justify-end animate-fade-in">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1 font-medium text-right">You</div>
                <div className="bg-primary-500 text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-md">
                  <p>
                    {displayedText[2] || ''}
                    {typingMessage === 2 && (
                      <span className="inline-block w-0.5 h-4 bg-white ml-0.5 animate-blink" />
                    )}
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0 shadow-md">
                <span className="text-white text-sm font-semibold">You</span>
              </div>
            </div>
          )}

          {/* Feedback Panel */}
          {showFeedback && (
            <div className="animate-slide-up">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-gray-800">AI Feedback</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {feedbackItems.map((item, index) => (
                    <div
                      key={item.label}
                      className="text-center animate-fade-in"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    >
                      <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                      <div className="text-xs text-gray-500">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isRecording ? 'bg-red-500' : 'bg-primary-100'
            }`}>
              <MicrophoneIcon className={`w-4 h-4 ${isRecording ? 'text-white' : 'text-primary-600'}`} />
            </div>
            <span className="text-sm text-gray-600">
              {isRecording ? 'Speaking...' : 'Ready to respond'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Question 1 of 5</span>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-r from-primary-100/50 via-indigo-100/50 to-purple-100/50 rounded-full blur-3xl" />
    </div>
  );
}
