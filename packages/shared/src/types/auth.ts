// Auth types - mirrors musait.app auth system

export type UserRole = "master" | "tenant_owner" | "tenant_staff" | "customer";

export interface AppMetadata {
  role: UserRole;
  tenant_id: string | null;
  provider?: string;
  providers?: string[];
}

export interface AuthUser {
  id: string; // sub claim from JWT
  email?: string;
  app_metadata: AppMetadata;
}

/**
 * Extracts tenant context from auth user.
 * Master users have unrestricted access.
 * All other roles are scoped to their tenant_id.
 */
export function getTenantContext(user: AuthUser): {
  isMaster: boolean;
  tenantId: string | null;
  role: UserRole;
} {
  return {
    isMaster: user.app_metadata.role === "master",
    tenantId: user.app_metadata.tenant_id,
    role: user.app_metadata.role,
  };
}
