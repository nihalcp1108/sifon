import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { BrandsListPage } from '../features/brands/BrandsListPage';
import { CategoriesListPage } from '../features/categories/CategoriesListPage';
import { AreasListPage } from '../features/areas/AreasListPage';
import { ProductsListPage } from '../features/products/ProductsListPage';
import { ProductDetailPage } from '../features/products/ProductDetailPage';
import { PurchasesListPage } from '../features/purchases/PurchasesListPage';
import { PurchaseCreatePage } from '../features/purchases/PurchaseCreatePage';
import { PurchaseDetailPage } from '../features/purchases/PurchaseDetailPage';
import { SalesListPage } from '../features/sales/SalesListPage';
import { SaleCreatePage } from '../features/sales/SaleCreatePage';
import { SaleDetailPage } from '../features/sales/SaleDetailPage';
import { ReturnsListPage } from '../features/returns/ReturnsListPage';
import { ReturnCreatePage } from '../features/returns/ReturnCreatePage';
import { ReturnDetailPage } from '../features/returns/ReturnDetailPage';
import { DamagedListPage } from '../features/damaged/DamagedListPage';
import { StockStatementPage } from '../features/reports/StockStatementPage';
import { AccountSettingsPage } from '../features/auth/AccountSettingsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Protected App Routes */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* 1. Brands */}
        <Route path="/brands" element={<BrandsListPage />} />

        {/* 2. Categories */}
        <Route path="/categories" element={<CategoriesListPage />} />

        {/* 3. Areas */}
        <Route path="/areas" element={<AreasListPage />} />

        {/* 4. Products */}
        <Route path="/products" element={<ProductsListPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />

        {/* 5. Purchases */}
        <Route path="/purchases" element={<PurchasesListPage />} />
        <Route path="/purchases/new" element={<PurchaseCreatePage />} />
        <Route path="/purchases/:id" element={<PurchaseDetailPage />} />

        {/* 6. Sales */}
        <Route path="/sales" element={<SalesListPage />} />
        <Route path="/sales/new" element={<SaleCreatePage />} />
        <Route path="/sales/:id" element={<SaleDetailPage />} />

        {/* 7. Returns */}
        <Route path="/returns" element={<ReturnsListPage />} />
        <Route path="/returns/new" element={<ReturnCreatePage />} />
        <Route path="/returns/:id" element={<ReturnDetailPage />} />

        {/* 8. Damaged */}
        <Route path="/damaged" element={<DamagedListPage />} />

        {/* 9. Stock Statement */}
        <Route path="/statement" element={<StockStatementPage />} />

        {/* 10. Admin Account Settings */}
        <Route path="/settings" element={<AccountSettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
