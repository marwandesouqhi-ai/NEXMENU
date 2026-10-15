import { useEffect, useRef, useState } from "react"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Check,
  CreditCard,
  ImageUp,
  MessageCircle,
  ShieldCheck,
} from "lucide-react"

import { useAuth } from "@/app/AuthContext"

import { Button } from "@/components/ui/Button"

import { Card } from "@/components/ui/Card"

import { PAYMENT_ACCOUNT_NUMBER } from "@/config/payment"

import { PLANS } from "@/config/plans"

import {
  assessPaymentReceipt,
  readPaymentReceipt,
  type PaymentReceiptText,
} from "@/services/payment-receipt-ocr"

import { subscriptionService } from "@/services/subscriptions"

import type {
  PlanCode,
  SubscriptionPaymentMethod,
  SubscriptionRequest,
} from "@/types/domain"

import type { DashboardDetails } from "../types"

const SUPPORT_NUMBER = "201011488621"

const SUPPORT_DISPLAY_NUMBER = "+201011488621"

const PAYMENT_CHANNELS: {
  id: Exclude<SubscriptionPaymentMethod, "FREE">
  label: string
}[] = [
  { id: "INSTAPAY", label: "InstaPay" },

  { id: "VODAFONE_CASH", label: "Vodafone Cash" },
]

