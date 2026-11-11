import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'teal';
  requireReason?: boolean;
  reasonPlaceholder?: string;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  requireReason = false,
  reasonPlaceholder = 'Please provide a reason...',
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (requireReason && (!reason.trim() || reason.trim().length < 3)) {
      setError('A valid reason (minimum 3 characters) is required.');
      return;
    }
    setError('');
    await onConfirm(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-rose-50 text-rose-600 flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
        </div>

        {requireReason && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for this action <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder={reasonPlaceholder}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-700 placeholder-slate-400"
            />
            {error && <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

