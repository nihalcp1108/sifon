import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Edit2, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { categoriesApi } from './categoriesApi';
import { CategoryFormModal } from './CategoryFormModal';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { Category } from '../../types';
import { formatDate } from '../../lib/utils';

export const CategoriesListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['categories', 'list', search],
    queryFn: () => categoriesApi.getCategories({ activeOnly: 'false', limit: 500, search: search.trim() || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: categoriesApi.createCategory,
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`Category "${category.name}" created successfully.`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to create category';
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => categoriesApi.updateCategory(id, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`Category "${category.name}" updated.`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to update category';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: categoriesApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted successfully.');
      setDeletingCategory(null);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to delete category';
      toast.error(message);
    },
  });

  const handleToggleActive = async (category: Category) => {
    try {
      await updateMutation.mutateAsync({
        id: category._id,
        data: { isActive: !category.isActive },
      });
    } catch {
      // Handled in onError
    }
  };

  const categories = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle="Manage inventory categories and classifications"
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
            onClick={() => {
              setEditingCategory(null);
              setModalOpen(true);
            }}
          >
            Add Category
          </Button>
        }
      />

      {/* Search and filters bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:bg-white transition-colors"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {categories.length} {categories.length === 1 ? 'category' : 'categories'}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : isError ? (
          <div className="p-12 text-center text-rose-500">
            <p className="font-semibold">Failed to load categories</p>
            <p className="text-xs text-slate-500 mt-1">{(error as any)?.message || 'An error occurred'}</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">
              {search ? 'No matching categories found' : 'No categories created yet'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {search
                ? 'Try adjusting your search criteria'
                : 'Create your first category to group related items.'}
            </p>
            {!search && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
                onClick={() => {
                  setEditingCategory(null);
                  setModalOpen(true);
                }}
              >
                Add Category
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category) => (
                  <tr key={category._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{category.name}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {category.description || <span className="text-slate-400 italic">No description</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(category)}
                        className="cursor-pointer transition-opacity hover:opacity-80"
                        title={category.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <Badge variant={category.isActive ? 'active' : 'archived'}>
                          {category.isActive ? (
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
                    <td className="py-3 px-4 text-slate-500">{formatDate(category.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCategory(category);
                            setModalOpen(true);
                          }}
                          title="Edit Category"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingCategory(category)}
                          title="Delete Category"
                          className="hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (formData) => {
          if (editingCategory) {
            await updateMutation.mutateAsync({ id: editingCategory._id, data: formData });
          } else {
            await createMutation.mutateAsync(formData);
          }
        }}
        editingCategory={editingCategory}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={async () => {
          if (deletingCategory) {
            await deleteMutation.mutateAsync(deletingCategory._id);
          }
        }}
        title="Delete Category"
        message={`Are you sure you want to delete category "${deletingCategory?.name}"? Deletion is only permitted if no products are assigned to this category.`}
        confirmText="Delete Category"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
