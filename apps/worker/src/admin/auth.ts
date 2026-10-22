/**
 * Admin authentication for the Cloudflare Worker.
 *
 * - Passwords: PBKDF2-SHA256 via WebCrypto, 210k iterations, 32-byte salt,
 *   32-byte key. Stored format: `pbkdf2-sha256$210000$<b64 salt>$<b64 hash>`.
 *   Verification uses constant-time comparison.
 * - Sessions: 32 random bytes, hex-encoded, delivered in an HttpOnly cookie;
 *   only sha256(token) is stored in D1. 24h TTL with sliding expiry.
 * - Roles: 'admin' (everything) vs 'viewer' (GET endpoints only). The role
 *   always comes from the DB row — client claims are never trusted.
 * - Setup: POST /api/admin/auth/setup works ONLY while admin_users is empty
 *   AND the caller presents the correct SETUP_TOKEN. One 403 for every
 *   failure mode (never reveal whether an admin exists or the token was wrong).
 *
 * There are no hardcoded credentials and no default password anywhere here.
 */
import {
  AdminLoginSchema,
  AdminSetupSchema,
  type AdminRole,
  type AdminUser,
} from '@virtual-ai-office/shared';
import type { Env } from '../env';
import { audit, clientIp, mapAdminUserRow, randomHex, type Row } from './db';
import { err, json, readJson } from './http';

export const SESSION_COOKIE_NAME = 'vao_admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_HASH = 'SHA-256';
const SALT_BYTES = 32;
const KEY_BYTES = 32;

/** Constant-time string comparison (UTF-8 bytes). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    key,
    KEY_BYTES * 8,
  );
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number.parseInt(parts[1] ?? '', 10);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  let salt: Uint8Array;
  try {
    salt = b64decode(parts[2] ?? '');
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    key,
    KEY_BYTES * 8,
  );
  return timingSafeEqual(b64encode(new Uint8Array(bits)), parts[3] ?? '');
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ------------------------------------------------------------------ cookies

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/**
 * Session cookie attributes.
 *
 * The admin UI (Cloudflare Pages) calls this API cross-site, so on HTTPS the
 * cookie must be `SameSite=None; Secure` or the browser will not send it on
 * fetch (even with `credentials: "include"`). On plain HTTP (wrangler dev)
 * we fall back to `SameSite=Lax` without Secure so local development works.
 */
function cookieAttrs(secure: boolean): string {
  return secure
    ? `HttpOnly; Secure; SameSite=None; Path=/`
    : `HttpOnly; SameSite=Lax; Path=/`;
}

function makeSessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE_NAME}=${token}; ${cookieAttrs(secure)}; Max-Age=86400`;
}

function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieAttrs(secure)}; Max-Age=0`;
}

function isHttpsRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}

// ------------------------------------------------------------------ sessions

export interface AuthedSession {
  user: AdminUser;
  sessionId: string;
}

interface SessionRow extends Row {
  id: string;
  user_id: string;
  expires_at: string;
}

/**
 * Resolve the session cookie to an admin user, or null. Expired sessions are
 * deleted on sight. Valid sessions get a sliding expiry bump.
 */
export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<AuthedSession | null> {
  const db = env.DB;
  if (!db) return null;
  const token = getCookie(request, SESSION_COOKIE_NAME);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const sessionId = await sha256Hex(token);
  const session = await db
    .prepare(
      'SELECT id, user_id, created_at, expires_at, ip, user_agent FROM admin_sessions WHERE id = ?',
    )
    .bind(sessionId)
    .first<SessionRow>();
  if (!session) return null;
  if (Date.parse(session.expires_at) <= Date.now()) {
    await db.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }
  // Sliding expiry: bump on every authenticated request.
  await db
    .prepare('UPDATE admin_sessions SET expires_at = ? WHERE id = ?')
    .bind(new Date(Date.now() + SESSION_TTL_MS).toISOString(), sessionId)
    .run();
  const userRow = await db
    .prepare('SELECT id, username, role, created_at, last_login_at FROM admin_users WHERE id = ?')
    .bind(session.user_id)
    .first<Row>();
  if (!userRow) {
    await db.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }
  return { user: mapAdminUserRow(userRow), sessionId };
}

