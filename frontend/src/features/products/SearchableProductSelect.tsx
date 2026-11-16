import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from './productsApi';
import { SearchableSelect, SearchableOption } from '../../components/common/SearchableSelect';

export interface SearchableProductSelectProps {
  value: string;
  onChange: (productId: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  value,
  onChange,
  label = 'Product',
  placeholder = '-- Select a product --',
  error,
  disabled = false,
  required = false,
  id,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'searchable-options', searchTerm.trim(), value],
    queryFn: ({ signal }) =>
      productsApi.getProductOptions(
        {
          search: searchTerm.trim() || undefined,
          activeOnly: true,
          limit: 200,
          selectedId: value && /^[0-9a-fA-F]{24}$/.test(value.trim()) ? value.trim() : undefined,
        },
        signal
      ),
    staleTime: 20000,
  });

  const products = data?.data || [];

  const options: SearchableOption[] = products.map((p) => {
    const brandStr = p.brand?.name ? `Brand: ${p.brand.name}` : '';
    const catStr = p.category?.name ? `Category: ${p.category.name}` : '';
    const subLabel = [brandStr, catStr].filter(Boolean).join(' • ');
    const totalAvail = p.totalAvailable ?? 0;

    return {
      value: p._id,
      label: p.name,
      subLabel: subLabel || undefined,
      badge: `${totalAvail} avail`,
      badgeVariant: totalAvail > 0 ? 'success' : 'default',
    };
  });

  return (
    <SearchableSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="Type product name to search..."
      onSearchChange={setSearchTerm}
      isLoading={isLoading}
      emptyMessage="No products found"
      error={error}
      disabled={disabled}
      required={required}
      className={className}
    />
  );
};

