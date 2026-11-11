import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Area } from '../../types';

const areaSchema = z.object({
  areaNumber: z.coerce
    .number()
    .int('Area number must be an integer')
    .positive('Area number must be a positive integer'),
  description: z.string().trim().max(500).optional(),
});

type AreaFormData = z.infer<typeof areaSchema>;

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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
  });

  useEffect(() => {
    if (editingArea) {
      reset({
        areaNumber: editingArea.areaNumber,
        description: editingArea.description || '',
      });
    } else {
      reset({
        areaNumber: undefined,
        description: '',
      });
    }
  }, [editingArea, reset, isOpen]);

  const handleFormSubmit = async (data: AreaFormData) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingArea ? `Edit Area ${editingArea.areaNumber}` : 'Create Numbered Area'}
      description={
        editingArea
          ? 'Update the description for this storage area'
          : 'Create a new numbered area for stock allocation (e.g. Area 1, Area 2)'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input
          label="Area Number"
          type="number"
          placeholder="e.g. 1, 2, 3"
          disabled={!!editingArea} // Area number is immutable once created to preserve historical sequence
          error={errors.areaNumber?.message}
          helperText={
            editingArea ? 'Area number cannot be changed once created.' : 'Positive whole integer'
          }
          {...register('areaNumber')}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Description / Location Details
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Rack A-12, Ground Floor, Bulk Storage..."
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700"
            {...register('description')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            {editingArea ? 'Save Changes' : 'Create Area'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

