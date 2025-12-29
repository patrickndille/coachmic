import { ReactNode } from 'react';

export interface ConfirmModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when modal is closed (cancel or backdrop click) */
  onClose: () => void;
  /** Callback when confirm button is clicked */
  onConfirm: () => void;
  /** Modal title */
  title: string;
  /** Modal message/description - can be string or JSX */
  message: ReactNode;
  /** Text for confirm button (default: "Confirm") */
  confirmText?: string;
  /** Text for cancel button (default: "Cancel") */
  cancelText?: string;
  /** Whether confirm action is destructive (changes button to red) */
  isDestructive?: boolean;
  /** Whether to show loading state on confirm button */
  isLoading?: boolean;
}

/**
 * A reusable confirmation modal component that follows the app's design system.
 *
 * @example Basic usage
 * ```tsx
 * const [showModal, setShowModal] = useState(false);
 *
 * <ConfirmModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={handleConfirm}
 *   title="Delete Item?"
 *   message="This action cannot be undone."
 *   confirmText="Delete"
 *   isDestructive
 * />
 * ```
 *
 * @example With custom message
 * ```tsx
 * <ConfirmModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={handleConfirm}
 *   title="Generate PDF?"
 *   message={
 *     <div>
 *       <p>Generate PDF from your improved resume?</p>
 *       <p className="mt-2 text-sm">Would you like to set this as your current resume?</p>
 *     </div>
 *   }
 *   confirmText="Generate"
 * />
 * ```
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isLoading) return;
    onConfirm();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 animate-fade-in">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="text-gray-600 mb-6">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={isDestructive ? 'btn-danger' : 'btn-primary'}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
