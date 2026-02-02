import { z } from "zod";
import type { FastifyRequest } from "fastify";
import type { ApiKeyRecord, CreateApiKeyInput } from "keypal";

export const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

// API Key Types - Use keypal's types directly
// keypal's verify method returns { valid: boolean; record: ApiKeyRecord | null }
export interface ApiKeyVerificationResult {
  valid: boolean;
  record: ApiKeyRecord | null;
}

export interface AuthenticatedRequest extends FastifyRequest {
  apiKey: ApiKeyVerificationResult;
}

// API Key Request/Response Types
// Based on keypal's CreateApiKeyInput, but allow string dates for JSON parsing
export const CreateApiKeyBody = z.object({
  ownerId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  expiresAt: z.union([z.string(), z.date()]).optional(),
});

export type CreateApiKeyBody = z.infer<typeof CreateApiKeyBody>;

// API Key Response - based on keypal's ApiKeyRecord
// This represents the public-facing API key info (without sensitive data like keyHash)
export const ApiKeyResponse = z.object({
  id: z.string(),
  createdAt: z.date().optional(),
  expiresAt: z.date().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
  lastUsedAt: z.date().nullable().optional(),
});

export type ApiKeyResponse = z.infer<typeof ApiKeyResponse>;

// Re-export keypal types for convenience
export type { ApiKeyRecord, ApiKeyMetadata, CreateApiKeyInput } from "keypal";

export const CreateApiKeyResponse = ApiKeyResponse.extend({
  key: z.string(), // Only returned once on creation
});

export type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponse>;

export const ListApiKeysResponse = z.object({
  keys: z.array(ApiKeyResponse),
});

export type ListApiKeysResponse = z.infer<typeof ListApiKeysResponse>;

export const UpdateApiKeyBody = z.object({
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
});

export type UpdateApiKeyBody = z.infer<typeof UpdateApiKeyBody>;

export const ApiKeyParams = z.object({
  id: z.string(),
});

export type ApiKeyParams = z.infer<typeof ApiKeyParams>;
