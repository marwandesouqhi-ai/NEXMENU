import { dataAdapter } from "@/data";
import { authorize } from "@/services/authorization";
import { teamService } from "@/services/restaurants";
import { ValidationError } from "@/lib/errors";
import type { AuditLog, Membership, Restaurant, Session, Subscription } from "@/types/domain";

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  actor?: string;
  action?: string;
  restaurantId?: string;
  page?: number;
  pageSize?: number;
}

const updated = <T extends { updated_at: string }>(item: T): T => ({
  ...item,
  updated_at: new Date().toISOString(),
});

async function audit(
  session: Session,
  restaurantId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, string | number | boolean>,
) {
  const auth = await authorize(dataAdapter, session, "restaurant:read", restaurantId);
  const now = new Date().toISOString();
  const value: AuditLog = {
    id: crypto.randomUUID(),
    restaurant_id: restaurantId,
    actor_profile_id: auth.profileId,
    actor_role: auth.role,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    created_at: now,
    updated_at: now,
  };
  await dataAdapter.saveAuditLog(value);
}

export const adminService = {
  async dashboard(session: Session) {
    await authorize(dataAdapter, session, "admin:access");
    const [restaurants, profiles, events, logs, subscriptions, memberships] = await Promise.all([
      dataAdapter.listRestaurants(),
      dataAdapter.listProfiles(),
      dataAdapter.listAnalytics(),
      dataAdapter.listAuditLogs(),
      dataAdapter.listSubscriptions(),
      dataAdapter.listMemberships(),
    ]);
    return {
      restaurants,
      profiles: profiles.map(({ password_hash: _hash, password_salt: _salt, ...profile }) => profile),
      events,
      logs,
      subscriptions,
      memberships,
    };
  },

  async filterAuditLogs(session: Session, filters: AuditLogFilters = {}) {
    await authorize(dataAdapter, session, "admin:access");
    let logs = await dataAdapter.listAuditLogs();
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filters.restaurantId) {
      logs = logs.filter((l) => l.restaurant_id === filters.restaurantId);
    }
    if (filters.action) {
      const q = filters.action.toLowerCase();
      logs = logs.filter((l) => l.action.toLowerCase().includes(q));
    }
    if (filters.actor) {
      const q = filters.actor.toLowerCase();
      logs = logs.filter((l) => l.actor_profile_id.toLowerCase().includes(q) || l.actor_role.toLowerCase().includes(q));
    }
    if (filters.dateFrom) {
      const fromMs = new Date(filters.dateFrom).getTime();
      if (!isNaN(fromMs)) logs = logs.filter((l) => new Date(l.created_at).getTime() >= fromMs);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      if (filters.dateTo.length <= 10) toDate.setHours(23, 59, 59, 999);
      if (!isNaN(toDate.getTime())) logs = logs.filter((l) => new Date(l.created_at).getTime() <= toDate.getTime());
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? 10);
    const total = logs.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const items = logs.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  },

  async saveSubscription(session: Session, value: Subscription) {
    await authorize(dataAdapter, session, "subscription:write", value.restaurant_id);
    const starts = value.start_date || value.starts_at;
    const expires = value.end_date || value.expires_at;
    if (starts && expires && new Date(expires).getTime() < new Date(starts).getTime()) {
      throw new ValidationError("Subscription end date cannot be earlier than start date.");
    }
    const saved = await dataAdapter.saveSubscription(updated({
      ...value,
      starts_at: starts,
      expires_at: expires,
      start_date: starts,
      end_date: expires,
    }));
    await audit(session, value.restaurant_id, "subscription.updated", "subscription", saved.id, { plan: saved.plan });
    return saved;
  },

  async setStatus(session: Session, value: Restaurant, status: Restaurant["status"]) {
    await authorize(dataAdapter, session, "restaurant:write", value.id);
    const saved = await dataAdapter.saveRestaurant({ ...updated(value), status });
    await audit(session, value.id, status === "ACTIVE" ? "restaurant.activated" : "restaurant.suspended", "restaurant", value.id);
    return saved;
  },

  async setPlan(session: Session, restaurantId: string, plan: Subscription["plan"]) {
    await authorize(dataAdapter, session, "subscription:write", restaurantId);
    const now = new Date().toISOString();
    const current = await dataAdapter.getSubscription(restaurantId);
    const value: Subscription = current
      ? { ...current, plan, status: "ACTIVE", updated_at: now }
      : { id: crypto.randomUUID(), restaurant_id: restaurantId, plan, starts_at: now, expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(), status: "ACTIVE", notes: "", created_at: now, updated_at: now };
    const saved = await dataAdapter.saveSubscription(value);
    await audit(session, restaurantId, "plan.changed", "subscription", saved.id, { plan });
    return saved;
  },

  listMembers: (session: Session, restaurantId: string) => teamService.listMembers(session, restaurantId),
  updateMemberRole: (session: Session, restaurantId: string, memberId: string, role: Membership["role"]) => teamService.updateRole(session, restaurantId, memberId, role),
  setMemberStatus: (session: Session, restaurantId: string, memberId: string, status: Membership["status"]) => teamService.setStatus(session, restaurantId, memberId, status),
  removeMember: (session: Session, restaurantId: string, memberId: string) => teamService.removeMember(session, restaurantId, memberId),
  inviteMember: (session: Session, restaurantId: string, email: string, role: Membership["role"]) => teamService.invite(session, restaurantId, email, role),
};
