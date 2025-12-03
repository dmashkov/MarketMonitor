/**
 * Auth Module Exports
 *
 * Central export point for all auth-related code
 * Ensures proper module isolation
 */

export { ProtectedRoute } from './components/ProtectedRoute';
export { useAuth } from './hooks/useAuth';

// Type exports (for other modules)
export type { } from '@/shared/types'; // Re-export shared types if needed
