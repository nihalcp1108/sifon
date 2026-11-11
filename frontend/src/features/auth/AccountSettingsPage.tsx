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
} from 'lucide-react';
import { useAuth } from './useAuth';
import { authApi } from './authApi';
import { Button } from '../../components/common/Button';

// Validation schemas matching backend
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
      </div>
    </div>
  );
};

