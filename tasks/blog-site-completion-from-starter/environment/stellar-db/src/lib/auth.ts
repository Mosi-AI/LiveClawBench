import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase, userQueries } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'editor';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

// Verify a password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

// Generate JWT token
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

// Login user
export async function login(credentials: LoginCredentials): Promise<{ user: AuthUser; token: string } | null> {
  const user = userQueries.findByUsername(credentials.username);

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(credentials.password, user.password_hash);

  if (!isValid) {
    return null;
  }

  // Update last login
  userQueries.updateLastLogin(user.id);

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  const token = generateToken(authUser);

  return { user: authUser, token };
}

// Create initial admin user
export async function createAdminUser(username: string, email: string, password: string): Promise<{ success: boolean; message: string }> {
  const db = getDatabase();

  // Check if any users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  if (userCount.count > 0) {
    return { success: false, message: 'Admin user already exists. Use the admin dashboard to create additional users.' };
  }

  const passwordHash = await hashPassword(password);

  try {
    userQueries.create({
      username,
      email,
      password_hash: passwordHash,
      role: 'admin'
    });
    return { success: true, message: 'Admin user created successfully' };
  } catch (error) {
    return { success: false, message: 'Failed to create admin user' };
  }
}

// Get user from token (for API routes)
export function getUserFromToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  return verifyToken(token);
}

// Create a new user (admin only)
export async function createUser(
  username: string,
  email: string,
  password: string,
  role: 'admin' | 'editor' = 'editor'
): Promise<{ success: boolean; message: string }> {
  const passwordHash = await hashPassword(password);

  try {
    userQueries.create({
      username,
      email,
      password_hash: passwordHash,
      role
    });
    return { success: true, message: 'User created successfully' };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      if (error.message.includes('username')) {
        return { success: false, message: 'Username already exists' };
      }
      if (error.message.includes('email')) {
        return { success: false, message: 'Email already exists' };
      }
    }
    return { success: false, message: 'Failed to create user' };
  }
}

// Check if user has admin role
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin';
}

// Middleware for Astro pages (checks cookie)
export function checkAuth(Astro: any): AuthUser | null {
  const token = Astro.cookies.get('auth-token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Middleware for API routes (checks Authorization header)
export function checkApiAuth(request: Request): AuthUser | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

// Check if value is a Response object (redirect)
export function isRedirect(value: any): value is Response {
  return value && typeof value === 'object' && 'status' in value && 'headers' in value;
}

// Require auth for Astro pages - returns user or Response (redirect)
export function requireAuth(Astro: any): AuthUser | Response {
  const user = checkAuth(Astro);
  if (!user) {
    return Astro.redirect(`${'/admin/login'}?redirect=${encodeURIComponent(Astro.url.pathname)}`);
  }
  return user;
}

// Require admin for Astro pages
export function requireAdmin(Astro: any, redirectTo: string = '/admin'): AuthUser {
  const user = requireAuth(Astro, '/admin/login');
  if (user?.role !== 'admin') {
    return Astro.redirect(redirectTo);
  }
  return user;
}
