import { dataAdapter } from "@/data";
import type { Profile, Session } from "@/types/domain";

export type SafeProfile = Omit<Profile, "password_hash" | "password_salt">;
export const authService = {
  initialize: () => dataAdapter.initialize(),
  signIn: (email: string, password: string) => dataAdapter.signIn(email, password),
  signUp: (email: string, password: string, name: string) => dataAdapter.signUp({ email, password, name }),
  signOut: () => dataAdapter.signOut(),
  session: () => dataAdapter.getSession(),
  profile: async (session: Session | null): Promise<SafeProfile | null> => {
    if (!session) return null;
    const profile = await dataAdapter.getProfile(session.profile_id);
    if (!profile) return null;
    const { password_hash: _hash, password_salt: _salt, ...safe } = profile;
    return safe;
  },
  requestReset: (email: string) => dataAdapter.requestPasswordReset(email),
  resetPassword: (email: string, code: string, password: string) => dataAdapter.resetPassword(email, code, password),
};
