import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { LoadingState } from "@/components/ui/States";
import { AdminOnly, Protected } from "./guards";
import DashboardLayout from "@/layouts/DashboardLayout";

const Landing = lazy(() => import("@/pages/LandingPage"));
const Auth = lazy(() => import("@/pages/AuthPage"));
const ResetPassword = lazy(() => import("@/pages/ResetPasswordPage"));
const PublicMenu = lazy(() => import("@/pages/PublicMenuPage"));
const Dashboard = lazy(() => import("@/pages/DashboardPage"));
const Onboarding = lazy(() => import("@/pages/OnboardingPage"));
const Admin = lazy(() => import("@/pages/AdminPage"));
const NotFound = lazy(() => import("@/pages/NotFoundPage"));
const wait = (node: React.ReactNode) => <Suspense fallback={<LoadingState />}>{node}</Suspense>;
export const router = createBrowserRouter([
  { path: "/", element: wait(<Landing />) },
  { path: "/login", element: wait(<Auth mode="login" />) },
  { path: "/signup", element: wait(<Auth mode="signup" />) },
  { path: "/reset-password", element: wait(<ResetPassword />) },
  { path: "/onboarding", element: <Protected>{wait(<Onboarding />)}</Protected> },
  { path: "/r/:restaurantSlug", element: wait(<PublicMenu />) },
  { path: "/r/:restaurantSlug/p/:productId", element: wait(<PublicMenu />) },
  { path: "/dashboard", element: <Protected><DashboardLayout /></Protected>, children: [
    { index: true, element: wait(<Dashboard />) },
    { path: ":section", element: wait(<Dashboard />) },
  ] },
  { path: "/admin", element: <AdminOnly>{wait(<Admin />)}</AdminOnly> },
  { path: "*", element: wait(<NotFound />) },
]);
