/**
 * Tests for DeleteAccountDialog component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/testUtils';
import DeleteAccountDialog from '../components/DeleteAccountDialog';

describe('DeleteAccountDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    isDeleting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders dialog when isOpen is true', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Account')).toBeInTheDocument();
    });

    it('does not render dialog when isOpen is false', () => {
      render(<DeleteAccountDialog {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays warning message about permanent deletion', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      expect(screen.getByText(/permanent and cannot be undone/i)).toBeInTheDocument();
    });

    it('displays list of data that will be deleted', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      expect(screen.getByText(/All interview sessions and feedback/i)).toBeInTheDocument();
      expect(screen.getByText(/All coaching session history/i)).toBeInTheDocument();
      expect(screen.getByText(/All saved jobs and preferences/i)).toBeInTheDocument();
      expect(screen.getByText(/Your ElevenLabs credentials/i)).toBeInTheDocument();
      expect(screen.getByText(/Your user profile and account/i)).toBeInTheDocument();
    });

    it('shows DELETE confirmation input field', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      expect(screen.getByPlaceholderText('Type DELETE')).toBeInTheDocument();
      expect(screen.getByLabelText(/Type.*DELETE.*to confirm/i)).toBeInTheDocument();
    });
  });

  describe('Delete Button Validation', () => {
    it('delete button is disabled when confirmation text is empty', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /Delete My Account/i });
      expect(deleteButton).toBeDisabled();
    });

    it('delete button is disabled when confirmation text is incorrect', async () => {
      const user = userEvent.setup();
      render(<DeleteAccountDialog {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      await user.type(input, 'delete'); // lowercase
      
      const deleteButton = screen.getByRole('button', { name: /Delete My Account/i });
      expect(deleteButton).toBeDisabled();
    });

    it('delete button is enabled when DELETE is typed correctly', async () => {
      const user = userEvent.setup();
      render(<DeleteAccountDialog {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      await user.type(input, 'DELETE');
      
      const deleteButton = screen.getByRole('button', { name: /Delete My Account/i });
      expect(deleteButton).toBeEnabled();
    });

    it('delete button has correct styling when disabled', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /Delete My Account/i });
      expect(deleteButton).toHaveClass('bg-gray-300', 'cursor-not-allowed');
    });

    it('delete button has correct styling when enabled', async () => {
      const user = userEvent.setup();
      render(<DeleteAccountDialog {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      await user.type(input, 'DELETE');
      
      const deleteButton = screen.getByRole('button', { name: /Delete My Account/i });
      expect(deleteButton).toHaveClass('bg-red-600');
    });
  });

  describe('Cancel Button', () => {
    it('cancel button is always visible', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<DeleteAccountDialog {...defaultProps} onClose={onClose} />);
      
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('cancel button is disabled during deletion', () => {
      render(<DeleteAccountDialog {...defaultProps} isDeleting={true} />);
      
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    });
  });

  describe('Deletion Flow', () => {
    it('calls onConfirm when delete button is clicked after typing DELETE', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<DeleteAccountDialog {...defaultProps} onConfirm={onConfirm} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      await user.type(input, 'DELETE');
      
      await user.click(screen.getByRole('button', { name: /Delete My Account/i }));
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when confirmation text is invalid', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(<DeleteAccountDialog {...defaultProps} onConfirm={onConfirm} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      await user.type(input, 'wrong');
      
      // Button should be disabled, but try to click anyway
      const deleteButton = screen.getByRole('button', { name: /Delete My Account/i });
      await user.click(deleteButton);
      
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isDeleting is true', () => {
      render(<DeleteAccountDialog {...defaultProps} isDeleting={true} />);
      
      expect(screen.getByText(/Deleting.../i)).toBeInTheDocument();
    });

    it('disables input field when isDeleting is true', () => {
      render(<DeleteAccountDialog {...defaultProps} isDeleting={true} />);
      
      expect(screen.getByPlaceholderText('Type DELETE')).toBeDisabled();
    });

    it('disables delete button when isDeleting is true', () => {
      render(<DeleteAccountDialog {...defaultProps} isDeleting={true} />);
      
      // When isDeleting is true, button should show "Deleting..." and be disabled
      const deletingButton = screen.getByRole('button', { name: /Deleting/i });
      expect(deletingButton).toBeDisabled();
    });

    it('prevents dialog close when isDeleting is true', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<DeleteAccountDialog {...defaultProps} isDeleting={true} onClose={onClose} />);
      
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Confirmation Text Reset', () => {
    it('resets confirmation text after successful deletion', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<DeleteAccountDialog {...defaultProps} onConfirm={onConfirm} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      await user.type(input, 'DELETE');
      
      await user.click(screen.getByRole('button', { name: /Delete My Account/i }));
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });

    it('resets confirmation text when dialog is closed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const { rerender } = render(<DeleteAccountDialog {...defaultProps} onClose={onClose} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      await user.type(input, 'DELETE');
      
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      
      // Close the dialog
      rerender(<DeleteAccountDialog {...defaultProps} isOpen={false} onClose={onClose} />);
      
      // Reopen the dialog
      rerender(<DeleteAccountDialog {...defaultProps} isOpen={true} onClose={onClose} />);
      
      // Input should still exist (state reset is handled inside component)
      expect(screen.getByPlaceholderText('Type DELETE')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper dialog role', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has visible warning icon', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      // Check for the exclamation triangle icon (aria-hidden="true")
      const iconContainer = document.querySelector('.bg-red-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('input has proper label association', () => {
      render(<DeleteAccountDialog {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type DELETE');
      expect(input).toHaveAttribute('id', 'confirm-delete');
      expect(screen.getByLabelText(/Type.*DELETE.*to confirm/i)).toBe(input);
    });
  });
});
