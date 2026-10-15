import { useMemo, useState } from "react"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileImage,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react"

import { Navigate, useNavigate } from "react-router"

import { useAuth } from "@/app/AuthContext"

import { getPublicMenuUrl } from "@/app/target"

import { PAYMENT_ACCOUNT_NUMBER } from "@/config/payment"

import { PLANS } from "@/config/plans"

import { adminService } from "@admin/services/adminService"

import {
  assessPaymentReceipt,
  readPaymentReceiptUrl,
} from "@/services/payment-receipt-ocr"

import { Brand } from "@/components/shared/Brand"

import { Button } from "@/components/ui/Button"

import { Card } from "@/components/ui/Card"

import { ErrorState, LoadingState } from "@/components/ui/States"

import {
  getDerivedSubscriptionStatus,
  type PlanCode,
  type SubscriptionRequest,
  type SubscriptionRequestDecision,
} from "@/types/domain"

const PLAN_OPTIONS = Object.values(PLANS)

export default function CRMAdminPage() {
  const { session, profile, signOut } = useAuth()

  const client = useQueryClient()

  const navigate = useNavigate()

  const [searchTerm, setSearchTerm] = useState("")

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  )

  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState<string | null>(null)

  const [reviewNote, setReviewNote] = useState("")

  const [actionError, setActionError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ["crm-admin"],

    queryFn: () => adminService.dashboard(session!),

    enabled: Boolean(session && profile?.platform_role === "SUPER_ADMIN"),
  })

  const planMutation = useMutation({
    mutationFn: ({
      restaurantId,
      next,
    }: {
      restaurantId: string
      next: PlanCode
    }) => adminService.setPlan(session!, restaurantId, next),

    onSuccess: () => {
      setActionError(null)

      void client.invalidateQueries({ queryKey: ["crm-admin"] })

      void client.invalidateQueries({ queryKey: ["admin"] })
    },

    onError: (error: Error) => setActionError(error.message),
  })

  const reviewMutation = useMutation({
    mutationFn: ({
      requestId,
      decision,
    }: {
      requestId: string
      decision: SubscriptionRequestDecision
    }) =>
      adminService.reviewSubscriptionRequest(
        session!,
        requestId,
        decision,
        reviewNote,
      ),

    onSuccess: () => {
      setActionError(null)

      setSelectedRequestId(null)

      setReviewNote("")

      void client.invalidateQueries({ queryKey: ["crm-admin"] })

      void client.invalidateQueries({ queryKey: ["admin"] })

      void client.invalidateQueries({ queryKey: ["restaurant"] })
    },

    onError: (error: Error) => setActionError(error.message),
  })

  const selectedRequest = query.data?.subscriptionRequests.find(
    (request) => request.id === selectedRequestId,
  )

  const proofQuery = useQuery({
    queryKey: ["crm-subscription-proof", selectedRequest?.id],

    queryFn: () =>
      adminService.subscriptionProofUrl(session!, selectedRequest!.proof_path!),

    enabled: Boolean(session && selectedRequest?.proof_path),

    staleTime: 4 * 60 * 1000,
  })

  const proofOcrQuery = useQuery({
    queryKey: ["crm-subscription-proof-ocr", selectedRequest?.id],
    queryFn: () => readPaymentReceiptUrl(proofQuery.data!),
    enabled: Boolean(session && selectedRequest?.proof_path && proofQuery.data),
    staleTime: Infinity,
    retry: false,
  })

  const proofAssessment =
    selectedRequest && proofOcrQuery.data
      ? assessPaymentReceipt(
          proofOcrQuery.data.text,
          PAYMENT_ACCOUNT_NUMBER,
          PLANS[selectedRequest.requested_plan].price,
        )
      : null

  const rows = useMemo(() => {
    if (!query.data) return []

    return query.data.restaurants

      .map((restaurant) => {
        const subscription = query.data.subscriptions.find(
          (item) => item.restaurant_id === restaurant.id,
        )

        return {
          restaurant,

          subscription,

          plan: subscription?.plan ?? "FREE",

          status: getDerivedSubscriptionStatus(subscription),

          requests: query.data.subscriptionRequests.filter(
            (request) => request.restaurant_id === restaurant.id,
          ),
        }
      })

      .filter(({ restaurant, plan }) =>
        [
          restaurant.name_en,
          restaurant.name_ar,
          restaurant.slug,
          restaurant.phone,
          plan,
        ]

          .join(" ")

          .toLowerCase()

          .includes(searchTerm.toLowerCase()),
      )
  }, [query.data, searchTerm])

  const summaries = useMemo(() => {
    const allRows =
      query.data?.restaurants.map((restaurant) => {
        const subscription = query.data?.subscriptions.find(
          (item) => item.restaurant_id === restaurant.id,
        )

        return getDerivedSubscriptionStatus(subscription)
      }) ?? []

    return {
      customers: query.data?.restaurants.length ?? 0,

      active: allRows.filter((status) => status === "active").length,

      expiring: allRows.filter((status) => status === "expiring_soon").length,

      expired: allRows.filter((status) => status === "expired").length,

      pending:
        query.data?.subscriptionRequests.filter(
          (request) => request.status === "PENDING",
        ).length ?? 0,
    }
  }, [query.data])

  const attentionRows = rows

    .filter((row) => row.status !== "active")

    .slice(0, 6)

  if (!session) return <Navigate to="/login" replace />

  if (query.isLoading) return <LoadingState />

  if (query.isError || !query.data)
    return (
      <ErrorState body="CRM subscriptions dashboard could not be loaded." />
    )

  const logout = async () => {
    await signOut()

    navigate("/login")
  }

  const selectedRestaurant = query.data.restaurants.find(
    (item) => item.id === selectedRestaurantId,
  )

  const restaurantMembers = query.data.memberships.filter(
    (member) =>
      member.restaurant_id === selectedRestaurantId &&
      member.role === "RESTAURANT_OWNER",
  )

  const ownerEmail =
    restaurantMembers[0]?.email ??
    query.data.profiles.find(
      (item) => item.id === restaurantMembers[0]?.profile_id,
    )?.email

  const requestRestaurant = selectedRequest
    ? query.data.restaurants.find(
        (item) => item.id === selectedRequest.restaurant_id,
      )
    : undefined

  const requester = selectedRequest
    ? query.data.profiles.find(
        (item) => item.id === selectedRequest.requester_profile_id,
      )
    : undefined

  const customerWhatsapp = selectedRestaurant?.whatsapp.replace(/\D/g, "") ?? ""

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/admin")}
            >
              Full admin
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--accent)]">
              CRM · SUBSCRIPTIONS
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">
              Customer subscriptions
            </h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Review payment proofs, activate plans and follow up on expiring
              accounts.
            </p>
          </div>
          <label className="w-full max-w-md">
            <span className="text-xs font-black uppercase tracking-[.12em] text-[var(--ink-soft)]">
              Search customers
            </span>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3">
              <Search className="size-4 text-[var(--ink-soft)]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name, slug, phone..."
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-[var(--ink-faint)]"
              />
            </span>
          </label>
        </div>

        {actionError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm font-bold text-[var(--danger)]"
          >
            {actionError}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Customers"
            value={summaries.customers}
            icon={Users}
          />
          <StatCard
            label="Active"
            value={summaries.active}
            icon={ShieldCheck}
          />
          <StatCard
            label="Expiring soon"
            value={summaries.expiring}
            icon={Clock3}
          />
          <StatCard
            label="Expired"
            value={summaries.expired}
            icon={AlertTriangle}
          />
          <StatCard
            label="Awaiting payment review"
            value={summaries.pending}
            icon={CreditCard}
          />
        </div>

        {summaries.pending > 0 && (
          <Card className="mt-8 border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-1 size-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-black text-amber-950">
                  {summaries.pending} payment request
                  {summaries.pending === 1 ? "" : "s"} need review
                </h2>
                <p className="mt-1 text-sm text-amber-900">
                  Open a pending request below to inspect the private receipt,
                  then approve or reject it.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-black">Payment requests</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Newest requests first. Approving activates the selected plan for
                one year.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--muted)] text-[var(--ink-soft)]">
                  <tr>
                    <th className="px-4 py-3 font-black">Customer</th>
                    <th className="px-4 py-3 font-black">Requested plan</th>
                    <th className="px-4 py-3 font-black">Payment</th>
                    <th className="px-4 py-3 font-black">Status</th>
                    <th className="px-4 py-3 font-black">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.subscriptionRequests.map((request) => {
                    const restaurant = query.data.restaurants.find(
                      (item) => item.id === request.restaurant_id,
                    )

                    return (
                      <tr
                        key={request.id}
                        className="border-t border-[var(--line)] align-top"
                      >
                        <td className="px-4 py-4">
                          <p className="font-black">
                            {restaurant?.name_en ||
                              restaurant?.name_ar ||
                              "Restaurant"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--ink-soft)]">
                            {new Date(request.created_at).toLocaleString()}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold">
                            {PLANS[request.requested_plan].name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--ink-soft)]">
                            {request.amount.toLocaleString()} EGP
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold">
                            {paymentMethodLabel(request)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--ink-soft)]">
                            {request.payment_reference ||
                              request.payment_number ||
                              "No reference"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <RequestStatus status={request.status} />
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedRequestId(request.id)

                              setSelectedRestaurantId(request.restaurant_id)
                            }}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {query.data.subscriptionRequests.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-sm text-[var(--ink-soft)]"
                      >
                        No subscription requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-6">
            {selectedRequest ? (
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.13em] text-[var(--accent)]">
                      Request review
                    </p>
                    <h2 className="mt-2 text-xl font-black">
                      {requestRestaurant?.name_en ||
                        requestRestaurant?.name_ar ||
                        "Restaurant"}
                    </h2>
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">
                      Request {selectedRequest.id}
                    </p>
                  </div>
                  <RequestStatus status={selectedRequest.status} />
                </div>
                <div className="mt-5 grid gap-3 rounded-xl bg-[var(--muted)] p-4 text-sm sm:grid-cols-2">
                  <Detail
                    label="Requested plan"
                    value={PLANS[selectedRequest.requested_plan].name}
                  />
                  <Detail
                    label="Amount"
                    value={`${selectedRequest.amount.toLocaleString()} EGP`}
                  />
                  <Detail
                    label="Payment method"
                    value={paymentMethodLabel(selectedRequest)}
                  />
                  <Detail
                    label="Transfer account"
                    value={selectedRequest.payment_number || "Not applicable"}
                  />
                  <Detail
                    label="Transaction reference"
                    value={selectedRequest.payment_reference || "Not provided"}
                  />
                  <Detail
                    label="Submitted by"
                    value={requester?.email ?? "Customer account"}
                  />
                  <Detail
                    label="Customer phone"
                    value={requestRestaurant?.phone || "Not provided"}
                  />
                  <Detail
                    label="WhatsApp"
                    value={requestRestaurant?.whatsapp || "Not provided"}
                  />
                </div>
                {selectedRequest.proof_path && (
                  <div className="mt-4 rounded-xl border border-[var(--line)] p-4">
                    <div className="flex items-center gap-2 font-black">
                      <FileImage className="size-4 text-[var(--accent)]" />
                      Payment proof
                    </div>
                    {proofQuery.isLoading ? (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">
                        Loading secure receipt preview…
                      </p>
                    ) : proofQuery.isError ? (
                      <p
                        role="alert"
                        className="mt-3 text-sm font-bold text-[var(--danger)]"
                      >
                        Could not load the payment proof. Refresh the request
                        and try again.
                      </p>
                    ) : proofQuery.data ? (
                      <a
                        href={proofQuery.data}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block"
                      >
                        <img
                          src={proofQuery.data}
                          alt="Uploaded payment proof"
                          className="max-h-72 w-full rounded-lg border border-[var(--line)] object-contain"
                        />
                        <span className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
                          Open full-size receipt{" "}
                          <ArrowUpRight className="size-4" />
                        </span>
                      </a>
                    ) : null}
                  </div>
                )}
                {selectedRequest.proof_path && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--muted)] p-4"
                  >
                    <div className="flex items-center gap-2 font-black">
                      <ShieldCheck className="size-4 text-[var(--accent)]" />
                      Automatic receipt text check
                    </div>
                    {proofOcrQuery.isLoading && (
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">
                        Reading receipt text. The first check may take longer
                        while OCR language data loads.
                      </p>
                    )}
                    {proofOcrQuery.isError && (
                      <p className="mt-3 text-sm font-bold text-[var(--danger)]">
                        Could not analyze this receipt:{" "}
                        {proofOcrQuery.error.message}
                      </p>
                    )}
                    {proofAssessment && selectedRequest && (
                      <>
                        <ul className="mt-3 grid gap-2 text-sm text-[var(--ink-soft)]">
                          <li>
                            Transfer number {PAYMENT_ACCOUNT_NUMBER}{" "}
                            {proofAssessment.recipientFound
                              ? "found in the image"
                              : "not detected"}
                          </li>
                          <li>
                            {PLANS[
                              selectedRequest.requested_plan
                            ].price.toLocaleString()}{" "}
                            EGP plan amount{" "}
                            {proofAssessment.amountFound
                              ? "found in the image"
                              : "not detected"}
                          </li>
                          <li>
                            Requested amount matches saved plan price{" "}
                            {selectedRequest.amount ===
                            PLANS[selectedRequest.requested_plan].price
                              ? "yes"
                              : "no"}
                          </li>
                          <li>
                            OCR text confidence:{" "}
                            {Math.round(proofOcrQuery.data!.confidence)}%
                          </li>
                        </ul>
                        <p className="mt-3 font-black text-[var(--ink)]">
                          {proofAssessment.looksConsistent &&
                          selectedRequest.amount ===
                            PLANS[selectedRequest.requested_plan].price
                            ? "Visible details look consistent; confirm the transfer in the official payment account before approval."
                            : "Manual verification required. One or more details were not detected or do not match the saved plan."}
                        </p>
                      </>
                    )}
                    <p className="mt-3 text-xs leading-5 text-[var(--ink-soft)]">
                      OCR reads image text only. It cannot confirm that money
                      was received, and this result never approves a request
                      automatically. Verify the transfer directly in the
                      official payment account before approving.
                    </p>
                  </div>
                )}
                {selectedRequest.status === "PENDING" && (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-bold">
                      Decision note (shown to the customer)
                      <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        rows={3}
                        maxLength={500}
                        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white p-3 text-sm font-normal outline-none focus:border-[var(--accent)]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            requestId: selectedRequest.id,
                            decision: "APPROVED",
                          })
                        }
                      >
                        <CheckCircle2 className="size-4" /> Approve & activate
                      </Button>
                      <Button
                        variant="danger"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            requestId: selectedRequest.id,
                            decision: "REJECTED",
                          })
                        }
                      >
                        <XCircle className="size-4" /> Reject request
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-5">
                <p className="text-xs font-black uppercase tracking-[.13em] text-[var(--accent)]">
                  Review payments
                </p>
                <h2 className="mt-2 text-xl font-black">Select a request</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                  Customer details, the transaction reference and the secure
                  proof image will appear here.
                </p>
              </Card>
            )}

            {selectedRestaurant && (
              <Card className="p-5">
                <p className="text-xs font-black uppercase tracking-[.13em] text-[var(--accent)]">
                  Customer profile
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {selectedRestaurant.name_en || selectedRestaurant.name_ar}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {selectedRestaurant.slug}
                </p>
                <div className="mt-4 grid gap-3 rounded-xl bg-[var(--muted)] p-4 text-sm sm:grid-cols-2">
                  <Detail
                    label="Phone"
                    value={selectedRestaurant.phone || "Not provided"}
                  />
                  <Detail
                    label="Owner email"
                    value={ownerEmail || "Not available"}
                  />
                  <Detail
                    label="Current plan"
                    value={
                      PLANS[
                        query.data.subscriptions.find(
                          (item) =>
                            item.restaurant_id === selectedRestaurant.id,
                        )?.plan ?? "FREE"
                      ].name
                    }
                  />
                  <Detail
                    label="Menu status"
                    value={selectedRestaurant.menu_status}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={getPublicMenuUrl(selectedRestaurant.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-sm font-bold text-[var(--ink)]"
                  >
                    Open menu <ArrowUpRight className="size-4" />
                  </a>
                  {customerWhatsapp && (
                    <a
                      href={`https://wa.me/${customerWhatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] px-3 text-sm font-bold text-[var(--ink)]"
                    >
                      Contact customer
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        <Card className="mt-8 overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-lg font-black">Customer accounts</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Open customer records, review their plan history or make a manual
              plan correction.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--muted)] text-[var(--ink-soft)]">
                <tr>
                  <th className="px-4 py-3 font-black">Restaurant</th>
                  <th className="px-4 py-3 font-black">Current plan</th>
                  <th className="px-4 py-3 font-black">Subscription status</th>
                  <th className="px-4 py-3 font-black">Requests</th>
                  <th className="px-4 py-3 font-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(
                  ({ restaurant, subscription, plan, status, requests }) => (
                    <tr
                      key={restaurant.id}
                      className="border-t border-[var(--line)] align-top"
                    >
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="text-left font-black text-[var(--ink)] hover:text-[var(--accent)]"
                          onClick={() => setSelectedRestaurantId(restaurant.id)}
                        >
                          {restaurant.name_en ||
                            restaurant.name_ar ||
                            restaurant.slug}
                        </button>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          {restaurant.slug} · {restaurant.phone || "No phone"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={plan}
                          onChange={(event) =>
                            planMutation.mutate({
                              restaurantId: restaurant.id,
                              next: event.target.value as PlanCode,
                            })
                          }
                          disabled={planMutation.isPending}
                          className="min-h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold outline-none"
                          aria-label={`Change plan for ${restaurant.name_en || restaurant.slug}`}
                        >
                          {PLAN_OPTIONS.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-[var(--ink-soft)]">
                          {subscription
                            ? `Expires ${new Date(subscription.expires_at).toLocaleDateString()}`
                            : "No subscription record"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <SubscriptionStatus status={status} />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold">
                          {requests.length} request
                          {requests.length === 1 ? "" : "s"}
                        </p>
                        {requests.some(
                          (request) => request.status === "PENDING",
                        ) && (
                          <p className="mt-1 text-xs font-bold text-amber-700">
                            Pending review
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedRestaurantId(restaurant.id)

                              setSelectedRequestId(null)
                            }}
                          >
                            Customer details
                          </Button>
                          {requests[0] && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRequestId(requests[0].id)

                                setSelectedRestaurantId(restaurant.id)
                              }}
                            >
                              Latest request
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-[var(--ink-soft)]"
                    >
                      No customers match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="mt-8 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 size-5 shrink-0 text-amber-600" />
            <div className="w-full">
              <h2 className="font-black">Renewal follow-up</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Accounts expiring within 14 days or already expired are surfaced
                here for CRM follow-up.
              </p>
              {attentionRows.length > 0 ? (
                <div className="mt-4 divide-y divide-[var(--line)]">
                  {attentionRows.map(({ restaurant, subscription, status }) => (
                    <div
                      key={restaurant.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold">
                          {restaurant.name_en || restaurant.name_ar}
                        </p>
                        <p className="text-xs text-[var(--ink-soft)]">
                          {status === "expiring_soon" ? "Expires" : "Expired"}:{" "}
                          {subscription
                            ? new Date(
                                subscription.expires_at,
                              ).toLocaleDateString()
                            : "No subscription record"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <SubscriptionStatus status={status} />
                        {restaurant.whatsapp && (
                          <a
                            href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-bold text-[var(--accent)]"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm font-bold text-emerald-700">
                  No expired or soon-to-expire accounts.
                </p>
              )}
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}

function paymentMethodLabel(request: SubscriptionRequest) {
  if (request.payment_method === "INSTAPAY") return "InstaPay"

  if (request.payment_method === "VODAFONE_CASH") return "Vodafone Cash"

  return "Free plan request"
}

function RequestStatus({ status }: { status: SubscriptionRequest["status"] }) {
  const styles = {
    PENDING: "bg-amber-100 text-amber-800",

    APPROVED: "bg-emerald-100 text-emerald-800",

    REJECTED: "bg-rose-100 text-rose-800",
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${styles[status]}`}
    >
      {status}
    </span>
  )
}

function SubscriptionStatus({
  status,
}: {
  status: "active" | "expiring_soon" | "expired"
}) {
  const classes =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "expiring_soon"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800"

  const label =
    status === "expiring_soon"
      ? "Expiring soon"
      : status[0].toUpperCase() + status.slice(1)

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${classes}`}
    >
      {label}
    </span>
  )
}

type DetailProps = {
  label: string
  value: string
}

function Detail({ label, value }: DetailProps) {
  return (
    <div>
      <p className="text-xs font-bold text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 break-words font-bold text-[var(--ink)]">{value}</p>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Building2
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <div className="grid size-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--accent)]">
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  )
}
