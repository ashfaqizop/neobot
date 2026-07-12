/**
 * Admin users repository (masterdoc §9, §8.2).
 *
 * Stores the single admin account (bcrypt hash). Built here; wired by the Phase
 * 6 auth + setup wizard. Password hashing is the caller's responsibility.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminUser, AdminUsersRepository } from '../types.js';

export class InMemoryAdminUsersRepository implements AdminUsersRepository {
  private readonly users: AdminUser[] = [];
  private nextId = 1;

  findByUsername(username: string): Promise<AdminUser | null> {
    return Promise.resolve(this.users.find((u) => u.username === username) ?? null);
  }

  create(username: string, passwordHash: string): Promise<AdminUser> {
    const user: AdminUser = {
      id: this.nextId++,
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return Promise.resolve(user);
  }

  count(): Promise<number> {
    return Promise.resolve(this.users.length);
  }
}

export class SupabaseAdminUsersRepository implements AdminUsersRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUsername(username: string): Promise<AdminUser | null> {
    const { data, error } = await this.client
      .from('admin_users')
      .select('id, username, password_hash, created_at')
      .eq('username', username)
      .maybeSingle();
    if (error) throw new Error(`admin_users.findByUsername failed: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id as number,
      username: data.username as string,
      passwordHash: data.password_hash as string,
      createdAt: data.created_at as string,
    };
  }

  async create(username: string, passwordHash: string): Promise<AdminUser> {
    const { data, error } = await this.client
      .from('admin_users')
      .insert({ username, password_hash: passwordHash })
      .select('id, username, password_hash, created_at')
      .single();
    if (error) throw new Error(`admin_users.create failed: ${error.message}`);
    return {
      id: data.id as number,
      username: data.username as string,
      passwordHash: data.password_hash as string,
      createdAt: data.created_at as string,
    };
  }

  async count(): Promise<number> {
    const { count, error } = await this.client
      .from('admin_users')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`admin_users.count failed: ${error.message}`);
    return count ?? 0;
  }
}
