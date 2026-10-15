import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ResetPasswordPage from "./ResetPasswordPage";
import { setupInMemoryDataAdapter } from "@/test/mock-adapter";
import { authService } from "@/services/auth";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("ResetPasswordPage Component", () => {
  let mockAdapter: ReturnType<typeof setupInMemoryDataAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    window.location.hash = "";
    mockAdapter = setupInMemoryDataAdapter();
  });

  describe("Local Mode Flow", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_DATA_ADAPTER", "local");
    });

    it("renders DEVELOPMENT MODE badge and unchanged dev-code flow", async () => {
      mockAdapter.store.profiles.push({
        id: "p-local",
        email: "owner@cafemoon.local",
        name: "Cafe Owner",
        password_hash: "hash",
        password_salt: "salt",
        email_verified: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });

      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      expect(screen.getByText("DEVELOPMENT MODE")).toBeInTheDocument();
      expect(screen.getByText("Reset local password")).toBeInTheDocument();
      expect(screen.getByText("No email is sent in local mode. A one-time code is displayed here.")).toBeInTheDocument();

      const emailInput = screen.getByLabelText("Account email");
      fireEvent.change(emailInput, { target: { value: "owner@cafemoon.local" } });

      const requestBtn = screen.getByRole("button", { name: "Create development code" });
      fireEvent.click(requestBtn);

      await waitFor(() => {
        expect(screen.getByText("ONE-TIME DEVELOPMENT CODE")).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText("Code");
      const passwordInput = screen.getByLabelText("New password");

      fireEvent.change(codeInput, { target: { value: "123456" } });
      fireEvent.change(passwordInput, { target: { value: "NewMoon@1234" } });

      const resetBtn = screen.getByRole("button", { name: "Reset password" });
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/login");
      });
    });
  });

  describe("Cloud Mode Flow", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_DATA_ADAPTER", "supabase");
    });

    it("never renders DEVELOPMENT MODE or dev-code UI in cloud mode", () => {
      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      expect(screen.queryByText("DEVELOPMENT MODE")).not.toBeInTheDocument();
      expect(screen.queryByText("ONE-TIME DEVELOPMENT CODE")).not.toBeInTheDocument();
      expect(screen.queryByText("Create development code")).not.toBeInTheDocument();
      expect(screen.getByText("Reset your password")).toBeInTheDocument();
    });

    it("step 1: sends request, displays neutral feedback, and disables button briefly for rate limiting", async () => {
      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      const emailInput = screen.getByLabelText("Email address");
      fireEvent.change(emailInput, { target: { value: "clouduser@example.com" } });

      const submitBtn = screen.getByRole("button", { name: "Send reset link" });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          "If an account exists for this email, you will receive password reset instructions.",
        );
      });

      // Rate limiting: button becomes disabled with countdown
      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByRole("button")).toHaveTextContent(/Resend link/);
    });

    it("step 2: detects recovery session and shows new password form", async () => {
      window.location.hash = "#type=recovery&access_token=token-abc";
      mockAdapter.setCurrentSession({
        id: "sess-recov",
        profile_id: "user-1",
        expires_at: "2099-01-01T00:00:00Z",
      });

      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      // Trigger recovery auth event
      act(() => {
        mockAdapter.triggerAuthEvent("PASSWORD_RECOVERY", {
          id: "sess-recov",
          profile_id: "user-1",
          expires_at: "2099-01-01T00:00:00Z",
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Set new password")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("New password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
      expect(screen.queryByText("DEVELOPMENT MODE")).not.toBeInTheDocument();
    });

    it("step 2: validates password length and matching check", async () => {
      window.location.hash = "#type=recovery&access_token=token-abc";
      mockAdapter.setCurrentSession({
        id: "sess-recov",
        profile_id: "user-1",
        expires_at: "2099-01-01T00:00:00Z",
      });

      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      act(() => {
        mockAdapter.triggerAuthEvent("PASSWORD_RECOVERY");
      });

      await waitFor(() => {
        expect(screen.getByText("Set new password")).toBeInTheDocument();
      });

      const newPass = screen.getByLabelText("New password");
      const confirmPass = screen.getByLabelText("Confirm new password");
      const updateBtn = screen.getByRole("button", { name: "Update password" });

      // Test short password
      fireEvent.change(newPass, { target: { value: "short" } });
      fireEvent.change(confirmPass, { target: { value: "short" } });
      fireEvent.click(updateBtn);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Password must be at least 8 characters.");
      });

      // Test mismatching password
      fireEvent.change(newPass, { target: { value: "validpassword123" } });
      fireEvent.change(confirmPass, { target: { value: "differentpassword123" } });
      fireEvent.click(updateBtn);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
      });
    });

    it("step 2: on successful submit calls updatePassword and signOut, navigating to /login with state", async () => {
      const updatePasswordSpy = vi.spyOn(authService, "updatePassword").mockResolvedValue(undefined);
      const signOutSpy = vi.spyOn(authService, "signOut").mockResolvedValue(undefined);

      window.location.hash = "#type=recovery&access_token=token-abc";
      mockAdapter.setCurrentSession({
        id: "sess-recov",
        profile_id: "user-1",
        expires_at: "2099-01-01T00:00:00Z",
      });

      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      act(() => {
        mockAdapter.triggerAuthEvent("PASSWORD_RECOVERY");
      });

      await waitFor(() => {
        expect(screen.getByText("Set new password")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("New password"), { target: { value: "StrongPass#2026" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "StrongPass#2026" } });

      fireEvent.click(screen.getByRole("button", { name: "Update password" }));

      await waitFor(() => {
        expect(updatePasswordSpy).toHaveBeenCalledWith("StrongPass#2026");
        expect(signOutSpy).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/login", {
          state: { notice: "Password reset successfully. Please sign in with your new password." },
          replace: true,
        });
      });
    });

    it("step 3: detects expired or invalid link and provides recovery action", async () => {
      window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Reset link expired or invalid")).toBeInTheDocument();
        expect(screen.getByText("This password reset link is invalid or has expired. Please request a new link.")).toBeInTheDocument();
      });

      const requestNewBtn = screen.getByRole("button", { name: "Request a new link" });
      fireEvent.click(requestNewBtn);

      await waitFor(() => {
        expect(screen.getByText("Reset your password")).toBeInTheDocument();
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
      });
    });
  });
});
