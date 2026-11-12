import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus, Edit2, Trash2, Search, CheckCircle2, XCircle, FolderTree } from 'lucide-react';
import { areasApi } from './areasApi';
import { sectionsApi } from '../sections/sectionsApi';
import { AreaFormModal } from './AreaFormModal';
import { SectionsManageModal } from './SectionsManageModal';
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
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [sectionsModalOpen, setSectionsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [deletingArea, setDeletingArea] = useState<Area | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('');

  // Fetch sections for filter dropdown
  const { data: sectionsData } = useQuery({
    queryKey: ['sections', 'options'],
    queryFn: () => sectionsApi.getSectionOptions({ limit: 200 }),
  });
  const sections = sectionsData?.data || [];

  // Fetch areas
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['areas', 'list', search, selectedSectionFilter],
    queryFn: () =>
      areasApi.getAreas({
        activeOnly: 'false',
        limit: 500,
        search: search.trim() || undefined,
        sectionId: selectedSectionFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: areasApi.createArea,
    onSuccess: (area) => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success(`Area "${area.displayName || area.name}" created successfully.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create area';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => areasApi.updateArea(id, data),
    onSuccess: (area) => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success(`Area "${area.displayName || area.name}" updated.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update area';
      toast.error(msg);
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
      const msg = err.response?.data?.message || err.message || 'Failed to delete area';
      toast.error(msg);
    },
  });

  const handleToggleActive = async (area: Area) => {
    try {
      await updateMutation.mutateAsync({
        id: area._id,
        data: { isActive: !area.isActive },
      });
    } catch {
      // Handled in onError
    }
  };

  const areas = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Areas"
        subtitle="Manage named storage areas grouped under warehouse sections"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FolderTree className="w-4 h-4 text-slate-600" />}
              onClick={() => setSectionsModalOpen(true)}
            >
              Manage Sections
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
              onClick={() => {
                setEditingArea(null);
                setAreaModalOpen(true);
              }}
            >
              Add Area
            </Button>
          </div>
        }
      />

      {/* Filter and search toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search areas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:bg-white transition-colors"
            />
          </div>

          <div className="w-full sm:w-60">
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:bg-white transition-colors"
            >
              <option value="">All Warehouse Sections</option>
              {sections.map((sec) => (
                <option key={sec._id} value={sec._id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {areas.length} {areas.length === 1 ? 'area' : 'areas'}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : isError ? (
          <div className="p-12 text-center text-rose-500">
            <p className="font-semibold">Failed to load areas</p>
            <p className="text-xs text-slate-500 mt-1">{(error as any)?.message || 'An error occurred'}</p>
          </div>
        ) : areas.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">
              {search || selectedSectionFilter ? 'No matching areas found' : 'No storage areas created yet'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {search || selectedSectionFilter
                ? 'Try clearing or changing your filters'
                : 'Create sections and storage areas to track stock location and movements accurately.'}
            </p>
            {!search && !selectedSectionFilter && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
                onClick={() => {
                  setEditingArea(null);
                  setAreaModalOpen(true);
                }}
              >
                Add Area
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Area Location</th>
                  <th className="py-3 px-4">Area Name</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {areas.map((area) => {
                  const sectionName =
                    typeof area.sectionId === 'object' && (area.sectionId as any)?.name
                      ? (area.sectionId as any).name
                      : (area.section as any)?.name || '—';

                  return (
                    <tr key={area._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {area.displayName || (sectionName !== '—' ? `${sectionName} — ${area.name || `Area ${area.areaNumber}`}` : (area.name || `Area ${area.areaNumber}`))}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{area.name || (area.areaNumber ? `Area ${area.areaNumber}` : '—')}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {sectionName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {area.description || <span className="text-slate-400 italic">No description</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(area)}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                          title={area.isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <Badge variant={area.isActive ? 'active' : 'archived'}>
                            {area.isActive ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Inactive
                              </span>
                            )}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(area.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingArea(area);
                              setAreaModalOpen(true);
                            }}
                            title="Edit Area"
                          >
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingArea(area)}
                            title="Delete Area"
                            className="hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Area Form Modal */}
      <AreaFormModal
        isOpen={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
        onSubmit={async (formData) => {
          if (editingArea) {
            await updateMutation.mutateAsync({
              id: editingArea._id,
              data: {
                name: formData.name,
                sectionId: formData.sectionId,
                description: formData.description,
              },
            });
          } else {
            await createMutation.mutateAsync({
              name: formData.name,
              sectionId: formData.sectionId,
              description: formData.description,
            });
          }
        }}
        editingArea={editingArea}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Sections Management Modal */}
      <SectionsManageModal
        isOpen={sectionsModalOpen}
        onClose={() => {
          setSectionsModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['sections'] });
          queryClient.invalidateQueries({ queryKey: ['areas'] });
        }}
      />

      {/* Area Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingArea}
        onClose={() => setDeletingArea(null)}
        onConfirm={async () => {
          if (deletingArea) {
            await deleteMutation.mutateAsync(deletingArea._id);
          }
        }}
        title="Delete Storage Area"
        message={`Are you sure you want to delete "${deletingArea?.displayName || deletingArea?.name}"? You can only delete areas that have no existing stock balances or historical transaction records.`}
        confirmText="Delete Area"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
