import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Area } from '../../types';

const locationSchema = z.object({
  name: z
    .string({ required_error: 'Location is required' })
    .trim()
    .min(1, 'Location cannot be empty')
    .max(100, 'Location cannot exceed 100 characters'),
});

export type AreaFormData = z.infer<typeof locationSchema>;

export interface AreaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AreaFormData) => Promise<void>;
  editingArea?: Area | null;
  isLoading?: boolean;
}

export const AreaFormModal: React.FC<AreaFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingArea,
  isLoading,
}) => {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AreaFormData>({
    resolver: zodResolver(locationSchema),
  });

  useEffect(() => {
    setFormError(null);
    if (editingArea) {
      reset({
        name: editingArea.displayName || editingArea.name || '',
      });
    } else {
      reset({
        name: '',
      });
    }
  }, [editingArea, reset, isOpen]);

  const handleFormSubmit = async (data: AreaFormData) => {
    try {
      setFormError(null);
      await onSubmit(data);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save location';
      setFormError(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingArea ? `Edit Location: ${editingArea.displayName || editingArea.name}` : 'Create Location'}
      description={
        editingArea
          ? 'Update the storage location name'
          : 'Add a new warehouse storage location'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to save location</p>
              <p className="mt-0.5">{formError}</p>
            </div>
          </div>
        )}

        <Input
          label="Location"
          placeholder="e.g. Main Store, Shelf A1, Bulk Storage..."
          error={errors.name?.message}
          required
          autoFocus
          {...register('name')}
        />

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {editingArea ? 'Save Changes' : 'Create Location'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