/**
 * Role gate. 'admin' may do everything; 'viewer' is handled by the router
 * (GET only). Never trust a client-supplied role — this always reads the DB row.
 */
export function requireRole(user: AdminUser, role: AdminRole): boolean {
  return user.role === 'admin' || user.role === role;
}

// ------------------------------------------------------------------ handlers

export async function handleSetup(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!db) return err(503, 'admin database not configured');
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = AdminSetupSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid setup payload', parsed.error.flatten());

  const { username, password, setupToken } = parsed.data;
  const configured = env.SETUP_TOKEN;
  const existing = await db.prepare('SELECT id FROM admin_users LIMIT 1').bind().first();
  // One 403 for every failure mode: never reveal whether an admin already
  // exists or the setup token was wrong.
  if (existing || !configured || !timingSafeEqual(setupToken, configured)) {
    return err(403, 'Setup is not available');
  }

  const now = new Date().toISOString();
  const user: AdminUser = {
    id: `adm_${randomHex(12)}`,
    username,
    role: 'admin',
    createdAt: now,
    lastLoginAt: null,
  };
  await db
    .prepare(
      'INSERT INTO admin_users (id, username, password_hash, role, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(user.id, username, await hashPassword(password), 'admin', now, null)
    .run();
  await audit(db, {
    actor: username,
    action: 'admin.setup',
    entity: 'admin_user',
    entityId: user.id,
    ip: clientIp(request),
  });
  return json({ user }, 201);
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!db) return err(503, 'admin database not configured');
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = AdminLoginSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid login payload', parsed.error.flatten());

  const { username, password } = parsed.data;
  const userRow = await db
    .prepare('SELECT id, username, password_hash, role, created_at, last_login_at FROM admin_users WHERE username = ?')
    .bind(username)
    .first<Row & { password_hash: string }>();
  const ok = userRow ? await verifyPassword(password, userRow.password_hash) : false;
  if (!userRow || !ok) {
    // Generic message: never reveal whether the username exists.
    return err(401, 'Invalid username or password');
  }

  const token = randomHex(32);
  const sessionId = await sha256Hex(token);
  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT INTO admin_sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      sessionId,
      userRow.id,
      now,
      new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      clientIp(request),
      request.headers.get('user-agent')?.slice(0, 300) ?? null,
    )
    .run();
  await db
    .prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?')
    .bind(now, userRow.id)
    .run();
  // Re-read so the response carries the fresh lastLoginAt.
  const fresh = await db
    .prepare('SELECT id, username, role, created_at, last_login_at FROM admin_users WHERE id = ?')
    .bind(userRow.id)
    .first<Row>();
  await audit(db, {
    actor: String(userRow.username),
    action: 'admin.login',
    entity: 'admin_user',
    entityId: String(userRow.id),
    ip: clientIp(request),
  });
  return json({ user: mapAdminUserRow(fresh ?? userRow) }, 200, {
    'Set-Cookie': makeSessionCookie(token, isHttpsRequest(request)),
  });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!db) return err(503, 'admin database not configured');
  const authed = await requireAdmin(request, env);
  if (!authed) return err(401, 'Authentication required');
  await db.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(authed.sessionId).run();
  await audit(db, {
    actor: authed.user.username,
    action: 'admin.logout',
    entity: 'admin_user',
    entityId: authed.user.id,
    ip: clientIp(request),
  });
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(isHttpsRequest(request)) });
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const authed = await requireAdmin(request, env);
  if (!authed) return err(401, 'Authentication required');
  return json({ user: authed.user });
}
