import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { LoadingState } from "@/components/ui/States";
import { AdminOnly, Protected } from "./guards";
import { IS_ADMIN_TARGET, IS_PUBLIC_TARGET } from "./target";

const Auth = lazy(() => import("@/pages/AuthPage"));
const ResetPassword = lazy(() => import("@/pages/ResetPasswordPage"));
const NotFound = lazy(() => import("@/pages/NotFoundPage"));

// Conditionally bind page components to enable compile-time dead-code elimination per build target
const Admin = !IS_PUBLIC_TARGET ? lazy(() => import("@/pages/AdminPage")) : null;
const CRMAdmin = !IS_PUBLIC_TARGET ? lazy(() => import("@/pages/CRMAdminPage")) : null;
const Landing = !IS_ADMIN_TARGET ? lazy(() => import("@/pages/LandingPage")) : null;
const PublicMenu = !IS_ADMIN_TARGET ? lazy(() => import("@/pages/PublicMenuPage")) : null;
const Dashboard = !IS_ADMIN_TARGET ? lazy(() => import("@/pages/DashboardPage")) : null;
const Onboarding = !IS_ADMIN_TARGET ? lazy(() => import("@/pages/OnboardingPage")) : null;
const DashboardLayout = !IS_ADMIN_TARGET ? lazy(() => import("@/layouts/DashboardLayout")) : null;

const wait = (node: React.ReactNode) => <Suspense fallback={<LoadingState />}>{node}</Suspense>;

export function createTargetRoutes(): RouteObject[] {
  if (IS_ADMIN_TARGET) {
    // Admin build: only /login (no signup), /reset-password, /admin; / redirects to /admin; everything else NotFound
    return [
      { path: "/", element: <Navigate to="/admin" replace /> },
      { path: "/login", element: wait(<Auth mode="login" />) },
      { path: "/reset-password", element: wait(<ResetPassword />) },
      { path: "/admin", element: <AdminOnly>{Admin ? wait(<Admin />) : null}</AdminOnly> },
      { path: "/crm-admin", element: <AdminOnly>{CRMAdmin ? wait(<CRMAdmin />) : null}</AdminOnly> },
      { path: "*", element: wait(<NotFound />) },
    ];
  }

  if (IS_PUBLIC_TARGET) {
    // Public build: all routes except /admin (AdminPage is completely tree-shaken)
    return [
      { path: "/", element: Landing ? wait(<Landing />) : null },
      { path: "/login", element: wait(<Auth mode="login" />) },
      { path: "/signup", element: wait(<Auth mode="signup" />) },
      { path: "/reset-password", element: wait(<ResetPassword />) },
      { path: "/onboarding", element: <Protected>{Onboarding ? wait(<Onboarding />) : null}</Protected> },
      { path: "/r/:restaurantSlug", element: PublicMenu ? wait(<PublicMenu />) : null },
      { path: "/r/:restaurantSlug/p/:productId", element: PublicMenu ? wait(<PublicMenu />) : null },
      {
        path: "/dashboard",
        element: <Protected>{DashboardLayout ? wait(<DashboardLayout />) : null}</Protected>,
        children: [
          { index: true, element: Dashboard ? wait(<Dashboard />) : null },
          { path: ":section", element: Dashboard ? wait(<Dashboard />) : null },
        ],
      },
      { path: "*", element: wait(<NotFound />) },
    ];
  }

  // All target: all routes enabled
  return [
    { path: "/", element: Landing ? wait(<Landing />) : null },
    { path: "/login", element: wait(<Auth mode="login" />) },
    { path: "/signup", element: wait(<Auth mode="signup" />) },
    { path: "/reset-password", element: wait(<ResetPassword />) },
    { path: "/onboarding", element: <Protected>{Onboarding ? wait(<Onboarding />) : null}</Protected> },
    { path: "/r/:restaurantSlug", element: PublicMenu ? wait(<PublicMenu />) : null },
    { path: "/r/:restaurantSlug/p/:productId", element: PublicMenu ? wait(<PublicMenu />) : null },
    {
      path: "/dashboard",
      element: <Protected>{DashboardLayout ? wait(<DashboardLayout />) : null}</Protected>,
      children: [
        { index: true, element: Dashboard ? wait(<Dashboard />) : null },
        { path: ":section", element: Dashboard ? wait(<Dashboard />) : null },
      ],
    },
    { path: "/admin", element: <AdminOnly>{Admin ? wait(<Admin />) : null}</AdminOnly> },
    { path: "/crm-admin", element: <AdminOnly>{CRMAdmin ? wait(<CRMAdmin />) : null}</AdminOnly> },
    { path: "*", element: wait(<NotFound />) },
  ];
}

export const router = createBrowserRouter(createTargetRoutes());