export function SubscriptionSection({ data }: { data: DashboardDetails }) {
  const { session } = useAuth()

  const client = useQueryClient()

  const subscription = data.subscription

  const currentPlan = PLANS[subscription?.plan ?? "FREE"]

  const restaurantId = data.restaurant?.id ?? ""

  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>(
    subscription?.plan === "FREE" ? "PRO" : (subscription?.plan ?? "PRO"),
  )

  const [selectedChannel, setSelectedChannel] =
    useState<Exclude<SubscriptionPaymentMethod, "FREE">>("INSTAPAY")

  const [paymentReference, setPaymentReference] = useState("")

  const [paymentProof, setPaymentProof] = useState<File | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const previewUrlRef = useRef<string | null>(null)

  const proofAnalysisId = useRef(0)

  const [receiptOcr, setReceiptOcr] = useState<PaymentReceiptText | null>(null)

  const [receiptOcrStatus, setReceiptOcrStatus] =
    useState<"idle" | "analyzing" | "error">("idle")

  const [receiptOcrError, setReceiptOcrError] = useState("")

  const [submittedRequest, setSubmittedRequest] =
    useState<SubscriptionRequest | null>(null)

  const selectedPlan = PLANS[selectedPlanCode]

  const isFreePlan = selectedPlan.price === 0

  const receiptAssessment = receiptOcr
    ? assessPaymentReceipt(
        receiptOcr.text,
        PAYMENT_ACCOUNT_NUMBER,
        selectedPlan.price,
      )
    : null

  useEffect(
    () => () => {
      proofAnalysisId.current += 1
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    },
    [],
  )

  const setProofFile = (file: File | null) => {
    const analysisId = ++proofAnalysisId.current

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = file ? URL.createObjectURL(file) : null
    setPreviewUrl(previewUrlRef.current)
    setPaymentProof(file)
    setReceiptOcr(null)
    setReceiptOcrError("")

    if (!file) {
      setReceiptOcrStatus("idle")
      return
    }

    setReceiptOcrStatus("analyzing")
    void readPaymentReceipt(file)
      .then((result) => {
        if (analysisId !== proofAnalysisId.current) return
        setReceiptOcr(result)
        setReceiptOcrStatus("idle")
      })
      .catch((error: unknown) => {
        if (analysisId !== proofAnalysisId.current) return
        setReceiptOcrError(
          error instanceof Error
            ? error.message
            : "The receipt could not be analyzed.",
        )
        setReceiptOcrStatus("error")
      })
  }

  const requestsQuery = useQuery({
    queryKey: ["subscription-requests", restaurantId],

    queryFn: () => subscriptionService.listRequests(session!, restaurantId),

    enabled: Boolean(session && restaurantId),
  })

  const requestMutation = useMutation({
    mutationFn: () =>
      subscriptionService.createRequest(session!, {
        restaurantId,

        plan: selectedPlanCode,

        paymentMethod: isFreePlan ? "FREE" : selectedChannel,

        paymentReference,

        proofFile: isFreePlan ? null : paymentProof,
      }),

    onSuccess: (request) => {
      setSubmittedRequest(request)

      setProofFile(null)

      void client.invalidateQueries({
        queryKey: ["subscription-requests", restaurantId],
      })

      void client.invalidateQueries({ queryKey: ["restaurant", restaurantId] })
    },
  })

  const hasPendingRequest =
    requestsQuery.data?.some((request) => request.status === "PENDING") ?? false

  const whatsappMessage = submittedRequest
    ? [
        "Hello NEXMENU support,",

        `I submitted subscription request ${submittedRequest.id}.`,

        `Restaurant: ${data.restaurant?.name_en || data.restaurant?.name_ar || "Restaurant"}`,

        `Requested plan: ${PLANS[submittedRequest.requested_plan].name}`,

        `Amount: ${submittedRequest.amount.toLocaleString()} EGP`,

        submittedRequest.payment_reference
          ? `Payment reference: ${submittedRequest.payment_reference}`
          : "",

        "The payment proof is uploaded in my account for CRM review.",
      ]
        .filter(Boolean)
        .join("\n")
    : ""

  const whatsappUrl = submittedRequest
    ? `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`
    : ""

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]">
        <Card className="overflow-hidden bg-[var(--ink)] p-7 text-white">
          <p className="text-xs font-bold tracking-[.15em] text-[var(--accent-bright)]">
            CURRENT PLAN
          </p>
          <p className="mt-4 text-4xl font-black">{currentPlan.name}</p>
          <p className="mt-3 text-sm text-white/55">
            {subscription?.status ?? "ACTIVE"} · Renewed manually
          </p>
          <div className="mt-10 border-t border-white/10 pt-5 text-sm text-white/55">
            <p>
              Start:{" "}
              {subscription
                ? new Date(subscription.starts_at).toLocaleDateString()
                : "—"}
            </p>
            <p className="mt-2">
              Expires:{" "}
              {subscription
                ? new Date(subscription.expires_at).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </Card>

        <Card className="p-7">
          <h2 className="text-xl font-black">Plan capabilities</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              [
                currentPlan.productLimit
                  ? `${currentPlan.productLimit} products`
                  : "Unlimited products",
                true,
              ],

              [
                currentPlan.branchLimit
                  ? `${currentPlan.branchLimit} branches`
                  : "Unlimited branches",
                true,
              ],

              ["Menu analytics", currentPlan.analytics],

              ["Advanced branding", currentPlan.advancedBranding],

              ["Remove NEXMENU branding", currentPlan.hideBranding],
            ].map(([label, enabled]) => (
              <div
                key={String(label)}
                className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"
              >
                <span
                  className={
                    enabled
                      ? "grid size-6 place-items-center rounded-full bg-[var(--accent)] text-white"
                      : "grid size-6 place-items-center rounded-full bg-[var(--line)] text-[var(--ink-faint)]"
                  }
                >
                  <Check className="size-3.5" />
                </span>
                <p className="text-sm font-bold">{String(label)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[.15em] text-[var(--accent)]">
              PLAN REQUEST
            </p>
            <h3 className="mt-2 text-2xl font-black">
              Choose a plan for your restaurant
            </h3>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--muted)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)]">
            <ShieldCheck className="size-3.5 text-[var(--accent)]" />
            Manual payment verification
          </span>
        </div>

        {hasPendingRequest && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            Your previous plan request is awaiting review. You can submit
            another request after it has been approved or rejected.
          </div>
        )}
        {submittedRequest && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4"
          >
            <p className="font-black text-emerald-950">
              Request submitted for CRM review
            </p>
            <p className="mt-1 text-sm text-emerald-900">
              Request ID: {submittedRequest.id}. Your current plan stays active
              until an administrator approves the request.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white"
            >
              <MessageCircle className="size-4" /> Notify support on WhatsApp
            </a>
          </div>
        )}

        <form
          className="mt-6 space-y-6"
          onSubmit={(event) => {
            event.preventDefault()

            requestMutation.mutate()
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.values(PLANS).map((plan) => {
              const isSelected = selectedPlanCode === plan.code

              const isCurrent = currentPlan.code === plan.code

              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(plan.code)}
                  className={[
                    "rounded-2xl border p-4 text-left transition-all",

                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/40",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--accent)]">
                        {plan.code}
                      </p>
                      <h4 className="mt-2 text-xl font-black">
                        {plan.name} plan
                      </h4>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-[var(--ink)] px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-white">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-2xl font-black">
                    {plan.price === 0
                      ? "Free"
                      : `${plan.price.toLocaleString()} EGP`}
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">
                    {plan.productLimit
                      ? `Up to ${plan.productLimit} products`
                      : "Unlimited products"}{" "}
                    ·{" "}
                    {plan.branchLimit
                      ? `${plan.branchLimit} branches`
                      : "Unlimited branches"}
                  </p>
                </button>
              )
            })}
          </div>

          {!isFreePlan ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-[var(--accent)]" />
                  <p className="text-sm font-black uppercase tracking-[.12em] text-[var(--ink-soft)]">
                    Payment method
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {PAYMENT_CHANNELS.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setSelectedChannel(channel.id)}
                      className={[
                        "flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition",

                        selectedChannel === channel.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--line)] bg-white/50",
                      ].join(" ")}
                    >
                      <div>
                        <p className="font-bold">{channel.label}</p>
                        <p className="mt-1 text-sm text-[var(--ink-soft)]">
                          {PAYMENT_ACCOUNT_NUMBER}
                        </p>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]">
                        {selectedChannel === channel.id ? "Selected" : "Choose"}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-sm font-bold">
                  Payment transaction/reference number (optional)
                  <input
                    value={paymentReference}
                    onChange={(event) =>
                      setPaymentReference(event.target.value)
                    }
                    maxLength={120}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <p className="mt-4 rounded-xl bg-[var(--muted)] p-3 text-sm text-[var(--ink-soft)]">
                  Transfer the displayed amount to {PAYMENT_ACCOUNT_NUMBER}{" "}
                  through{" "}
                  {
                    PAYMENT_CHANNELS.find(
                      (channel) => channel.id === selectedChannel,
                    )?.label
                  }
                  , then upload the receipt.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2">
                  <ImageUp className="size-4 text-[var(--accent)]" />
                  <p className="text-sm font-black uppercase tracking-[.12em] text-[var(--ink-soft)]">
                    Payment proof
                  </p>
                </div>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--muted)] p-5 text-center transition hover:border-[var(--accent)]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) =>
                      setProofFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <span className="rounded-full bg-white p-3 shadow-sm">
                    <ImageUp className="size-5 text-[var(--accent)]" />
                  </span>
                  <span className="mt-3 text-sm font-bold text-[var(--ink)]">
                    {paymentProof
                      ? paymentProof.name
                      : "Upload transfer receipt"}
                  </span>
                  <span className="mt-1 text-xs text-[var(--ink-soft)]">
                    JPG, PNG or WebP · max 5MB · stored privately for CRM review
                  </span>
                </label>
                {previewUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
                    <img
                      src={previewUrl}
                      alt="Payment proof preview"
                      className="h-44 w-full object-contain"
                    />
                  </div>
                )}
                {paymentProof && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4 text-sm"
                  >
                    <p className="font-black text-[var(--ink)]">
                      Automatic receipt check
                    </p>
                    {receiptOcrStatus === "analyzing" && (
                      <p className="mt-2 text-[var(--ink-soft)]">
                        Reading the receipt. The first check may take a little
                        longer while the OCR language data loads.
                      </p>
                    )}
                    {receiptOcrStatus === "error" && (
                      <p className="mt-2 font-bold text-[var(--danger)]">
                        Could not read this receipt: {receiptOcrError}
                      </p>
                    )}
                    {receiptAssessment && (
                      <>
                        <ul className="mt-3 grid gap-1 text-[var(--ink-soft)]">
                          <li>
                            Transfer number{" "}
                            {receiptAssessment.recipientFound
                              ? "found in image"
                              : "not detected"}
                          </li>
                          <li>
                            {selectedPlan.price.toLocaleString()} EGP plan
                            amount{" "}
                            {receiptAssessment.amountFound
                              ? "found in image"
                              : "not detected"}
                          </li>
                          <li>
                            Text recognition confidence:{" "}
                            {Math.round(receiptOcr!.confidence)}%
                          </li>
                        </ul>
                        <p className="mt-3 font-bold text-[var(--ink)]">
                          {receiptAssessment.looksConsistent
                            ? "The visible details look consistent with this plan."
                            : "The receipt needs a manual check in CRM."}
                        </p>
                      </>
                    )}
                    <p className="mt-3 text-xs leading-5 text-[var(--ink-soft)]">
                      This reads text from the image only; it cannot confirm
                      that money reached the account. OCR never approves or
                      activates a subscription.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--muted)] p-4 text-sm text-[var(--ink-soft)]">
              The Free plan has no transfer or receipt requirement. Submit a
              request for CRM approval.
            </div>
          )}

          {requestMutation.isError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm font-bold text-[var(--danger)]"
            >
              {requestMutation.error.message}
            </p>
          )}

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--muted)] p-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-[var(--accent)]" />
              <p className="text-sm font-black uppercase tracking-[.12em] text-[var(--ink-soft)]">
                Request review
              </p>
            </div>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              Submitting saves your plan, transfer reference and receipt
              securely for the CRM team. The automatic image check is only an
              initial text check; your plan changes only after a CRM reviewer
              confirms the payment. For follow-up, WhatsApp support at{" "}
              {SUPPORT_DISPLAY_NUMBER}.
            </p>
            <p className="mt-2 text-sm font-bold text-[var(--ink)]">
              Selected plan: {selectedPlan.name} ·{" "}
              {selectedPlan.price.toLocaleString()} EGP
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelectedPlanCode(
                  currentPlan.code === "FREE" ? "PRO" : currentPlan.code,
                )

                setProofFile(null)

                setPaymentReference("")

                requestMutation.reset()
              }}
            >
              Reset
            </Button>
            <Button
              type="submit"
              className="min-w-52"
              loading={requestMutation.isPending}
              disabled={hasPendingRequest || requestsQuery.isLoading}
            >
              Submit for CRM review
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 sm:p-7">
        <h2 className="text-xl font-black">
          Your subscription request history
        </h2>
        {requestsQuery.isError ? (
          <p
            role="alert"
            className="mt-4 text-sm font-bold text-[var(--danger)]"
          >
            Could not load subscription requests. Refresh and try again.
          </p>
        ) : requestsQuery.data?.length ? (
          <div className="mt-4 space-y-3">
            {requestsQuery.data.map((request) => (
              <RequestHistoryItem key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            No plan requests submitted yet.
          </p>
        )}
      </Card>

      {data.notifications.some((notification) =>
        notification.title.toLowerCase().includes("subscription request"),
      ) && (
        <Card className="p-6 sm:p-7">
          <h2 className="text-xl font-black">Subscription updates</h2>
          <div className="mt-4 space-y-3">
            {data.notifications

              .filter((notification) =>
                notification.title
                  .toLowerCase()
                  .includes("subscription request"),
              )

              .sort((a, b) => b.created_at.localeCompare(a.created_at))

              .slice(0, 5)

              .map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-xl border border-[var(--line)] p-4"
                >
                  <p className="font-bold">{notification.title}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {notification.body}
                  </p>
                  <p className="mt-2 text-xs text-[var(--ink-faint)]">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function RequestHistoryItem({ request }: { request: SubscriptionRequest }) {
  const statusClasses =
    request.status === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : request.status === "REJECTED"
        ? "bg-rose-100 text-rose-800"
        : "bg-amber-100 text-amber-800"

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-black">
          {PLANS[request.requested_plan].name} plan ·{" "}
          {request.amount.toLocaleString()} EGP
        </p>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Submitted {new Date(request.created_at).toLocaleString()} ·{" "}
          {request.payment_reference ||
            request.payment_number ||
            "No payment reference"}
        </p>
        {request.admin_notes && (
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            CRM note: {request.admin_notes}
          </p>
        )}
      </div>
      <span
        className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${statusClasses}`}
      >
        {request.status}
      </span>
    </div>
  )
}

export default SubscriptionSection
