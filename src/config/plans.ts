import type { PlanCode } from "@/types/domain";

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  price: number;
  productLimit: number | null;
  branchLimit: number | null;
  analytics: boolean;
  advancedBranding: boolean;
  hideBranding: boolean;
}
export const PLANS: Record<PlanCode, PlanDefinition> = {
  FREE: { code: "FREE", name: "Free", price: 0, productLimit: 30, branchLimit: 1, analytics: false, advancedBranding: false, hideBranding: false },
  BASIC: { code: "BASIC", name: "Basic", price: 1500, productLimit: 100, branchLimit: 1, analytics: true, advancedBranding: true, hideBranding: false },
  PRO: { code: "PRO", name: "Pro", price: 3000, productLimit: null, branchLimit: 5, analytics: true, advancedBranding: true, hideBranding: true },
  PREMIUM: { code: "PREMIUM", name: "Premium", price: 5000, productLimit: null, branchLimit: null, analytics: true, advancedBranding: true, hideBranding: true },
};
export const effectivePlan = (plan: PlanCode, expiresAt: string): PlanCode =>
  new Date(expiresAt).getTime() < Date.now() ? "FREE" : plan;
