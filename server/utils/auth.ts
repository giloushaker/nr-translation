import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { H3Event } from "h3";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface SystemPermission {
  systemId: string;
  languages: string[]; // Array of language codes, or ["*"] for all languages
}

export interface JWTPayload {
  userId: string;
  login: string;
  translation_auth: SystemPermission[]; // Array of system permissions with language restrictions
  permission?: number; // User permission level (100 = admin)
}

export interface MemberDocument {
  _id?: string;
  login: string;
  password: string; // hashed with hashPassword(login + "*" + password)
  translation_auth: SystemPermission[]; // Array of system permissions with language restrictions
  createdAt: Date;
  permission?: number; // User permission level (100 = admin)
}

/**
 * Generate JWT token for a user
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract JWT from Authorization header
 */
export function extractToken(event: H3Event): string | null {
  const authHeader = getHeader(event, "authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Get authenticated user from request
 */
export function getAuthUser(event: H3Event): JWTPayload | null {
  const token = extractToken(event);
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

/**
 * Hash string with specified algorithm
 */
export function hashString(input: string, algo: string = "sha256"): string {
  return crypto.createHash(algo).update(input).digest("hex");
}

/**
 * Hash password using New Recruit method: SHA256(MD5(input))
 */
export function hashPassword(input: string): string {
  const md5Hash = hashString(input, "md5");
  const sha256Hash = hashString(md5Hash, "sha256");
  return sha256Hash;
}

/**
 * Compare password with hash (New Recruit method)
 * Accepts either the direct hash or a SHA256 of the stored hash (for backward compatibility)
 */
export function comparePassword(providedPassword: string, storedHash: string): boolean {
  // Accept either the direct hash or SHA256 of the stored hash
  return providedPassword === storedHash || providedPassword === hashString(storedHash, "sha256");
}

/**
 * Check if user has permission to translate a system (any language)
 */
export function hasTranslationAuth(user: JWTPayload | null, systemId: string): boolean {
  if (!user) return false;
  return user.translation_auth.some((perm) => perm.systemId === systemId);
}

/**
 * Check if user has permission to translate a specific system and language
 */
export function hasLanguageAuth(user: JWTPayload | null, systemId: string, languageCode: string): boolean {
  if (!user) return false;
  const systemPerm = user.translation_auth.find((perm) => perm.systemId === systemId);
  if (!systemPerm) return false;
  // "*" means all languages
  return systemPerm.languages.includes("*") || systemPerm.languages.includes(languageCode);
}

/**
 * Get authorized languages for a system
 */
export function getAuthorizedLanguages(user: JWTPayload | null, systemId: string): string[] | null {
  if (!user) return null;
  const systemPerm = user.translation_auth.find((perm) => perm.systemId === systemId);
  if (!systemPerm) return null;
  // Return null if all languages (*), otherwise return the specific list
  return systemPerm.languages.includes("*") ? null : systemPerm.languages;
}

/**
 * Check if user is admin (permission = 100)
 */
export function isAdmin(user: JWTPayload | null): boolean {
  if (!user) return false;
  return user.permission === 100;
}
