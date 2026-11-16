import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { areasApi } from './areasApi';
import { productsApi } from '../products/productsApi';
import { SearchableSelect, SearchableOption } from '../../components/common/SearchableSelect';

export interface SearchableLocationSelectProps {
  value: string;
  onChange: (locationId: string) => void;
  productId?: string;
  mode?: 'purchase' | 'sale' | 'return' | 'general';
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

export const SearchableLocationSelect: React.FC<SearchableLocationSelectProps> = ({
  value,
  onChange,
  productId,
  mode = 'general',
  label = 'Location',
  placeholder = '-- Select a location --',
  error,
  disabled = false,
  required = false,
  id,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch active locations
  const { data: areasData, isLoading: isLoadingAreas } = useQuery({
    queryKey: ['locations', 'searchable-options', searchTerm.trim(), value],
    queryFn: ({ signal }) =>
      areasApi.getAreaOptions(
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

  const allLocations = areasData?.data || [];

  // 2. If productId provided, fetch product details to know real-time location stock
  const isValidProdId = Boolean(productId && /^[0-9a-fA-F]{24}$/.test(productId.trim()));
  const { data: productDetail, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product-detail-for-loc-select', productId],
    queryFn: () => productsApi.getProductById(productId!.trim()),
    enabled: isValidProdId,
    staleTime: 10000,
  });

  const balances = productDetail?.balances || (productDetail as any)?.areaBalances || [];
  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    const locId = b.areaId?._id?.toString() || b.areaId?.toString();
    if (locId) {
      balanceMap.set(locId, b.availableQuantity || 0);
    }
  }

  // 3. Build options depending on mode
  let options: SearchableOption[] = [];

  if (mode === 'sale' && isValidProdId) {
    // SALE mode: Offer only locations with positive usable stock for the selected product
    const stockedLocIds = new Set(
      balances.filter((b: any) => (b.availableQuantity || 0) > 0).map((b: any) => b.areaId?._id?.toString() || b.areaId?.toString())
    );

    // Filter allLocations to those in stockedLocIds (or selected if already set)
    const validLocations = allLocations.filter((loc) => stockedLocIds.has(loc._id) || loc._id === value);

    options = validLocations.map((loc) => {
      const avail = balanceMap.get(loc._id) ?? 0;
      return {
        value: loc._id,
        label: loc.displayName || loc.name || 'Location',
        badge: `${avail} available`,
        badgeVariant: avail > 0 ? 'success' : 'danger',
        disabled: avail <= 0 && loc._id !== value,
      };
    });
  } else {
    // PURCHASE / RETURN / GENERAL mode: all active locations selectable
    options = allLocations.map((loc) => {
      const avail = balanceMap.get(loc._id);
      return {
        value: loc._id,
        label: loc.displayName || loc.name || 'Location',
        badge: avail !== undefined ? `${avail} in stock` : undefined,
        badgeVariant: avail !== undefined && avail > 0 ? 'success' : 'default',
      };
    });
  }

  const isLoading = isLoadingAreas || (isValidProdId && isLoadingProduct);
  const emptyMsg =
    mode === 'sale' && isValidProdId
      ? 'No locations with available stock for this product'
      : 'No locations found';

  return (
    <SearchableSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="Type location name to search..."
      onSearchChange={setSearchTerm}
      isLoading={isLoading}
      emptyMessage={emptyMsg}
      error={error}
      disabled={disabled}
      required={required}
      className={className}
    />
  );
};
