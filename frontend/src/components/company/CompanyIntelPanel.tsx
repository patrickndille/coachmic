/**
 * CompanyIntelPanel - AI-powered company intelligence for interview preparation.
 *
 * Features:
 * - Real-time company research using Gemini with Google Search grounding
 * - Predicted interview questions based on company context
 * - STAR story mapping to company initiatives
 * - Expandable accordion sections
 */

import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  NewspaperIcon,
  UserGroupIcon,
  RocketLaunchIcon,
  HeartIcon,
  ChartBarIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  ClockIcon,
  BuildingOffice2Icon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import {
  CompanyIntel,
  NewsItem,
  LeadershipChange,
  StrategicInitiative,
  CultureSignal,
  InterviewAngle,
  PredictedQuestion,
  StoryToCompanyMapping,
} from '../../types';
import { generateCompanyIntel, refreshCompanyIntel } from '../../services/api';

interface CompanyIntelPanelProps {
  companyName: string;
  targetRole?: string;
  intel?: CompanyIntel | null;
  onIntelGenerated?: (intel: CompanyIntel) => void;
  showGenerateButton?: boolean;
  className?: string;
  // Job-specific intel persistence
  jobId?: string;      // The job ID to associate intel with
  isJobSaved?: boolean; // Whether the job is saved (determines if intel is persisted to saved_jobs)
}

