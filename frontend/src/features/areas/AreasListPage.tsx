import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus, Edit2, Trash2 } from 'lucide-react';
import { areasApi } from './areasApi';
import { AreaFormModal } from './AreaFormModal';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { Area } from '../../types';
import { formatDate } from '../../lib/utils';

export const AreasListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [deletingArea, setDeletingArea] = useState<Area | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['areas', 'list'],
    queryFn: () => areasApi.getAreas({ activeOnly: 'false', limit: 500 }),
  });

  const createMutation = useMutation({
    mutationFn: areasApi.createArea,
    onSuccess: (area) => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success(`Area ${area.areaNumber} created successfully.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create area');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => areasApi.updateArea(id, data),
    onSuccess: (area) => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success(`Area ${area.areaNumber} updated.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update area');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: areasApi.deleteArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success('Area deleted successfully.');
      setDeletingArea(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete area');
    },
  });

  const handleToggleActive = async (area: Area) => {
    try {
      await updateMutation.mutateAsync({
        id: area._id,
        data: { isActive: !area.isActive },
      });
    } catch (err) {
      // Handled in onError
    }
  };

  const areas = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Numbered Stock Areas"
        subtitle="Manage designated numbered warehouse stock locations (Area 1, Area 2, etc.)"
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
            onClick={() => {
              setEditingArea(null);
              setModalOpen(true);
            }}
          >
            Create Area
          </Button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : areas.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No stock areas created yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Numbered areas are required for receiving purchases and allocating inventory.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setEditingArea(null);
                setModalOpen(true);
              }}
            >
              Create Area 1
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Area Name</th>
                  <th className="py-3.5 px-6">Description</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Created Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {areas.map(area => (
                  <tr key={area._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-navy-950">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-md bg-navy-100 text-navy-900 flex items-center justify-center font-bold text-xs">
                          {area.areaNumber}
                        </span>
                        <span>{area.displayName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 max-w-xs truncate">
                      {area.description || <span className="text-slate-400 italic">No description</span>}
                    </td>
                    <td className="py-3.5 px-6">
                      <Badge variant={area.isActive ? 'active' : 'archived'}>
                        {area.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 text-xs">
                      {formatDate(area.createdAt)}
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(area)}
                        title={area.isActive ? 'Deactivate Area' : 'Activate Area'}
                        className="text-xs"
                      >
                        {area.isActive ? (
                          <span className="text-amber-600 hover:text-amber-700">Deactivate</span>
                        ) : (
                          <span className="text-teal-600 hover:text-teal-700">Activate</span>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingArea(area);
                          setModalOpen(true);
                        }}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingArea(area)}
                        leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Area Modal */}
      <AreaFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingArea={editingArea}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={async data => {
          if (editingArea) {
            await updateMutation.mutateAsync({ id: editingArea._id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deletingArea}
        onClose={() => setDeletingArea(null)}
        title={deletingArea ? `Delete ${deletingArea.displayName}?` : 'Delete Area'}
        message="Are you sure you want to delete this area? Hard delete is only permitted if the area has never been used in any historical inventory movements."
        confirmText="Delete Area"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deletingArea) {
            await deleteMutation.mutateAsync(deletingArea._id);
          }
        }}
      />
    </div>
  );
};
