import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, FolderTree } from 'lucide-react';
import { sectionsApi } from '../sections/sectionsApi';
import { SectionModal } from './SectionModal';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { Section } from '../../types';

export interface SectionsManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SectionsManageModal: React.FC<SectionsManageModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sections', 'list', search],
    queryFn: () => sectionsApi.getSections({ activeOnly: 'false', limit: 500, search: search.trim() || undefined }),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: sectionsApi.createSection,
    onSuccess: (section) => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast.success(`Section "${section.name}" created successfully.`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to create section';
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => sectionsApi.updateSection(id, data),
    onSuccess: (section) => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success(`Section "${section.name}" updated.`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to update section';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: sectionsApi.deleteSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast.success('Section deleted successfully.');
      setDeletingSection(null);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to delete section';
      toast.error(message);
    },
  });

  const handleToggleActive = async (section: Section) => {
    try {
      await updateMutation.mutateAsync({
        id: section._id,
        data: { isActive: !section.isActive },
      });
    } catch {
      // Handled in onError
    }
  };

  const sections = data?.data || [];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Warehouse Sections"
        description="Warehouse sections group and categorize stock storage areas (e.g. Ground Floor, First Floor)"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
              onClick={() => {
                setEditingSection(null);
                setSectionModalOpen(true);
              }}
            >
              Add Section
            </Button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            {isLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : sections.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <FolderTree className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm">No sections found</p>
                <p className="text-xs text-slate-400 mt-1">Add your first section to organize areas.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium text-xs uppercase tracking-wider sticky top-0">
                    <th className="py-2.5 px-3">Section Name</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sections.map((section) => (
                    <tr key={section._id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{section.name}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs max-w-xs truncate">
                        {section.description || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(section)}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                        >
                          <Badge variant={section.isActive ? 'active' : 'archived'}>
                            {section.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSection(section);
                              setSectionModalOpen(true);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingSection(section)}
                            className="hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Section Create/Edit Submodal */}
      <SectionModal
        isOpen={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        onSubmit={async (formData) => {
          if (editingSection) {
            await updateMutation.mutateAsync({ id: editingSection._id, data: formData });
          } else {
            await createMutation.mutateAsync(formData);
          }
        }}
        editingSection={editingSection}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Confirm Delete Section */}
      <ConfirmDialog
        isOpen={!!deletingSection}
        onClose={() => setDeletingSection(null)}
        onConfirm={async () => {
          if (deletingSection) {
            await deleteMutation.mutateAsync(deletingSection._id);
          }
        }}
        title="Delete Warehouse Section"
        message={`Are you sure you want to delete section "${deletingSection?.name}"? Deletion is only allowed if no areas belong to this section.`}
        confirmText="Delete Section"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};
