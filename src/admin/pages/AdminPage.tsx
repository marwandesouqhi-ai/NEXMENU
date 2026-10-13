import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router";
import {
  Activity, ArrowLeft, Building2, Calendar,
  Plus, Search, ShieldAlert, ShieldCheck, UserMinus, Users, X
} from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { adminService, type AuditLogFilters } from "@/services/restaurants";
import { Brand } from "@/components/shared/Brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ErrorState, LoadingState } from "@/components/ui/States";
import {
  getDerivedSubscriptionStatus,
  type PlanCode,
  type Restaurant,
  type Subscription,
  type Membership,
} from "@/types/domain";
import { getPublicMenuUrl } from "@/app/target";

type Tab = "restaurants" | "users" | "audit";

export default function AdminPage() {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("restaurants");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // User management tab states
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Membership["role"]>("STAFF");
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Audit tab filters
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize: 10,
    action: "",
    restaurantId: "",
    actor: "",
    dateFrom: "",
    dateTo: "",
  });

  const query = useQuery({
    queryKey: ["admin"],
    queryFn: () => adminService.dashboard(session!),
    enabled: Boolean(session && profile?.platform_role === "SUPER_ADMIN"),
  });

  const auditQuery = useQuery({
    queryKey: ["admin-audit", auditFilters],
    queryFn: () => adminService.filterAuditLogs(session!, auditFilters),
    enabled: Boolean(session && profile?.platform_role === "SUPER_ADMIN"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ restaurant, next }: { restaurant: Restaurant; next: Restaurant["status"] }) =>
      adminService.setStatus(session!, restaurant, next),
    onSuccess: () => {
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const planMutation = useMutation({
    mutationFn: ({ restaurantId, next }: { restaurantId: string; next: PlanCode }) =>
      adminService.setPlan(session!, restaurantId, next),
    onSuccess: () => {
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const saveSubMutation = useMutation({
    mutationFn: (sub: Subscription) => adminService.saveSubscription(session!, sub),
    onSuccess: () => {
      setSelectedSub(null);
      setEditingRestaurant(null);
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  // Team mutations
  const updateRoleMutation = useMutation({
    mutationFn: ({ restaurantId, memberId, role }: { restaurantId: string; memberId: string; role: Membership["role"] }) =>
      adminService.updateMemberRole(session!, restaurantId, memberId, role),
    onSuccess: () => {
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const setMemberStatusMutation = useMutation({
    mutationFn: ({ restaurantId, memberId, status }: { restaurantId: string; memberId: string; status: Membership["status"] }) =>
      adminService.setMemberStatus(session!, restaurantId, memberId, status),
    onSuccess: () => {
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ restaurantId, memberId }: { restaurantId: string; memberId: string }) =>
      adminService.removeMember(session!, restaurantId, memberId),
    onSuccess: () => {
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const inviteMemberMutation = useMutation({
    mutationFn: ({ restaurantId, email, role }: { restaurantId: string; email: string; role: Membership["role"] }) =>
      adminService.inviteMember(session!, restaurantId, email, role),
    onSuccess: () => {
      setShowInviteModal(false);
      setInviteEmail("");
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  // Derived data
  const subscriptionMap = useMemo(() => {
    const map = new Map<string, Subscription>();
    if (query.data?.subscriptions) {
      for (const s of query.data.subscriptions) {
        map.set(s.restaurant_id, s);
      }
    }
    return map;
  }, [query.data]);

  const filteredRestaurants = useMemo(() => {
    return (
      query.data?.restaurants.filter((item) =>
        [item.name_en, item.slug, item.phone, item.status]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ) ?? []
    );
  }, [query.data, searchTerm]);

  // Active restaurant for user management
  const activeRestaurantId = selectedRestaurantId || (query.data?.restaurants[0]?.id ?? "");

  const restaurantMembers = useMemo(() => {
    if (!query.data?.memberships) return [];
    return query.data.memberships.filter((m) => m.restaurant_id === activeRestaurantId);
  }, [query.data, activeRestaurantId]);

  if (!session) return <Navigate to="/login" />;
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState body="The platform dashboard could not be loaded." />;

  const logout = async () => {
    await signOut();
    navigate("/login");
  };

  const openSubEditor = (restaurant: Restaurant) => {
    const existing = subscriptionMap.get(restaurant.id);
    const now = new Date().toISOString();
    const subToEdit: Subscription = existing ?? {
      id: crypto.randomUUID(),
      restaurant_id: restaurant.id,
      plan: "FREE",
      starts_at: now,
      expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      start_date: now.split("T")[0],
      end_date: new Date(Date.now() + 365 * 86_400_000).toISOString().split("T")[0],
      status: "ACTIVE",
      notes: "",
      created_at: now,
      updated_at: now,
    };
    setSelectedSub(subToEdit);
    setEditingRestaurant(restaurant);
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-2">
            <Badge>SUPER ADMIN</Badge>
            <Button variant="ghost" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--accent)]">PLATFORM CONTROL</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">NEXMENU admin</h1>
          </div>
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="size-4" />
            Restaurant dashboard
          </Button>
        </div>

        {/* Global Error Banner */}
        {actionError && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm font-bold text-[var(--danger)]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="rounded-lg p-1 hover:bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]"
              aria-label="Dismiss error"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Platform Stat Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStat label="Restaurants" value={query.data.restaurants.length} icon={Building2} />
          <AdminStat
            label="Active"
            value={query.data.restaurants.filter((item) => item.status === "ACTIVE").length}
            icon={ShieldCheck}
          />
          <AdminStat label="Users" value={query.data.profiles.length} icon={Users} />
          <AdminStat label="Menu events" value={query.data.events.length} icon={Activity} />
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 flex gap-2 border-b border-[var(--line)]">
          <button
            onClick={() => { setActiveTab("restaurants"); setActionError(null); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black transition ${
              activeTab === "restaurants"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <Building2 className="size-4" />
            Restaurants & Subscriptions
          </button>
          <button
            onClick={() => { setActiveTab("users"); setActionError(null); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black transition ${
              activeTab === "users"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <Users className="size-4" />
            User Management
          </button>
          <button
            onClick={() => { setActiveTab("audit"); setActionError(null); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black transition ${
              activeTab === "audit"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <Activity className="size-4" />
            Audit Logs
          </button>
        </div>

        {/* Tab 1: Restaurants & Subscriptions */}
        {activeTab === "restaurants" && (
          <section className="mt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-black">Restaurants ({filteredRestaurants.length})</h2>
              <div className="w-full sm:w-80">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search restaurants…"
                  leading={<Search className="size-4" />}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {filteredRestaurants.map((restaurant) => {
                const sub = subscriptionMap.get(restaurant.id);
                const currentPlan = sub?.plan || "FREE";
                const derivedStatus = getDerivedSubscriptionStatus(sub);

                return (
                  <Card key={restaurant.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <img
                      src={restaurant.logo_url || "/assets/moon-logo.svg"}
                      alt=""
                      className="size-12 rounded-xl bg-white object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black">{restaurant.name_en}</p>
                        <Badge className={
                          derivedStatus === "active"
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : derivedStatus === "expiring_soon"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-[var(--danger-soft)] text-[var(--danger)]"
                        }>
                          {derivedStatus === "active" ? "Sub: Active" : derivedStatus === "expiring_soon" ? "Sub: Expiring Soon" : "Sub: Expired"}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--ink-soft)]">
                        <a
                          href={getPublicMenuUrl(restaurant.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[var(--accent)] hover:underline"
                        >
                          /r/{restaurant.slug}
                        </a>{" "}
                        · {restaurant.phone || "No phone"}
                        {sub?.expires_at && ` · Expires ${new Date(sub.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* REAL PLAN COLUMN SELECT - Fixes the bug where plan always defaulted to PRO */}
                      <div className="flex flex-col">
                        <label htmlFor={`plan-${restaurant.id}`} className="text-[11px] font-bold text-[var(--ink-soft)]">
                          Plan
                        </label>
                        <select
                          id={`plan-${restaurant.id}`}
                          aria-label={`Plan for ${restaurant.name_en}`}
                          value={currentPlan}
                          onChange={(event) =>
                            planMutation.mutate({
                              restaurantId: restaurant.id,
                              next: event.target.value as PlanCode,
                            })
                          }
                          className="min-h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold"
                        >
                          {(["FREE", "BASIC", "PRO", "PREMIUM"] as PlanCode[]).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openSubEditor(restaurant)}
                        className="mt-4"
                      >
                        <Calendar className="size-3.5" />
                        Details
                      </Button>

                      <Badge
                        className={`mt-4 ${
                          restaurant.status === "ACTIVE"
                            ? ""
                            : "bg-[var(--danger-soft)] text-[var(--danger)]"
                        }`}
                      >
                        {restaurant.status}
                      </Badge>

                      <Button
                        variant={restaurant.status === "ACTIVE" ? "danger" : "primary"}
                        size="sm"
                        className="mt-4"
                        loading={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            restaurant,
                            next: restaurant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                          })
                        }
                      >
                        {restaurant.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Tab 2: User Management */}
        {activeTab === "users" && (
          <section className="mt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">User Management</h2>
                <p className="text-sm text-[var(--ink-soft)]">
                  Manage team memberships and enforce tenant ownership rules.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  aria-label="Select Restaurant"
                  value={activeRestaurantId}
                  onChange={(e) => setSelectedRestaurantId(e.target.value)}
                  className="min-h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold"
                >
                  {query.data?.restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name_en} (/r/{r.slug})
                    </option>
                  ))}
                </select>

                <Button variant="primary" size="sm" onClick={() => setShowInviteModal(true)}>
                  <Plus className="size-4" />
                  Invite User
                </Button>
              </div>
            </div>

            <Card className="mt-4 divide-y divide-[var(--line)] overflow-hidden">
              {restaurantMembers.length ? (
                restaurantMembers.map((member) => (
                  <div key={member.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold">{member.email}</p>
                      <p className="text-xs text-[var(--ink-soft)]">
                        Status: <span className={member.status === "ACTIVE" ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>{member.status}</span> · Added {new Date(member.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        aria-label={`Role for ${member.email}`}
                        value={member.role}
                        onChange={(e) =>
                          updateRoleMutation.mutate({
                            restaurantId: activeRestaurantId,
                            memberId: member.id,
                            role: e.target.value as Membership["role"],
                          })
                        }
                        className="min-h-9 rounded-lg border border-[var(--line)] bg-white px-2.5 text-xs font-bold"
                      >
                        <option value="RESTAURANT_OWNER">Owner</option>
                        <option value="RESTAURANT_MANAGER">Manager</option>
                        <option value="STAFF">Staff</option>
                      </select>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setMemberStatusMutation.mutate({
                            restaurantId: activeRestaurantId,
                            memberId: member.id,
                            status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                          })
                        }
                      >
                        {member.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Remove ${member.email} from this restaurant?`)) {
                            removeMemberMutation.mutate({
                              restaurantId: activeRestaurantId,
                              memberId: member.id,
                            });
                          }
                        }}
                      >
                        <UserMinus className="size-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-6 text-sm text-[var(--ink-soft)]">No users found for this restaurant.</p>
              )}
            </Card>
          </section>
        )}

        {/* Tab 3: Audit Logs */}
        {activeTab === "audit" && (
          <section className="mt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Audit Logs</h2>
                <p className="text-sm text-[var(--ink-soft)]">
                  Track administrative actions and security-critical mutations.
                </p>
              </div>
            </div>

            {/* Audit Filters Bar */}
            <Card className="mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs font-bold text-[var(--ink-soft)]">Action Pattern</label>
                <input
                  type="text"
                  placeholder="e.g. member, plan, restaurant"
                  value={auditFilters.action ?? ""}
                  onChange={(e) => setAuditFilters((prev) => ({ ...prev, action: e.target.value, page: 1 }))}
                  className="mt-1 min-h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink-soft)]">Restaurant Filter</label>
                <select
                  value={auditFilters.restaurantId ?? ""}
                  onChange={(e) => setAuditFilters((prev) => ({ ...prev, restaurantId: e.target.value, page: 1 }))}
                  className="mt-1 min-h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 text-xs font-bold"
                >
                  <option value="">All Restaurants</option>
                  {query.data?.restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink-soft)]">From Date</label>
                <input
                  type="date"
                  value={auditFilters.dateFrom ?? ""}
                  onChange={(e) => setAuditFilters((prev) => ({ ...prev, dateFrom: e.target.value, page: 1 }))}
                  className="mt-1 min-h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink-soft)]">To Date</label>
                <input
                  type="date"
                  value={auditFilters.dateTo ?? ""}
                  onChange={(e) => setAuditFilters((prev) => ({ ...prev, dateTo: e.target.value, page: 1 }))}
                  className="mt-1 min-h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-xs"
                />
              </div>
            </Card>

            {/* Audit Table / List */}
            <Card className="mt-4 divide-y divide-[var(--line)] overflow-hidden">
              {auditQuery.data?.items.length ? (
                auditQuery.data.items.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 p-4 text-sm">
                    <span className="grid size-9 place-items-center rounded-xl bg-[var(--muted)]">
                      <Activity className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{log.action}</p>
                        {log.metadata && (
                          <span className="text-xs text-[var(--ink-soft)]">
                            ({JSON.stringify(log.metadata)})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--ink-soft)] truncate">
                        {log.entity_type} · {log.actor_role} · Actor: {log.actor_profile_id.slice(0, 8)}…
                      </p>
                    </div>
                    <time className="text-xs text-[var(--ink-faint)] shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </time>
                  </div>
                ))
              ) : (
                <p className="p-6 text-sm text-[var(--ink-soft)]">No audit logs matching criteria.</p>
              )}
            </Card>

            {/* Pagination Controls */}
            {auditQuery.data && auditQuery.data.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-[var(--ink-soft)]">
                  Page {auditQuery.data.page} of {auditQuery.data.totalPages} ({auditQuery.data.total} total logs)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={auditQuery.data.page <= 1}
                    onClick={() => setAuditFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page ?? 1) - 1) }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={auditQuery.data.page >= auditQuery.data.totalPages}
                    onClick={() => setAuditFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Edit Subscription Modal */}
      {selectedSub && editingRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <h3 className="text-lg font-black">Subscription details</h3>
                <p className="text-xs text-[var(--ink-soft)]">{editingRestaurant.name_en}</p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="rounded-lg p-1.5 hover:bg-[var(--muted)]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSubMutation.mutate(selectedSub);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-[var(--ink)]">Plan</label>
                <select
                  value={selectedSub.plan}
                  onChange={(e) => setSelectedSub({ ...selectedSub, plan: e.target.value as PlanCode })}
                  className="mt-1 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold"
                >
                  {(["FREE", "BASIC", "PRO", "PREMIUM"] as PlanCode[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-[var(--ink)]">Start Date</label>
                  <input
                    type="date"
                    required
                    value={
                      (selectedSub.start_date || selectedSub.starts_at)
                        ? new Date(selectedSub.start_date || selectedSub.starts_at).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setSelectedSub({
                        ...selectedSub,
                        start_date: e.target.value,
                        starts_at: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--ink)]">End / Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={
                      (selectedSub.end_date || selectedSub.expires_at)
                        ? new Date(selectedSub.end_date || selectedSub.expires_at).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setSelectedSub({
                        ...selectedSub,
                        end_date: e.target.value,
                        expires_at: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                  />
                </div>
              </div>

              {/* Validation notice */}
              {new Date(selectedSub.end_date || selectedSub.expires_at).getTime() <
                new Date(selectedSub.start_date || selectedSub.starts_at).getTime() && (
                <p className="text-xs font-bold text-[var(--danger)]">
                  Expiration date must be on or after the start date.
                </p>
              )}

              <div>
                <label className="text-xs font-bold text-[var(--ink)]">Administrative Notes</label>
                <textarea
                  rows={3}
                  value={selectedSub.notes ?? ""}
                  onChange={(e) => setSelectedSub({ ...selectedSub, notes: e.target.value })}
                  placeholder="Billing contact, agreement ID, or renewal remarks…"
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white p-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setSelectedSub(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  loading={saveSubMutation.isPending}
                  disabled={
                    new Date(selectedSub.end_date || selectedSub.expires_at).getTime() <
                    new Date(selectedSub.start_date || selectedSub.starts_at).getTime()
                  }
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <h3 className="text-lg font-black">Invite User</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="rounded-lg p-1.5 hover:bg-[var(--muted)]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMemberMutation.mutate({
                  restaurantId: activeRestaurantId,
                  email: inviteEmail,
                  role: inviteRole,
                });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-[var(--ink)]">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@restaurant.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink)]">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Membership["role"])}
                  className="mt-1 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold"
                >
                  <option value="RESTAURANT_OWNER">Owner</option>
                  <option value="RESTAURANT_MANAGER">Manager</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={inviteMemberMutation.isPending}>
                  Send Invite
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function AdminStat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--ink-soft)]">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}
