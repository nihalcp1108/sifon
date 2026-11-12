import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Section } from '../../types';

const sectionSchema = z.object({
  name: z
    .string({ required_error: 'Section name is required' })
    .trim()
    .min(1, 'Section name cannot be empty')
    .max(100, 'Section name cannot exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
});

type SectionFormData = z.infer<typeof sectionSchema>;

export interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SectionFormData) => Promise<Section | void>;
  editingSection?: Section | null;
  isLoading?: boolean;
}

export const SectionModal: React.FC<SectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingSection,
  isLoading,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
  });

  useEffect(() => {
    if (editingSection) {
      reset({
        name: editingSection.name,
        description: editingSection.description || '',
      });
    } else {
      reset({
        name: '',
        description: '',
      });
    }
  }, [editingSection, reset, isOpen]);

  const handleFormSubmit = async (data: SectionFormData) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSection ? 'Edit Section' : 'Create Warehouse Section'}
      description={
        editingSection
          ? 'Update the section details'
          : 'Define a warehouse section (e.g. Ground Floor, First Floor, Cold Storage) to group areas'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input
          label="Section Name"
          placeholder="e.g. Ground Floor, Basement, Mezzanine..."
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
            placeholder="Optional section notes or zone details..."
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
            {editingSection ? 'Save Changes' : 'Create Section'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