interface AccordionSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AccordionSection({
  title,
  icon: Icon,
  count,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary-600" />
          <span className="font-medium text-gray-900">{title}</span>
          {count !== undefined && (
            <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
              {count}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="space-y-3 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );
}

export function CompanyIntelPanel({
  companyName,
  targetRole,
  intel: initialIntel,
  onIntelGenerated,
  showGenerateButton = true,
  className = '',
  jobId,
  isJobSaved = false,
}: CompanyIntelPanelProps) {
  const [intel, setIntel] = useState<CompanyIntel | null>(initialIntel || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (forceRefresh = false) => {
    if (!companyName) return;

    setIsLoading(true);
    setError(null);

    try {
      // Pass jobId only if job is saved (so intel gets persisted to saved_jobs)
      const jobIdToPass = isJobSaved ? jobId : undefined;

      const response = forceRefresh
        ? await refreshCompanyIntel(companyName, targetRole, jobIdToPass)
        : await generateCompanyIntel({
            companyName,
            targetRole,
            includeQuestions: true,
            includeStoryMapping: true,
          }, jobIdToPass);

      if (response.success && response.intel) {
        setIntel(response.intel);
        onIntelGenerated?.(response.intel);
        toast.success(
          response.cached
            ? 'Loaded cached company intel'
            : 'Generated fresh company intel'
        );
      } else {
        setError(response.error || 'Failed to generate company intel');
        toast.error(response.error || 'Failed to generate company intel');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [companyName, targetRole, onIntelGenerated, jobId, isJobSaved]);

  // Generate button when no intel
  if (!intel && showGenerateButton) {
    return (
      <div className={`bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl p-6 border border-primary-200 ${className}`}>
        <div className="text-center">
          <SparklesIcon className="w-12 h-12 text-primary-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Company Intelligence
          </h3>
          <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
            Get AI-powered insights about {companyName} including recent news,
            culture signals, and predicted interview questions.
          </p>
          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={isLoading}
            className="btn-primary inline-flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Researching {companyName}...
              </>
            ) : (
              <>
                <GlobeAltIcon className="w-5 h-5" />
                Research Company
              </>
            )}
          </button>
          {isLoading && (
            <p className="text-xs text-gray-500 mt-3">
              Searching the web for real-time information...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && !intel) {
    return (
      <div className={`bg-white rounded-xl p-6 border border-gray-200 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <ArrowPathIcon className="w-6 h-6 text-primary-500 animate-spin" />
          <span className="text-gray-600">Researching {companyName}...</span>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!intel) return null;

  // Calculate freshness
  const generatedAt = new Date(intel.generatedAt);
  const hoursAgo = Math.floor(
    (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60)
  );
  const freshnessText =
    intel.dataFreshness === 'real-time'
      ? 'Just updated'
      : hoursAgo < 1
      ? 'Less than an hour ago'
      : `${hoursAgo} hours ago`;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-blue-600 text-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BuildingOffice2Icon className="w-6 h-6" />
              <h2 className="text-xl font-bold">{intel.companyName}</h2>
            </div>
            {intel.industry && (
              <p className="text-primary-100 text-sm mt-1">{intel.industry}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                intel.dataFreshness === 'real-time'
                  ? 'bg-green-500/20 text-green-100'
                  : 'bg-yellow-500/20 text-yellow-100'
              }`}
            >
              <ClockIcon className="w-3 h-3 inline mr-1" />
              {freshnessText}
            </span>
            <button
              type="button"
              onClick={() => handleGenerate(true)}
              disabled={isLoading}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              title="Refresh intel"
            >
              <ArrowPathIcon
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
        {/* Company quick facts */}
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-primary-100">
          {intel.headquarters && (
            <span>
              <span className="opacity-75">HQ:</span> {intel.headquarters}
            </span>
          )}
          {intel.companySize && (
            <span>
              <span className="opacity-75">Size:</span> {intel.companySize}
            </span>
          )}
          {intel.founded && (
            <span>
              <span className="opacity-75">Founded:</span> {intel.founded}
            </span>
          )}
          {intel.website && (
            <a
              href={intel.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline"
            >
              Website
            </a>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <p className="text-gray-700">{intel.executiveSummary}</p>
        {intel.keyTalkingPoints.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">
              Key Talking Points
            </p>
            <ul className="space-y-1">
              {intel.keyTalkingPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckBadgeIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Accordion Sections */}
      <div className="p-4 space-y-3">
        {/* Recent News */}
        {intel.recentNews.length > 0 && (
          <AccordionSection
            title="Recent News"
            icon={NewspaperIcon}
            count={intel.recentNews.length}
          >
            <div className="space-y-4">
              {intel.recentNews.map((news, i) => (
                <NewsItemCard key={i} news={news} />
              ))}
            </div>
          </AccordionSection>
        )}

        {/* Strategic Initiatives */}
        {intel.strategicInitiatives.length > 0 && (
          <AccordionSection
            title="Strategic Initiatives"
            icon={RocketLaunchIcon}
            count={intel.strategicInitiatives.length}
          >
            <div className="space-y-4">
              {intel.strategicInitiatives.map((initiative, i) => (
                <InitiativeCard key={i} initiative={initiative} />
              ))}
            </div>
          </AccordionSection>
        )}

        {/* Culture Signals */}
        {intel.cultureSignals.length > 0 && (
          <AccordionSection
            title="Culture & Values"
            icon={HeartIcon}
            count={intel.cultureSignals.length}
          >
            <div className="space-y-4">
              {intel.cultureSignals.map((signal, i) => (
                <CultureCard key={i} signal={signal} />
              ))}
            </div>
          </AccordionSection>
        )}

        {/* Interview Angles */}
        {intel.interviewAngles.length > 0 && (
          <AccordionSection
            title="Interview Angles"
            icon={LightBulbIcon}
            count={intel.interviewAngles.length}
          >
            <div className="space-y-4">
              {intel.interviewAngles.map((angle, i) => (
                <AngleCard key={i} angle={angle} />
              ))}
            </div>
          </AccordionSection>
        )}

        {/* Predicted Questions */}
        {intel.predictedQuestions.length > 0 && (
          <AccordionSection
            title="Predicted Interview Questions"
            icon={QuestionMarkCircleIcon}
            count={intel.predictedQuestions.length}
          >
            <div className="space-y-4">
              {intel.predictedQuestions.map((question, i) => (
                <QuestionCard key={i} question={question} index={i + 1} />
              ))}
            </div>
          </AccordionSection>
        )}

        {/* Story Mappings */}
        {intel.storyMappings.length > 0 && (
          <AccordionSection
            title="Your Stories → Company Connection"
            icon={BookOpenIcon}
            count={intel.storyMappings.length}
          >
            <div className="space-y-4">
              {intel.storyMappings.map((mapping, i) => (
                <StoryMappingCard key={i} mapping={mapping} />
              ))}
            </div>
          </AccordionSection>
        )}

        {/* Leadership Changes */}
        {intel.leadershipChanges.length > 0 && (
          <AccordionSection
            title="Leadership Changes"
            icon={UserGroupIcon}
            count={intel.leadershipChanges.length}
          >
            <div className="space-y-3">
              {intel.leadershipChanges.map((change, i) => (
                <LeadershipCard key={i} change={change} />
              ))}
            </div>
          </AccordionSection>
        )}

        {/* Financial Health */}
        {intel.financialHealth && (
          <AccordionSection title="Financial Health" icon={ChartBarIcon}>
            <FinancialHealthSection health={intel.financialHealth} />
          </AccordionSection>
        )}
      </div>

      {/* Sources Footer */}
      {intel.sources.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Sources:</p>
          <div className="flex flex-wrap gap-2">
            {intel.sources.slice(0, 5).map((source, i) => (
              <a
                key={i}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:underline truncate max-w-[200px]"
              >
                {new URL(source).hostname}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components for each section type

function NewsItemCard({ news }: { news: NewsItem }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-gray-900">{news.title}</h4>
        {news.date && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {news.date}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 mt-1">{news.summary}</p>
      {news.relevanceToInterview && (
        <div className="mt-2 p-2 bg-primary-50 rounded text-sm">
          <span className="font-medium text-primary-700">Interview tip: </span>
          <span className="text-primary-600">{news.relevanceToInterview}</span>
        </div>
      )}
      {news.source && (
        <p className="text-xs text-gray-400 mt-2">Source: {news.source}</p>
      )}
    </div>
  );
}

function InitiativeCard({ initiative }: { initiative: StrategicInitiative }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <h4 className="font-medium text-gray-900">{initiative.title}</h4>
      <p className="text-sm text-gray-600 mt-1">{initiative.description}</p>
      {initiative.interviewAngle && (
        <div className="mt-2 p-2 bg-green-50 rounded text-sm">
          <span className="font-medium text-green-700">How to use: </span>
          <span className="text-green-600">{initiative.interviewAngle}</span>
        </div>
      )}
    </div>
  );
}

function CultureCard({ signal }: { signal: CultureSignal }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <h4 className="font-medium text-gray-900">{signal.signal}</h4>
      <p className="text-sm text-gray-600 mt-1">{signal.evidence}</p>
      {signal.interviewTip && (
        <div className="mt-2 p-2 bg-purple-50 rounded text-sm">
          <span className="font-medium text-purple-700">How to show it: </span>
          <span className="text-purple-600">{signal.interviewTip}</span>
        </div>
      )}
    </div>
  );
}

function AngleCard({ angle }: { angle: InterviewAngle }) {
  return (
    <div className="p-3 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-100">
      <h4 className="font-medium text-primary-900">{angle.topic}</h4>
      <p className="text-sm text-gray-700 mt-1">{angle.whyRelevant}</p>
      <p className="text-sm text-primary-700 mt-2">
        <strong>How to use:</strong> {angle.howToUse}
      </p>
      {angle.samplePhrases.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">Sample phrases:</p>
          <ul className="space-y-1">
            {angle.samplePhrases.map((phrase, i) => (
              <li
                key={i}
                className="text-sm italic text-gray-600 pl-3 border-l-2 border-primary-300"
              >
                "{phrase}"
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  index,
}: {
  question: PredictedQuestion;
  index: number;
}) {
  const typeColors = {
    behavioral: 'bg-blue-100 text-blue-700',
    technical: 'bg-purple-100 text-purple-700',
    situational: 'bg-orange-100 text-orange-700',
    'company-specific': 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-primary-500">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
          {index}
        </span>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-gray-900">{question.question}</p>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                typeColors[question.type]
              }`}
            >
              {question.type}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            <strong>Why likely:</strong> {question.reasoning}
          </p>
          <div className="mt-2 p-2 bg-white rounded border border-gray-200">
            <p className="text-sm text-primary-700">
              <strong>Prep tip:</strong> {question.preparationTip}
            </p>
          </div>
          {question.relatedNews && (
            <p className="text-xs text-gray-400 mt-2">
              Related to: {question.relatedNews}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StoryMappingCard({ mapping }: { mapping: StoryToCompanyMapping }) {
  const emphasisColor =
    mapping.emphasisScore >= 8
      ? 'bg-green-500'
      : mapping.emphasisScore >= 6
      ? 'bg-yellow-500'
      : 'bg-gray-400';

  return (
    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{mapping.storyTheme}</h4>
          <p className="text-sm text-gray-600 mt-1">{mapping.storySummary}</p>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-500">Emphasis</span>
          <span
            className={`w-8 h-8 rounded-full ${emphasisColor} text-white flex items-center justify-center font-bold`}
          >
            {mapping.emphasisScore}
          </span>
        </div>
      </div>
      <div className="mt-3 p-3 bg-white rounded border border-green-100">
        <p className="text-sm">
          <span className="font-medium text-green-700">Connects to: </span>
          <span className="text-gray-700">{mapping.companyInitiative}</span>
        </p>
        <p className="text-sm mt-2 text-gray-600">
          {mapping.connectionExplanation}
        </p>
      </div>
      <div className="mt-2 p-2 bg-green-100 rounded text-sm">
        <span className="font-medium text-green-800">How to frame it: </span>
        <span className="text-green-700">{mapping.framingTip}</span>
      </div>
    </div>
  );
}

function LeadershipCard({ change }: { change: LeadershipChange }) {
  const typeLabels: Record<string, string> = {
    new_hire: 'New Hire',
    departure: 'Departure',
    promotion: 'Promotion',
    restructure: 'Restructure',
    no_change: 'Current',
    other: 'Other',
  };

  const typeColors: Record<string, string> = {
    new_hire: 'bg-green-100 text-green-700',
    departure: 'bg-red-100 text-red-700',
    promotion: 'bg-blue-100 text-blue-700',
    restructure: 'bg-orange-100 text-orange-700',
    no_change: 'bg-gray-100 text-gray-700',
    other: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{change.name}</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              typeColors[change.changeType]
            }`}
          >
            {typeLabels[change.changeType]}
          </span>
        </div>
        <p className="text-sm text-gray-600">{change.role}</p>
        {change.implications && (
          <p className="text-sm text-gray-500 mt-1">{change.implications}</p>
        )}
      </div>
      {change.date && (
        <span className="text-xs text-gray-400">{change.date}</span>
      )}
    </div>
  );
}

function FinancialHealthSection({
  health,
}: {
  health: NonNullable<CompanyIntel['financialHealth']>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-1 text-sm rounded ${
            health.isPublic
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {health.isPublic ? 'Public Company' : 'Private Company'}
        </span>
      </div>
      {health.stockTrend && (
        <p className="text-sm">
          <strong>Stock Trend:</strong> {health.stockTrend}
        </p>
      )}
      {health.recentEarnings && (
        <p className="text-sm">
          <strong>Recent Earnings:</strong> {health.recentEarnings}
        </p>
      )}
      {health.growthIndicators.length > 0 && (
        <div>
          <p className="text-sm font-medium text-green-700">Growth Indicators:</p>
          <ul className="mt-1 space-y-1">
            {health.growthIndicators.map((indicator, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                {indicator}
              </li>
            ))}
          </ul>
        </div>
      )}
      {health.concerns.length > 0 && (
        <div>
          <p className="text-sm font-medium text-amber-700">Concerns:</p>
          <ul className="mt-1 space-y-1">
            {health.concerns.map((concern, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                {concern}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CompanyIntelPanel;
