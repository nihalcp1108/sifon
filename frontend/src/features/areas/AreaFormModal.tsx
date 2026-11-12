import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SectionModal } from './SectionModal';
import { sectionsApi } from '../sections/sectionsApi';
import { useToast } from '../../components/common/Toast';
import { Area, Section } from '../../types';

const areaSchema = z.object({
  name: z
    .string({ required_error: 'Area name is required' })
    .trim()
    .min(1, 'Area name cannot be empty')
    .max(100, 'Area name cannot exceed 100 characters'),
  sectionId: z
    .string({ required_error: 'Section is required' })
    .trim()
    .min(1, 'Please select a section'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
});

export type AreaFormData = z.infer<typeof areaSchema>;

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
  const queryClient = useQueryClient();
  const toast = useToast();
  const [sectionModalOpen, setSectionModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
  });

  const selectedSectionId = watch('sectionId');

  // Load section options
  const { data: sectionData, isLoading: loadingSections } = useQuery({
    queryKey: ['sections', 'options'],
    queryFn: () => sectionsApi.getSectionOptions({ limit: 200, activeOnly: 'true' }),
    enabled: isOpen,
  });

  const sections = sectionData?.data || [];

  useEffect(() => {
    if (editingArea) {
      const sectionIdVal =
        typeof editingArea.sectionId === 'object' && editingArea.sectionId
          ? (editingArea.sectionId as any)._id
          : (editingArea.sectionId as string) || '';

      reset({
        name: editingArea.name || (editingArea.areaNumber ? `Area ${editingArea.areaNumber}` : ''),
        sectionId: sectionIdVal,
        description: editingArea.description || '',
      });
    } else {
      reset({
        name: '',
        sectionId: '',
        description: '',
      });
    }
  }, [editingArea, reset, isOpen]);

  // Create section inline mutation
  const createSectionMutation = useMutation({
    mutationFn: sectionsApi.createSection,
    onSuccess: (newSection: Section) => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast.success(`Section "${newSection.name}" created.`);
      // Automatically select the newly created section in the area form without losing any entered details
      setValue('sectionId', newSection._id, { shouldValidate: true, shouldDirty: true });
      setSectionModalOpen(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create section';
      toast.error(msg);
    },
  });

  const handleFormSubmit = async (data: AreaFormData) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editingArea ? `Edit Area: ${editingArea.displayName || editingArea.name}` : 'Create Storage Area'}
        description={
          editingArea
            ? 'Update the area name, section assignment, or description'
            : 'Add a new named warehouse storage location grouped under a section'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <Input
            label="Area Name"
            placeholder="e.g. Main Store, Rack A-1, Bulk Bay 3..."
            error={errors.name?.message}
            required
            autoFocus
            {...register('name')}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="area-section-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Section <span className="text-rose-500">*</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                leftIcon={<Plus className="w-3 h-3 text-teal-600" />}
                onClick={() => setSectionModalOpen(true)}
                className="text-xs py-0.5 px-2"
              >
                Add Section
              </Button>
            </div>

            <select
              id="area-section-select"
              className={`w-full px-3 py-2 bg-white border rounded-lg text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-700 ${
                errors.sectionId ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300'
              }`}
              value={selectedSectionId || ''}
              onChange={(e) => setValue('sectionId', e.target.value, { shouldValidate: true })}
            >
              <option value="">-- Select a Section --</option>
              {sections.map((sec) => (
                <option key={sec._id} value={sec._id}>
                  {sec.name}
                </option>
              ))}
            </select>
            {errors.sectionId && (
              <p className="mt-1 text-xs text-rose-500">{errors.sectionId.message}</p>
            )}
            {sections.length === 0 && !loadingSections && (
              <p className="mt-1.5 text-xs text-amber-600 font-medium">
                No sections available yet. Click <strong>+ Add Section</strong> above to create one.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description / Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Specific shelf, bin coordinates, or temperature details..."
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
              {editingArea ? 'Save Changes' : 'Create Area'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inline Section Creation Modal */}
      <SectionModal
        isOpen={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        onSubmit={async (data) => {
          await createSectionMutation.mutateAsync(data);
        }}
        isLoading={createSectionMutation.isPending}
      />
    </>
  );
};
