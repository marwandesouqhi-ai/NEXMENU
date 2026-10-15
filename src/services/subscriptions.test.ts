import { beforeEach, describe, expect, it } from "vitest"

import { adminService } from "@admin/services/adminService"

import { dataAdapter } from "@/data"

import { ValidationError } from "@/lib/errors"

import { subscriptionService } from "@/services/subscriptions"

import { setupInMemoryDataAdapter } from "@/test/mock-adapter"

import type { Membership, Profile, Restaurant, Session } from "@/types/domain"

const now = "2026-01-01T00:00:00.000Z"

const restaurant: Restaurant = {
  id: "restaurant-payment",

  slug: "payment-cafe",

  name_en: "Payment Cafe",

  name_ar: "كافيه الدفع",

  description_en: "",

  description_ar: "",

  phone: "01000000000",

  whatsapp: "01000000000",

  address_en: "",

  address_ar: "",

  maps_url: "",

  website: "",

  instagram: "",

  facebook: "",

  cuisine_type: "Cafe",

  currency: "EGP",

  timezone: "Africa/Cairo",

  menu_status: "PUBLISHED",

  status: "ACTIVE",

  created_at: now,

  updated_at: now,
}

const owner: Profile = {
  id: "payment-owner",

  email: "owner@payment-cafe.test",

  name: "Cafe Owner",

  password_hash: "",

  password_salt: "",

  email_verified: true,

  created_at: now,

  updated_at: now,
}

const ownerSession: Session = {
  id: "session-owner",

  profile_id: owner.id,

  expires_at: "2999-01-01T00:00:00.000Z",
}

const adminSession: Session = {
  id: "session-admin",

  profile_id: "profile-admin",

  expires_at: "2999-01-01T00:00:00.000Z",
}

const ownerMembership: Membership = {
  id: "membership-owner",

  restaurant_id: restaurant.id,

  profile_id: owner.id,

  email: owner.email,

  role: "RESTAURANT_OWNER",

  status: "ACTIVE",

  created_at: now,

  updated_at: now,
}

describe("subscription requests and CRM review", () => {
  let store: ReturnType<typeof setupInMemoryDataAdapter>["store"]

  beforeEach(() => {
    store = setupInMemoryDataAdapter().store
  })

  it("stores payment details and proof for CRM, then approval activates the requested plan", async () => {
    store.profiles.push(owner)

    store.restaurants.push(restaurant)

    store.memberships.push(ownerMembership)

    const request = await subscriptionService.createRequest(ownerSession, {
      restaurantId: restaurant.id,

      plan: "PRO",

      paymentMethod: "INSTAPAY",

      paymentReference: "IP-20261015-1234",

      proofFile: new File(["receipt"], "receipt.png", { type: "image/png" }),
    })

    expect(request).toMatchObject({
      restaurant_id: restaurant.id,

      requester_profile_id: owner.id,

      requested_plan: "PRO",

      payment_method: "INSTAPAY",

      payment_number: "01060723106",

      payment_reference: "IP-20261015-1234",

      amount: 3000,

      status: "PENDING",
    })

    expect(request.proof_path).toContain(`${restaurant.id}/${request.id}/`)

    expect(dataAdapter.createSubscriptionRequest).toHaveBeenCalledOnce()

    const reviewed = await adminService.reviewSubscriptionRequest(
      adminSession,

      request.id,

      "APPROVED",

      "Payment verified",
    )

    expect(reviewed.status).toBe("APPROVED")

    expect(store.subscriptions).toContainEqual(
      expect.objectContaining({
        restaurant_id: restaurant.id,

        plan: "PRO",

        status: "ACTIVE",
      }),
    )

    expect(store.notifications).toContainEqual(
      expect.objectContaining({
        restaurant_id: restaurant.id,

        profile_id: owner.id,

        title: "Subscription request approved",
      }),
    )
  })

  it("requires payment proof before accepting a paid plan request", async () => {
    store.profiles.push(owner)

    store.restaurants.push(restaurant)

    store.memberships.push(ownerMembership)

    await expect(
      subscriptionService.createRequest(ownerSession, {
        restaurantId: restaurant.id,

        plan: "BASIC",

        paymentMethod: "VODAFONE_CASH",

        paymentReference: "",

        proofFile: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(dataAdapter.uploadSubscriptionProof).not.toHaveBeenCalled()
  })
})
