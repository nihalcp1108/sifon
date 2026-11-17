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
import { useAuth } from '../features/auth/useAuth';

/**
 * Route guard restricting access to Administrator role.
 * Redirects restricted roles (like PRODUCT_VIEWER) to /products.
 */
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role === 'PRODUCT_VIEWER') {
    return <Navigate to="/products" replace />;
  }
  return children;
};

/**
 * Handles role-based initial landing redirection.
 */
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'PRODUCT_VIEWER') {
    return <Navigate to="/products" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Protected App Routes */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />

        {/* 1. Brands */}
        <Route path="/brands" element={<AdminRoute><BrandsListPage /></AdminRoute>} />

        {/* 2. Categories */}
        <Route path="/categories" element={<AdminRoute><CategoriesListPage /></AdminRoute>} />

        {/* 3. Locations */}
        <Route path="/locations" element={<AdminRoute><AreasListPage /></AdminRoute>} />
        <Route path="/areas" element={<Navigate to="/locations" replace />} />

        {/* 4. Products (Accessible to both admin & PRODUCT_VIEWER) */}
        <Route path="/products" element={<ProductsListPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />

        {/* 5. Purchases */}
        <Route path="/purchases" element={<AdminRoute><PurchasesListPage /></AdminRoute>} />
        <Route path="/purchases/new" element={<AdminRoute><PurchaseCreatePage /></AdminRoute>} />
        <Route path="/purchases/:id" element={<AdminRoute><PurchaseDetailPage /></AdminRoute>} />

        {/* 6. Sales */}
        <Route path="/sales" element={<AdminRoute><SalesListPage /></AdminRoute>} />
        <Route path="/sales/new" element={<AdminRoute><SaleCreatePage /></AdminRoute>} />
        <Route path="/sales/:id" element={<AdminRoute><SaleDetailPage /></AdminRoute>} />

        {/* 7. Returns */}
        <Route path="/returns" element={<AdminRoute><ReturnsListPage /></AdminRoute>} />
        <Route path="/returns/new" element={<AdminRoute><ReturnCreatePage /></AdminRoute>} />
        <Route path="/returns/:id" element={<AdminRoute><ReturnDetailPage /></AdminRoute>} />

        {/* 8. Damaged */}
        <Route path="/damaged" element={<AdminRoute><DamagedListPage /></AdminRoute>} />

        {/* 9. Stock Statement */}
        <Route path="/statement" element={<AdminRoute><StockStatementPage /></AdminRoute>} />

        {/* 10. Admin Account Settings */}
        <Route path="/settings" element={<AdminRoute><AccountSettingsPage /></AdminRoute>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};
