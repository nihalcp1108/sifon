import React, { useState } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layers, Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from './useAuth';
import { Button } from '../../components/common/Button';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { user, login, isLoading: isCheckingSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  // Extract any feedback message from router state or query parameters
  const queryParam = new URLSearchParams(location.search).get('message');
  const flashMessage =
    (location.state as any)?.message ||
    (queryParam === 'email_updated'
      ? 'Email updated. Please sign in with your new email.'
      : queryParam === 'password_updated'
      ? 'Password updated. Please sign in with your new password.'
      : null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-navy-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Checking session...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      setServerError(null);
      await login(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setServerError(err.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-navy-900 flex items-center justify-center shadow-lg shadow-navy-900/20 text-white">
            <Layers className="w-6 h-6 text-teal-400" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-navy-900">Sifon</span>
        </div>
        <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-slate-800">
          Stock Management Portal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Enter your administrator credentials to access inventory
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200/80 sm:px-10">
          {flashMessage && (
            <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
              <div className="font-medium">{flashMessage}</div>
            </div>
          )}

          {serverError && (
            <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <span>{serverError}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="admin@sifon.local"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 shadow-md shadow-navy-900/10"
                isLoading={isSubmitting}
              >
                Sign In to Sifon
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          Sifon Inventory & Stock Management System &bull; Version 1.0
        </div>
      </div>
    </div>
  );
};

