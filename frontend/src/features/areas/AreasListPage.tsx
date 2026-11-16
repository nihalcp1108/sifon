import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Edit2, Trash2, Search, CheckCircle2, XCircle, AlertCircle, RotateCw } from 'lucide-react';
import { areasApi } from './areasApi';
import { AreaFormModal } from './AreaFormModal';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TableSkeleton } from '../../components/common/Skeleton';
import { Pagination } from '../../components/common/Pagination';
import { useToast } from '../../components/common/Toast';
import { Area } from '../../types';
import { formatDate } from '../../lib/utils';

export const AreasListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [deletingArea, setDeletingArea] = useState<Area | null>(null);
  const [search, setSearch] = useState('');

  // Fetch locations (areas)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['locations', 'list', page, search],
    queryFn: ({ signal }) =>
      areasApi.getAreas(
        {
          page,
          limit: 25,
          search: search.trim() || undefined,
        },
        signal
      ),
  });

  const createMutation = useMutation({
    mutationFn: areasApi.createArea,
    onSuccess: (area) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success(`Location "${area.displayName || area.name}" created successfully.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create location';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => areasApi.updateArea(id, data),
    onSuccess: (area) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success(`Location "${area.displayName || area.name}" updated.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update location';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: areasApi.deleteArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success('Location deleted successfully.');
      setDeletingArea(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to delete location';
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const locations = data?.data || [];
  const meta = data?.meta || { page: 1, limit: 25, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        subtitle="Manage warehouse inventory storage locations"
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
            onClick={() => {
              setEditingArea(null);
              setAreaModalOpen(true);
            }}
          >
            Add Location
          </Button>
        }
      />

      {/* Filter and search toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search locations by name..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:bg-white transition-colors"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {meta.total} {meta.total === 1 ? 'location' : 'locations'}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : isError ? (
          <div className="p-12 text-center text-rose-500">
            <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">Failed to load locations</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {(error as any)?.response?.data?.message || (error as any)?.message || 'An error occurred while communicating with the server.'}
            </p>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RotateCw className="w-4 h-4 text-slate-600" />}
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : locations.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">
              {search ? 'No matching locations found' : 'No locations created yet'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {search
                ? 'Try clearing or changing your search terms.'
                : 'Create storage locations to track stock levels accurately.'}
            </p>
            {search ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
                Clear Search
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
                onClick={() => {
                  setEditingArea(null);
                  setAreaModalOpen(true);
                }}
              >
                Add Location
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-6">Location</th>
                    <th className="py-3.5 px-6 text-center">Status</th>
                    <th className="py-3.5 px-6">Created Date</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {locations.map((loc) => {
                    const locationName = loc.displayName || loc.name || 'Location';

                    return (
                      <tr key={loc._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-slate-900">
                          {locationName}
                        </td>
                        <td className="py-3.5 px-6 text-center">
                          <button
                            onClick={() => handleToggleActive(loc)}
                            className="cursor-pointer transition-opacity hover:opacity-80"
                            title={loc.isActive ? 'Click to deactivate' : 'Click to activate'}
                          >
                            <Badge variant={loc.isActive ? 'active' : 'archived'}>
                              {loc.isActive ? (
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
                        <td className="py-3.5 px-6 text-slate-500 text-xs">{formatDate(loc.createdAt)}</td>
                        <td className="py-3.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingArea(loc);
                                setAreaModalOpen(true);
                              }}
                              title="Edit Location"
                            >
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingArea(loc)}
                              title="Delete Location"
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

            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              onPageChange={(newPage) => setPage(newPage)}
              isLoading={isLoading}
            />
          </>
        )}
      </div>

      {/* Location Form Modal */}
      <AreaFormModal
        isOpen={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
        onSubmit={async (formData) => {
          if (editingArea) {
            await updateMutation.mutateAsync({
              id: editingArea._id,
              data: {
                name: formData.name,
              },
            });
          } else {
            await createMutation.mutateAsync({
              name: formData.name,
            });
          }
        }}
        editingArea={editingArea}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Location Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingArea}
        onClose={() => setDeletingArea(null)}
        onConfirm={async () => {
          if (deletingArea) {
            await deleteMutation.mutateAsync(deletingArea._id);
          }
        }}
        title="Delete Location"
        message={`Are you sure you want to delete "${deletingArea?.displayName || deletingArea?.name || 'this location'}"? You can only delete locations that have no existing stock balances or transaction records.`}
        confirmText="Delete Location"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
