import { apiClient } from '../../lib/apiClient';
import { User } from '../../types';

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post<{ data: { user: User; token: string } }>('/auth/login', {
      email,
      password,
    });
    return res.data.data;
  },

  me: async () => {
    const res = await apiClient.get<{ data: { user: User; token?: string } }>('/auth/me');
    return res.data.data;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },

  changeEmail: async (data: { newEmail: string; currentPassword: string }) => {
    const res = await apiClient.put<{ success: boolean; message: string; data?: { message: string } }>(
      '/auth/account/email',
      data
    );
    return res.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    const res = await apiClient.put<{ success: boolean; message: string; data?: { message: string } }>(
      '/auth/account/password',
      data
    );
    return res.data;
  },

  listUsers: async () => {
    const res = await apiClient.get<{ data: User[] }>('/auth/users');
    return res.data.data;
  },

  createProductViewer: async (data: { email: string; password: string }) => {
    const res = await apiClient.post<{ data: User }>('/auth/users', data);
    return res.data.data;
  },

  resetUserPassword: async (id: string, newPassword: string) => {
    const res = await apiClient.put<{ success: boolean; message: string }>(`/auth/users/${id}/password`, {
      password: newPassword,
      newPassword,
    });
    return res.data;
  },

  toggleUserStatus: async (id: string, isActive: boolean) => {
    const res = await apiClient.put<{ data: User }>(`/auth/users/${id}/status`, {
      isActive,
    });
    return res.data.data;
  },
};

