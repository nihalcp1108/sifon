import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Brand } from '../../types';

const brandSchema = z.object({
  name: z
    .string({ required_error: 'Brand name is required' })
    .trim()
    .min(1, 'Brand name cannot be empty')
    .max(100, 'Brand name cannot exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
});

type BrandFormData = z.infer<typeof brandSchema>;

export interface BrandFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BrandFormData) => Promise<void>;
  editingBrand?: Brand | null;
  isLoading?: boolean;
}

export const BrandFormModal: React.FC<BrandFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingBrand,
  isLoading,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
  });

  useEffect(() => {
    if (editingBrand) {
      reset({
        name: editingBrand.name,
        description: editingBrand.description || '',
      });
    } else {
      reset({
        name: '',
        description: '',
      });
    }
  }, [editingBrand, reset, isOpen]);

  const handleFormSubmit = async (data: BrandFormData) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingBrand ? 'Edit Brand' : 'Create Brand'}
      description={
        editingBrand
          ? 'Update the brand details'
          : 'Add a new product brand to categorize your inventory'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input
          label="Brand Name"
          placeholder="e.g. Samsung, Apple, Nike..."
          error={errors.name?.message}
          required
          autoFocus
          {...register('name')}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Optional brand notes or manufacturer details..."
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700"
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-500">{errors.description.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {editingBrand ? 'Save Changes' : 'Create Brand'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

