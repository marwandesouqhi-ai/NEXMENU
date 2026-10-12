import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { I18nProvider } from "./i18n";
export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <QueryClientProvider client={client}><I18nProvider><AuthProvider>{children}</AuthProvider></I18nProvider></QueryClientProvider>;
}
