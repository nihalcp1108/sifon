import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  UserCheck,
  Users,
  UserPlus,
  Key,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { authApi } from './authApi';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../components/common/Toast';
import { formatDate } from '../../lib/utils';
import { User } from '../../types';

// Validation schemas matching backend
const createViewerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .refine(
      (val) => new TextEncoder().encode(val).length <= 72,
      'Password cannot exceed 72 bytes'
    ),
});

type CreateViewerFormData = z.infer<typeof createViewerSchema>;
const changeEmailFormSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  currentPassword: z.string().min(1, 'Current password is required to verify your identity'),
});

type ChangeEmailFormData = z.infer<typeof changeEmailFormSchema>;

const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters')
      .refine(
        (val) => new TextEncoder().encode(val).length <= 72,
        'Password cannot exceed 72 bytes'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password cannot be the same as your current password',
    path: ['newPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordFormSchema>;

export const AccountSettingsPage: React.FC = () => {
  const { user, clearSession } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Employee viewer state
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [showViewerPassword, setShowViewerPassword] = useState(false);
  const [viewerServerError, setViewerServerError] = useState<string | null>(null);

  // Users query
  const { data: usersData } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => authApi.listUsers(),
    enabled: user?.role === 'admin',
  });
  const usersList = usersData || [];

  // Create viewer mutation
  const createViewerMutation = useMutation({
    mutationFn: (data: CreateViewerFormData) => authApi.createProductViewer(data),
    onSuccess: (newViewer) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Product Viewer account created for ${newViewer.email}.`);
      setViewerServerError(null);
      resetViewerForm();
    },
    onError: (err: any) => {
      let msg = 'Failed to create employee account. Please try again.';
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message || err.message;

      if (status === 409) {
        msg = 'An account with this email address already exists. Please choose a different email.';
      } else if (status === 404) {
        msg = 'The account creation endpoint was not found on the server (404). Please ensure the backend server has been restarted with the latest routes.';
      } else if (status === 403 || status === 401) {
        msg = 'You do not have administrative permission to create accounts.';
      } else if (status === 400) {
        msg = serverMsg || 'Invalid email or password format. Please verify your inputs.';
      } else if (serverMsg) {
        msg = serverMsg;
      }
      setViewerServerError(msg);
      toast.error(msg);
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      authApi.toggleUserStatus(id, isActive),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.info(`Account ${updated.email} is now ${updated.isActive ? 'Active' : 'Inactive'}.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update user status';
      toast.error(msg);
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      authApi.resetUserPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Password has been reset successfully.');
      setResetModalUser(null);
      setResetPasswordVal('');
      setResetPasswordError(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password';
      setResetPasswordError(msg);
    },
  });

  // Viewer form setup
  const {
    register: registerViewer,
    handleSubmit: handleSubmitViewer,
    reset: resetViewerForm,
    formState: { errors: viewerErrors, isSubmitting: isSubmittingViewer },
  } = useForm<CreateViewerFormData>({
    resolver: zodResolver(createViewerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onViewerSubmit = async (data: CreateViewerFormData) => {
    try {
      setViewerServerError(null);
      await createViewerMutation.mutateAsync(data);
    } catch {
      // Error handled cleanly in createViewerMutation onError callback
    }
  };

  // Email form state
  const [emailServerError, setEmailServerError] = useState<string | null>(null);
  const [showEmailCurrentPassword, setShowEmailCurrentPassword] = useState(false);

  // Password form state
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email form setup
  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    reset: resetEmailForm,
    formState: { errors: emailErrors, isSubmitting: isSubmittingEmail },
  } = useForm<ChangeEmailFormData>({
    resolver: zodResolver(changeEmailFormSchema),
    defaultValues: {
      newEmail: '',
      currentPassword: '',
    },
  });

  // Password form setup
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors, isSubmitting: isSubmittingPassword },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Handle Email Change
  const onEmailSubmit = async (data: ChangeEmailFormData) => {
    try {
      setEmailServerError(null);

      // Client pre-check for unchanged email
      if (user?.email && data.newEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) {
        setEmailServerError('New email must be different from current email');
        return;
      }

      await authApi.changeEmail({
        newEmail: data.newEmail,
        currentPassword: data.currentPassword,
      });

      resetEmailForm();
      clearSession();
      navigate('/login?message=email_updated', {
        replace: true,
        state: { message: 'Email updated. Please sign in with your new email.' },
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update email. Please check your credentials and try again.';
      setEmailServerError(msg);
    }
  };

  // Handle Password Change
  const onPasswordSubmit = async (data: ChangePasswordFormData) => {
    try {
      setPasswordServerError(null);

      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      resetPasswordForm();
      clearSession();
      navigate('/login?message=password_updated', {
        replace: true,
        state: { message: 'Password updated. Please sign in with your new password.' },
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update password. Please check your current password and try again.';
      setPasswordServerError(msg);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your administrator profile, login credentials, and security preferences.
        </p>
      </div>

      {/* Account Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-navy-100 border border-navy-200 text-navy-900 flex items-center justify-center font-bold text-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">{user?.name || 'Administrator'}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                {user?.role || 'admin'}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">{user?.email}</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Active Authenticated Session</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Card 1: Change Email */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-navy-50 border border-navy-100 flex items-center justify-center text-navy-800">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Change Login Email</h2>
              <p className="text-xs text-slate-500">
                Update your login email address. For security, changing your email requires current password confirmation and will end all active sessions.
              </p>
            </div>
          </div>

          <div className="p-6">
            {emailServerError && (
              <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                <span>{emailServerError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEmail(onEmailSubmit)} className="space-y-4 max-w-lg">
              {/* Current Email (Read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Current Email
                </label>
                <div className="relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    disabled
                    readOnly
                    value={user?.email || ''}
                    className="block w-full pl-9 pr-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono cursor-not-allowed select-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">This is your current administrator login identity.</p>
              </div>

              {/* New Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="new-email@example.com"
                    className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700"
                    {...registerEmail('newEmail')}
                  />
                </div>
                {emailErrors.newEmail && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{emailErrors.newEmail.message}</p>
                )}
              </div>

              {/* Current Password Confirmation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showEmailCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter current password to confirm"
                    className="block w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700"
                    {...registerEmail('currentPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailCurrentPassword(!showEmailCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showEmailCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showEmailCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {emailErrors.currentPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{emailErrors.currentPassword.message}</p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingEmail}
                  className="bg-navy-900 hover:bg-navy-800 px-5"
                >
                  Save Email
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Card 2: Change Password */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-navy-50 border border-navy-100 flex items-center justify-center text-navy-800">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
              <p className="text-xs text-slate-500">
                Choose a strong passphrase of at least 12 characters. Updating your password will sign you out of all sessions.
              </p>
            </div>
          </div>

          <div className="p-6">
            {passwordServerError && (
              <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                <span>{passwordServerError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4 max-w-lg">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your existing password"
                    className="block w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700"
                    {...registerPassword('currentPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Minimum 12 characters (passphrases allowed)"
                    className="block w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700"
                    {...registerPassword('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{passwordErrors.newPassword.message}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  Password must be at least 12 characters. Spaces and passphrases are supported. Maximum 72 bytes.
                </p>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    className="block w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700"
                    {...registerPassword('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{passwordErrors.confirmPassword.message}</p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingPassword}
                  className="bg-navy-900 hover:bg-navy-800 px-5"
                >
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Card 3: Employee Accounts (Product Viewers) - Admin Only */}
        {user?.role === 'admin' && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-800">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Employee Accounts (Product Viewers)</h2>
                  <p className="text-xs text-slate-500">
                    Create and manage read-only Product Viewer accounts. Viewers can browse products, search, and view location stock, but cannot modify records or transactions.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Form to Create Product Viewer */}
              <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-teal-600" />
                  Create Product Viewer Account
                </h3>

                {viewerServerError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                    <span>{viewerServerError}</span>
                  </div>
                )}

                <form
                  onSubmit={handleSubmitViewer(onViewerSubmit)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. viewer@example.com"
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700"
                      {...registerViewer('email')}
                    />
                    {viewerErrors.email && (
                      <p className="mt-1 text-xs text-rose-600 font-medium">{viewerErrors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Initial Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative rounded-lg">
                      <input
                        type={showViewerPassword ? 'text' : 'password'}
                        placeholder="Min 6 characters"
                        className="block w-full pl-3 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700"
                        {...registerViewer('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowViewerPassword(!showViewerPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showViewerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {viewerErrors.password && (
                      <p className="mt-1 text-xs text-rose-600 font-medium">{viewerErrors.password.message}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSubmittingViewer || createViewerMutation.isPending}
                      disabled={isSubmittingViewer || createViewerMutation.isPending}
                      leftIcon={<UserPlus className="w-4 h-4 text-teal-400" />}
                      className="bg-navy-900 hover:bg-navy-800"
                    >
                      Create Viewer Account
                    </Button>
                  </div>
                </form>
              </div>

              {/* List of Accounts */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                  Existing Accounts ({usersList.length})
                </h3>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Created Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map((u) => (
                        <tr key={u._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-semibold text-slate-900 block">{u.name || u.email}</span>
                              <span className="font-mono text-xs text-slate-400">{u.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                u.role === 'admin'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-teal-50 text-teal-700 border border-teal-200'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={u.isActive ? 'active' : 'archived'}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                            {formatDate(u.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {u.role === 'PRODUCT_VIEWER' ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setResetModalUser(u);
                                    setResetPasswordVal('');
                                    setResetPasswordError(null);
                                  }}
                                  leftIcon={<Key className="w-3.5 h-3.5 text-slate-500" />}
                                  className="text-xs"
                                >
                                  Reset Password
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    toggleStatusMutation.mutate({
                                      id: (u._id || u.id),
                                      isActive: !u.isActive,
                                    })
                                  }
                                  className={`text-xs ${
                                    u.isActive
                                      ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                      : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                >
                                  {u.isActive ? 'Deactivate' : 'Activate'}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Primary Admin</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetModalUser && (
        <Modal
          isOpen={!!resetModalUser}
          onClose={() => setResetModalUser(null)}
          title={`Reset Password for ${resetModalUser.name || resetModalUser.email}`}
          description={`Set a new temporary password for ${resetModalUser.email}. Their active session will be invalidated immediately.`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            {resetPasswordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {resetPasswordError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter new password (min 6 chars)"
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700 font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setResetModalUser(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={resetPasswordMutation.isPending}
                disabled={resetPasswordVal.trim().length < 6}
                onClick={() =>
                  resetPasswordMutation.mutate({
                    id: (resetModalUser._id || resetModalUser.id),
                    password: resetPasswordVal.trim(),
                  })
                }
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

