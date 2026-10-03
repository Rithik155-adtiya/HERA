import { COMPLAINT_ID_PREFIX } from '../../../shared/src/constants';

/**
 * Generates a unique complaint ID in the format HST-XXXXXX
 */
export function generateComplaintId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${COMPLAINT_ID_PREFIX}-${timestamp}${random}`;
}

/**
 * Calculate if a complaint is overdue based on creation time and settings
 */
export function isComplaintOverdue(
  createdAt: Date,
  priority: string,
  resolutionTargets: Record<string, number>,
  status: string
): boolean {
  // Closed/resolved complaints cannot be overdue
  if (['closed', 'resolved', 'rejected'].includes(status)) return false;

  const targetHours = resolutionTargets[priority] ?? 48;
  const targetMs = targetHours * 60 * 60 * 1000;
  const elapsed = Date.now() - createdAt.getTime();
  return elapsed > targetMs;
}

/**
 * Calculate resolution time in hours
 */
export function calculateResolutionTimeHours(createdAt: Date, resolvedAt: Date): number {
  const ms = resolvedAt.getTime() - createdAt.getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

/**
 * Simple cosine similarity between two text embeddings (flat arrays)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Sanitize user input to prevent injection
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .substring(0, 5000);
}
