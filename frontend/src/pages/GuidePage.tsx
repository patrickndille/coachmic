import { useState, ReactNode, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RocketLaunchIcon, BookOpenIcon, StarIcon, LightBulbIcon, KeyIcon } from '@heroicons/react/24/solid';
import {
  QuickStartContent,
  UserManualContent,
  StarMethodContent,
  InterviewTipsContent,
  ElevenLabsSetupContent,
} from '../components/guide';

type GuideTab = 'quick-start' | 'user-manual' | 'star-method' | 'interview-tips' | 'elevenlabs-setup';

interface TabButtonProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function TabButton({ active, icon, label, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
        ${
          active
            ? 'bg-primary-500 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function GuidePage() {
  const { section } = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();
  const tabFromQuery = searchParams.get('tab') as GuideTab | null;
  const [activeTab, setActiveTab] = useState<GuideTab>(
    tabFromQuery || (section as GuideTab) || 'quick-start'
  );

  // Update tab when URL query changes
  useEffect(() => {
    if (tabFromQuery && tabFromQuery !== activeTab) {
      setActiveTab(tabFromQuery);
    }
  }, [tabFromQuery]);

  return (
    <div className="min-h-[calc(100vh-8rem)] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">User Guide</h1>
        <p className="text-gray-600 mb-6">
          Everything you need to know to ace your interview practice
        </p>

        {/* Tab Navigation */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-2 border-b pb-4 mb-6">
            <TabButton
              active={activeTab === 'quick-start'}
              icon={<RocketLaunchIcon className="w-5 h-5" />}
              label="Quick Start"
              onClick={() => setActiveTab('quick-start')}
            />
            <TabButton
              active={activeTab === 'user-manual'}
              icon={<BookOpenIcon className="w-5 h-5" />}
              label="User Manual"
              onClick={() => setActiveTab('user-manual')}
            />
            <TabButton
              active={activeTab === 'star-method'}
              icon={<StarIcon className="w-5 h-5" />}
              label="STAR Method"
              onClick={() => setActiveTab('star-method')}
            />
            <TabButton
              active={activeTab === 'interview-tips'}
              icon={<LightBulbIcon className="w-5 h-5" />}
              label="Interview Tips"
              onClick={() => setActiveTab('interview-tips')}
            />
            <TabButton
              active={activeTab === 'elevenlabs-setup'}
              icon={<KeyIcon className="w-5 h-5" />}
              label="ElevenLabs Setup"
              onClick={() => setActiveTab('elevenlabs-setup')}
            />
          </div>

          {/* Content Area */}
          <div className="prose prose-sm max-w-none">
            {activeTab === 'quick-start' && <QuickStartContent />}
            {activeTab === 'user-manual' && <UserManualContent />}
            {activeTab === 'star-method' && <StarMethodContent />}
            {activeTab === 'interview-tips' && <InterviewTipsContent />}
            {activeTab === 'elevenlabs-setup' && <ElevenLabsSetupContent />}
          </div>
        </div>
      </div>
    </div>
  );
}
