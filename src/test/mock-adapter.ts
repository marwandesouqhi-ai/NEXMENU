import { vi } from "vitest"
import { dataAdapter } from "@/data"
import type {
  AnalyticsEvent,
  AuditLog,
  Branding,
  Branch,
  Category,
  Membership,
  Offer,
  Product,
  Profile,
  QrCode,
  Restaurant,
  RestaurantSettings,
  Subscription,
  SubscriptionRequest,
  Notification,
  Session,
} from "@/types/domain"

const now = "2026-01-01T00:00:00Z"

export const defaultAdminProfile: Profile = {
  id: "profile-admin",
  email: "admin@nexmenu.com",
  name: "Platform Admin",
  platform_role: "SUPER_ADMIN",
  password_hash: "",
  password_salt: "",
  email_verified: true,
  created_at: now,
  updated_at: now,
}

export function setupInMemoryDataAdapter() {
  const store = {
    profiles: [{ ...defaultAdminProfile }] as Profile[],
    restaurants: [] as Restaurant[],
    memberships: [] as Membership[],
    settings: [] as RestaurantSettings[],
    branding: [] as Branding[],
    branches: [] as Branch[],
    categories: [] as Category[],
    products: [] as Product[],
    offers: [] as Offer[],
    qrCodes: [] as QrCode[],
    analytics: [] as AnalyticsEvent[],
    subscriptions: [] as Subscription[],
    subscriptionRequests: [] as SubscriptionRequest[],
    notifications: [] as Notification[],
    auditLogs: [] as AuditLog[],
  }

  const authListeners: Array<(event: string, session: Session | null) => void> =
    []
  let currentSession: Session | null = null
  const resetCode = "123456"

  const resetStore = () => {
    store.profiles = [{ ...defaultAdminProfile }]
    store.restaurants = []
    store.memberships = []
    store.settings = []
    store.branding = []
    store.branches = []
    store.categories = []
    store.products = []
    store.offers = []
    store.qrCodes = []
    store.analytics = []
    store.subscriptions = []
    store.subscriptionRequests = []
    store.notifications = []
    store.auditLogs = []
    authListeners.length = 0
    currentSession = null
  }

  const upsert = <T extends { id: string }>(list: T[], item: T): T => {
    const idx = list.findIndex((x) => x.id === item.id)
    if (idx >= 0) list[idx] = item
    else list.push(item)
    return item
  }

  const upsertBy = <T>(list: T[], item: T, key: keyof T): T => {
    const idx = list.findIndex((x) => x[key] === item[key])
    if (idx >= 0) list[idx] = item
    else list.push(item)
    return item
  }

  vi.spyOn(dataAdapter, "reset").mockImplementation(async () => {
    resetStore()
  })

  vi.spyOn(dataAdapter, "getProfile").mockImplementation(async (id) =>
    store.profiles.find((p) => p.id === id),
  )
  vi.spyOn(dataAdapter, "listProfiles").mockImplementation(async () => [
    ...store.profiles,
  ])

  vi.spyOn(dataAdapter, "getRestaurant").mockImplementation(async (id) =>
    store.restaurants.find((r) => r.id === id),
  )
  vi.spyOn(dataAdapter, "listRestaurants").mockImplementation(async () => [
    ...store.restaurants,
  ])
  vi.spyOn(dataAdapter, "saveRestaurant").mockImplementation(async (r) =>
    upsert(store.restaurants, r),
  )

  vi.spyOn(dataAdapter, "listMemberships").mockImplementation(async () => [
    ...store.memberships,
  ])
  vi.spyOn(dataAdapter, "saveMembership").mockImplementation(async (m) =>
    upsert(store.memberships, m),
  )
  vi.spyOn(dataAdapter, "deleteMembership").mockImplementation(async (id) => {
    store.memberships = store.memberships.filter((m) => m.id !== id)
  })

  vi.spyOn(dataAdapter, "getSettings").mockImplementation(async (id) =>
    store.settings.find((s) => s.restaurant_id === id),
  )
  vi.spyOn(dataAdapter, "saveSettings").mockImplementation(async (s) =>
    upsertBy(store.settings, s, "restaurant_id"),
  )

  vi.spyOn(dataAdapter, "getBranding").mockImplementation(async (id) =>
    store.branding.find((b) => b.restaurant_id === id),
  )
  vi.spyOn(dataAdapter, "saveBranding").mockImplementation(async (b) =>
    upsertBy(store.branding, b, "restaurant_id"),
  )

  vi.spyOn(dataAdapter, "listBranches").mockImplementation(async (id) =>
    store.branches.filter((b) => b.restaurant_id === id),
  )
  vi.spyOn(dataAdapter, "saveBranch").mockImplementation(async (b) =>
    upsert(store.branches, b),
  )

  vi.spyOn(dataAdapter, "listCategories").mockImplementation(async (id) =>
    store.categories
      .filter((c) => c.restaurant_id === id)
      .sort((a, b) => a.sort_order - b.sort_order),
  )
  vi.spyOn(dataAdapter, "saveCategory").mockImplementation(async (c) =>
    upsert(store.categories, c),
  )

  vi.spyOn(dataAdapter, "reorderCategories").mockImplementation(
    async (id, orderedIds) => {
      orderedIds.forEach((catId, index) => {
        const cat = store.categories.find(
          (c) => c.id === catId && c.restaurant_id === id,
        )
        if (cat) cat.sort_order = index
      })
      return store.categories
        .filter((c) => c.restaurant_id === id)
        .sort((a, b) => a.sort_order - b.sort_order)
    },
  )

  vi.spyOn(dataAdapter, "listProducts").mockImplementation(async (id) =>
    store.products
      .filter((p) => p.restaurant_id === id)
      .sort((a, b) => a.sort_order - b.sort_order),
  )
  vi.spyOn(dataAdapter, "saveProduct").mockImplementation(async (p) =>
    upsert(store.products, p),
  )

  vi.spyOn(dataAdapter, "reorderProducts").mockImplementation(
    async (id, _catId, orderedIds) => {
      orderedIds.forEach((prodId, index) => {
        const prod = store.products.find(
          (p) => p.id === prodId && p.restaurant_id === id,
        )
        if (prod) prod.sort_order = index
      })
      return store.products
        .filter((p) => p.restaurant_id === id)
        .sort((a, b) => a.sort_order - b.sort_order)
    },
  )

  vi.spyOn(dataAdapter, "listOffers").mockImplementation(async (id) =>
    store.offers.filter((o) => o.restaurant_id === id),
  )
  vi.spyOn(dataAdapter, "saveOffer").mockImplementation(async (o) =>
    upsert(store.offers, o),
  )

  vi.spyOn(dataAdapter, "listQrCodes").mockImplementation(async (id) =>
    store.qrCodes.filter((q) => q.restaurant_id === id),
  )
  vi.spyOn(dataAdapter, "saveQrCode").mockImplementation(async (q) =>
    upsert(store.qrCodes, q),
  )

  vi.spyOn(dataAdapter, "listAnalytics").mockImplementation(async (id) =>
    id
      ? store.analytics.filter((a) => a.restaurant_id === id)
      : [...store.analytics],
  )
  vi.spyOn(dataAdapter, "saveAnalytics").mockImplementation(async (a) =>
    upsert(store.analytics, a),
  )

  vi.spyOn(dataAdapter, "listSubscriptions").mockImplementation(async () => [
    ...store.subscriptions,
  ])
  vi.spyOn(dataAdapter, "getSubscription").mockImplementation(async (id) =>
    store.subscriptions.find((s) => s.restaurant_id === id),
  )
  vi.spyOn(dataAdapter, "saveSubscription").mockImplementation(async (s) =>
    upsertBy(store.subscriptions, s, "restaurant_id"),
  )
  vi.spyOn(dataAdapter, "listSubscriptionRequests").mockImplementation(
    async (restaurantId) =>
      store.subscriptionRequests
        .filter(
          (request) => !restaurantId || request.restaurant_id === restaurantId,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  )
  vi.spyOn(dataAdapter, "createSubscriptionRequest").mockImplementation(
    async (request) => {
      if (
        store.subscriptionRequests.some(
          (item) =>
            item.restaurant_id === request.restaurant_id &&
            item.status === "PENDING",
        )
      ) {
        throw new Error("A subscription request is already waiting for review.")
      }
      return upsert(store.subscriptionRequests, request)
    },
  )
  vi.spyOn(dataAdapter, "reviewSubscriptionRequest").mockImplementation(
    async (id, decision, adminNotes, reviewerProfileId) => {
      const request = store.subscriptionRequests.find((item) => item.id === id)
      if (!request) throw new Error("Subscription request not found.")
      if (request.status !== "PENDING")
        throw new Error("This subscription request has already been reviewed.")
      const now = new Date().toISOString()
      const reviewed = {
        ...request,
        status: decision,
        admin_notes: adminNotes,
        reviewer_profile_id: reviewerProfileId,
        reviewed_at: now,
        updated_at: now,
      }
      upsert(store.subscriptionRequests, reviewed)
      if (decision === "APPROVED") {
        const expiresAt = new Date(Date.now() + 365 * 86_400_000).toISOString()
        upsertBy(
          store.subscriptions,
          {
            id: crypto.randomUUID(),
            restaurant_id: request.restaurant_id,
            plan: request.requested_plan,
            starts_at: now,
            expires_at: expiresAt,
            status: "ACTIVE",
            notes: `Approved payment request ${request.id}`,
            created_at: now,
            updated_at: now,
          },
          "restaurant_id",
        )
      }
      for (const owner of store.memberships.filter(
        (member) =>
          member.restaurant_id === request.restaurant_id &&
          member.role === "RESTAURANT_OWNER" &&
          member.status === "ACTIVE" &&
          member.profile_id,
      )) {
        store.notifications.push({
          id: crypto.randomUUID(),
          restaurant_id: request.restaurant_id,
          profile_id: owner.profile_id,
          title: `Subscription request ${decision.toLowerCase()}`,
          body:
            decision === "APPROVED"
              ? `Your ${request.requested_plan} plan is active.`
              : `Your request for the ${request.requested_plan} plan was not approved. ${adminNotes}`,
          created_at: now,
          updated_at: now,
        })
      }
      store.auditLogs.push({
        id: crypto.randomUUID(),
        restaurant_id: request.restaurant_id,
        actor_profile_id: reviewerProfileId,
        actor_role: "SUPER_ADMIN",
        action: `subscription_request.${decision.toLowerCase()}`,
        entity_type: "subscription_request",
        entity_id: request.id,
        metadata: { plan: request.requested_plan },
        created_at: now,
        updated_at: now,
      })
      return reviewed
    },
  )
  vi.spyOn(dataAdapter, "uploadSubscriptionProof").mockImplementation(
    async (_file, restaurantId, requestId) =>
      `${restaurantId}/${requestId}/proof.webp`,
  )
  vi.spyOn(dataAdapter, "getSubscriptionProofUrl").mockImplementation(
    async (path) => path,
  )
  vi.spyOn(dataAdapter, "deleteSubscriptionProof").mockResolvedValue()

  vi.spyOn(dataAdapter, "listNotifications").mockImplementation(async (id) =>
    store.notifications.filter((n) => n.restaurant_id === id),
  )
  vi.spyOn(dataAdapter, "saveNotification").mockImplementation(async (n) =>
    upsert(store.notifications, n),
  )

  vi.spyOn(dataAdapter, "listAuditLogs").mockImplementation(async (id) =>
    id
      ? store.auditLogs.filter((a) => a.restaurant_id === id)
      : [...store.auditLogs],
  )
  vi.spyOn(dataAdapter, "saveAuditLog").mockImplementation(async (a) =>
    upsert(store.auditLogs, a),
  )

  vi.spyOn(dataAdapter, "getPublicMenu").mockImplementation(
    async (slug, branch) => {
      const r = store.restaurants.find(
        (item) => item.slug === slug && !item.deleted_at,
      )
      if (!r) return undefined
      const s = store.settings.find((item) => item.restaurant_id === r.id)
      const b = store.branding.find((item) => item.restaurant_id === r.id)
      const rBranches = store.branches.filter(
        (item) => item.restaurant_id === r.id,
      )
      const br = rBranches.find((item) =>
        branch ? item.slug === branch : true,
      )
      return {
        restaurant: r,
        settings: s || {
          id: "s-1",
          restaurant_id: r.id,
          opening_hours: {},
          default_locale: "en" as const,
          created_at: "",
          updated_at: "",
        },
        branding: b || {
          id: "b-1",
          restaurant_id: r.id,
          primary_color: "#17221d",
          secondary_color: "#e6c387",
          background_color: "#f6f7f4",
          text_color: "#17221d",
          template: "Modern" as const,
          radius: "soft" as const,
          theme: "light" as const,
          font: "Cairo" as const,
          created_at: "",
          updated_at: "",
        },
        branch: br,
        branches: rBranches,
        categories: store.categories.filter(
          (c) => c.restaurant_id === r.id && c.is_visible && !c.deleted_at,
        ),
        products: store.products.filter(
          (p) => p.restaurant_id === r.id && p.is_visible && !p.deleted_at,
        ),
        offers: store.offers.filter(
          (o) => o.restaurant_id === r.id && o.is_active,
        ),
        show_nexmenu_branding: true,
      }
    },
  )

  vi.spyOn(dataAdapter, "getSession").mockImplementation(
    async () => currentSession,
  )
  vi.spyOn(dataAdapter, "signOut").mockImplementation(async () => {
    currentSession = null
    authListeners.forEach((l) => l("SIGNED_OUT", null))
  })
  vi.spyOn(dataAdapter, "inviteMember").mockImplementation(
    async (restaurantId, email, role) => {
      const normalizedEmail = email.trim().toLowerCase()
      const existing = store.memberships.find(
        (m) =>
          m.restaurant_id === restaurantId &&
          m.email.toLowerCase() === normalizedEmail,
      )
      if (existing) {
        throw new Error("Member already invited or part of this restaurant.")
      }
      const profile = store.profiles.find(
        (p) => p.email.toLowerCase() === normalizedEmail,
      )
      const now = new Date().toISOString()
      const member: Membership = {
        id: `mem-${Math.random().toString(36).slice(2, 9)}`,
        restaurant_id: restaurantId,
        profile_id: profile?.id,
        email: normalizedEmail,
        role,
        status: profile ? "ACTIVE" : "PENDING",
        created_at: now,
        updated_at: now,
      }
      store.memberships.push(member)
      return member
    },
  )
  vi.spyOn(dataAdapter, "requestPasswordReset").mockImplementation(
    async (email) => {
      if (import.meta.env.VITE_DATA_ADAPTER === "supabase") {
        return "If an account exists for this email, you will receive password reset instructions."
      }
      const profile = store.profiles.find(
        (p) => p.email === email.toLowerCase(),
      )
      if (!profile) throw new Error("No local account uses that email.")
      return resetCode
    },
  )
  vi.spyOn(dataAdapter, "resetPassword").mockImplementation(
    async (email, code, _password) => {
      if (import.meta.env.VITE_DATA_ADAPTER !== "supabase") {
        if (code !== resetCode)
          throw new Error("The development reset code is invalid.")
        const profile = store.profiles.find(
          (p) => p.email === email.toLowerCase(),
        )
        if (!profile) throw new Error("Profile not found")
      }
    },
  )
  if (dataAdapter.updatePassword) {
    vi.spyOn(dataAdapter, "updatePassword").mockImplementation(
      async (_password) => {},
    )
  }
  if (dataAdapter.onAuthStateChange) {
    vi.spyOn(dataAdapter, "onAuthStateChange").mockImplementation(
      (callback) => {
        authListeners.push(callback)
        return () => {
          const idx = authListeners.indexOf(callback)
          if (idx >= 0) authListeners.splice(idx, 1)
        }
      },
    )
  }

  const triggerAuthEvent = (
    event: string,
    session: Session | null = currentSession,
  ) => {
    currentSession = session
    authListeners.forEach((listener) => listener(event, session))
  }

  const setCurrentSession = (s: Session | null) => {
    currentSession = s
  }

  return { store, resetStore, triggerAuthEvent, setCurrentSession }
}
