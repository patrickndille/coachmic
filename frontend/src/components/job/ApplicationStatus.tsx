import { ApplicationStatus as StatusType } from '../../types';
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/solid';

interface ApplicationStatusProps {
  status: StatusType | undefined;
  appliedAt?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ApplicationStatus({
  status,
  appliedAt,
  showLabel = true,
  size = 'md',
}: ApplicationStatusProps) {
  if (!status || status === 'saved') return null;

  const config = getStatusConfig(status);
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bgColor} ${config.textColor}`}
    >
      <config.Icon className={iconSize} />
      {showLabel && (
        <span className={`font-medium ${textSize}`}>
          {config.label}
          {appliedAt && status === 'applied' && (
            <span className="font-normal ml-1 opacity-75">
              {formatDate(appliedAt)}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

interface StatusConfig {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  textColor: string;
}

function getStatusConfig(status: StatusType): StatusConfig {
  switch (status) {
    case 'applied':
      return {
        label: 'Applied',
        Icon: CheckCircleIcon,
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
      };
    case 'interviewing':
      return {
        label: 'Interviewing',
        Icon: ChatBubbleLeftRightIcon,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
      };
    case 'offered':
      return {
        label: 'Offer Received',
        Icon: SparklesIcon,
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-700',
      };
    case 'rejected':
      return {
        label: 'Not Selected',
        Icon: XCircleIcon,
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
      };
    case 'ghosted':
      return {
        label: 'No Response',
        Icon: QuestionMarkCircleIcon,
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
      };
    default:
      return {
        label: 'Saved',
        Icon: ClockIcon,
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-600',
      };
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

// Status dropdown for updating
interface StatusDropdownProps {
  currentStatus: StatusType | undefined;
  onStatusChange: (status: StatusType) => void;
}

export function StatusDropdown({ currentStatus, onStatusChange }: StatusDropdownProps) {
  const statuses: StatusType[] = ['saved', 'applied', 'interviewing', 'offered', 'rejected', 'ghosted'];

  return (
    <select
      value={currentStatus || 'saved'}
      onChange={(e) => onStatusChange(e.target.value as StatusType)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      title="Update application status"
      aria-label="Application status"
    >
      {statuses.map((status) => {
        const config = getStatusConfig(status);
        return (
          <option key={status} value={status}>
            {config.label}
          </option>
        );
      })}
    </select>
  );
}
