import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, IUser } from './user.model.js';
import { AuditLog } from '../audit/audit.model.js';
import { env } from '../../config/env.js';
import { runInTransaction } from '../../utils/transactions.js';
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../utils/errors.js';
import {
  LoginInput,
  ChangeEmailInput,
  ChangePasswordInput,
} from './auth.validation.js';

export class AuthService {
  static async login(input: LoginInput): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: input.email.toLowerCase().trim() });
    if (!user || !user.isActive) {
      // Use generic invalid credentials error to avoid user enumeration
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion ?? 0,
      },
      env.JWT_SECRET,
      { expiresIn: (env.JWT_EXPIRES_IN || '7d') as any }
    );

    return { user, token };
  }

  static async createAdminIfNotExists(email: string, password: string, name: string): Promise<IUser> {
    const normalizedEmail = email.toLowerCase().trim();

    // Guard: Ensure admin creation/seed scripts do not recreate or overwrite
    // this admin after an email change. If any admin account already exists, preserve it.
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return existingAdmin;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const admin = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
    });

    console.log(`[AuthService] Created initial admin: ${admin.email}`);
    return admin;
  }

  static async changeEmail(
    userId: string | mongoose.Types.ObjectId,
    input: ChangeEmailInput
  ): Promise<{ previousEmail: string; newEmail: string }> {
    // 1. Identify user from authenticated session
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    // 2. Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestError('Invalid current password');
    }

    // 3. Trim and normalize email
    const normalizedNewEmail = input.newEmail.toLowerCase().trim();

    // 4. Reject unchanged email with clear message
    if (normalizedNewEmail === user.email.toLowerCase().trim()) {
      throw new BadRequestError('New email must be different from current email');
    }

    // 5. Prevent duplicate emails using uniqueness check
    const existingWithEmail = await User.findOne({ email: normalizedNewEmail });
    if (existingWithEmail) {
      throw new ConflictError('An account with this email address already exists');
    }

    const previousEmail = user.email;

    const performUpdate = async (session?: any) => {
      user.email = normalizedNewEmail;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save(session ? { session } : undefined);

      await AuditLog.create(
        [
          {
            entityType: 'AUTH',
            entityId: user._id,
            action: 'EMAIL_CHANGED',
            performedBy: user._id,
            details: {
              previousEmail,
              newEmail: normalizedNewEmail,
            },
            timestamp: new Date(),
          },
        ],
        session ? { session } : undefined
      );
    };

    try {
      await runInTransaction(async (session) => {
        await performUpdate(session);
      });
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictError('An account with this email address already exists');
      }
      if (
        error.message?.includes('replica set member') ||
        error.message?.includes('standalone')
      ) {
        // Fallback for standalone dev/test Mongo instances
        await performUpdate();
      } else {
        throw error;
      }
    }

    return { previousEmail, newEmail: normalizedNewEmail };
  }

  static async changePassword(
    userId: string | mongoose.Types.ObjectId,
    input: ChangePasswordInput
  ): Promise<void> {
    // 1. Identify user from authenticated session
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    // 2. Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestError('Invalid current password');
    }

    // 3. Reject reuse of current password
    const isSamePassword = await bcrypt.compare(input.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestError('New password cannot be the same as your current password');
    }

    // 4. Hash new password with bcrypt (cost 12)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.newPassword, salt);

    const performUpdate = async (session?: any) => {
      user.passwordHash = passwordHash;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save(session ? { session } : undefined);

      await AuditLog.create(
        [
          {
            entityType: 'AUTH',
            entityId: user._id,
            action: 'PASSWORD_CHANGED',
            performedBy: user._id,
            details: {
              reason: 'User initiated password update',
            },
            timestamp: new Date(),
          },
        ],
        session ? { session } : undefined
      );
    };

    try {
      await runInTransaction(async (session) => {
        await performUpdate(session);
      });
    } catch (error: any) {
      if (
        error.message?.includes('replica set member') ||
        error.message?.includes('standalone')
      ) {
        // Fallback for standalone dev/test Mongo instances
        await performUpdate();
      } else {
        throw error;
      }
    }
  }

  static async createProductViewer(
    input: { email: string; password: string },
    adminUserId: string
  ): Promise<any> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictError('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: 'PRODUCT_VIEWER',
      isActive: true,
      tokenVersion: 0,
    });

    await AuditLog.create({
      entityType: 'AUTH',
      entityId: user._id,
      action: 'USER_CREATED',
      performedBy: new mongoose.Types.ObjectId(adminUserId),
      details: { email: user.email, role: user.role },
      timestamp: new Date(),
    });

    return {
      _id: user._id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static async listUsers(): Promise<any[]> {
    return await User.find({}, '-passwordHash').sort({ createdAt: -1 }).lean();
  }

  static async resetUserPassword(
    targetUserId: string,
    newPassword: string,
    adminUserId: string
  ): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await AuditLog.create({
      entityType: 'AUTH',
      entityId: user._id,
      action: 'PASSWORD_RESET_BY_ADMIN',
      performedBy: new mongoose.Types.ObjectId(adminUserId),
      details: { targetEmail: user.email },
      timestamp: new Date(),
    });

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      updatedAt: user.updatedAt,
    };
  }

  static async setUserStatus(
    targetUserId: string,
    isActive: boolean,
    adminUserId: string
  ): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prevent deactivating the active admin performing the action if it's the only admin
    if (user.role === 'admin' && !isActive) {
      const activeAdminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdminCount <= 1) {
        throw new BadRequestError('Cannot deactivate the sole active administrator');
      }
    }

    user.isActive = isActive;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await AuditLog.create({
      entityType: 'AUTH',
      entityId: user._id,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      performedBy: new mongoose.Types.ObjectId(adminUserId),
      details: { targetEmail: user.email, isActive },
      timestamp: new Date(),
    });

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      updatedAt: user.updatedAt,
    };
  }
}


