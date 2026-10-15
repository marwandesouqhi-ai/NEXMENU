import { dataAdapter } from "@/data"

import { PAYMENT_ACCOUNT_NUMBER } from "@/config/payment"

import { PLANS } from "@/config/plans"

import { ValidationError } from "@/lib/errors"

import { authorize } from "@/services/authorization"

import type {
  PlanCode,
  Session,
  SubscriptionPaymentMethod,
  SubscriptionRequest,
} from "@/types/domain"

export const subscriptionService = {
  async listRequests(
    session: Session,
    restaurantId: string,
  ): Promise<SubscriptionRequest[]> {
    await authorize(dataAdapter, session, "subscription:request", restaurantId)

    return dataAdapter.listSubscriptionRequests(restaurantId)
  },

  async createRequest(
    session: Session,

    input: {
      restaurantId: string

      plan: PlanCode

      paymentMethod: SubscriptionPaymentMethod

      paymentReference: string

      proofFile: File | null
    },
  ): Promise<SubscriptionRequest> {
    const auth = await authorize(
      dataAdapter,
      session,
      "subscription:request",
      input.restaurantId,
    )

    const plan = PLANS[input.plan]

    const isFree = plan.price === 0

    if (
      (isFree && input.paymentMethod !== "FREE") ||
      (!isFree && input.paymentMethod === "FREE")
    ) {
      throw new ValidationError(
        "Choose a payment method that matches the selected plan.",
      )
    }

    if (!isFree && !input.proofFile) {
      throw new ValidationError(
        "Upload your payment receipt before submitting the request.",
      )
    }

    if (input.paymentReference.trim().length > 120) {
      throw new ValidationError(
        "Payment reference must be 120 characters or fewer.",
      )
    }

    if (
      (await dataAdapter.listSubscriptionRequests(input.restaurantId)).some(
        (request) => request.status === "PENDING",
      )
    ) {
      throw new ValidationError(
        "You already have a subscription request waiting for review.",
      )
    }

    const now = new Date().toISOString()

    const id = crypto.randomUUID()

    const proofPath = input.proofFile
      ? await dataAdapter.uploadSubscriptionProof(
          input.proofFile,
          input.restaurantId,
          id,
        )
      : null

    const request: SubscriptionRequest = {
      id,

      restaurant_id: input.restaurantId,

      requester_profile_id: auth.profileId,

      requested_plan: input.plan,

      payment_method: input.paymentMethod,

      payment_number: isFree ? "" : PAYMENT_ACCOUNT_NUMBER,

      payment_reference: input.paymentReference.trim(),

      amount: plan.price,

      proof_path: proofPath,

      status: "PENDING",

      reviewer_profile_id: null,

      reviewed_at: null,

      admin_notes: "",

      created_at: now,

      updated_at: now,
    }

    try {
      return await dataAdapter.createSubscriptionRequest(request)
    } catch (error) {
      if (proofPath) {
        try {
          await dataAdapter.deleteSubscriptionProof(proofPath)
        } catch (cleanupError) {
          const original =
            error instanceof Error ? error.message : String(error)

          const cleanup =
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError)

          throw new ValidationError(
            `Request submission failed: ${original}. Proof cleanup also failed: ${cleanup}`,
          )
        }
      }

      throw error
    }
  },
}
