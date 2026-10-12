import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@/types/domain";

const messages = {
  en: { open: "Open now", closed: "Closed", search: "Search the menu", featured: "Featured", popular: "Popular", unavailable: "Unavailable", menu: "Menu", contact: "Contact", viewDetails: "View details", offline: "You are offline. Showing the latest saved menu." },
  ar: { open: "مفتوح الآن", closed: "مغلق", search: "ابحث في القائمة", featured: "مميز", popular: "الأكثر طلباً", unavailable: "غير متاح", menu: "القائمة", contact: "تواصل", viewDetails: "عرض التفاصيل", offline: "أنت غير متصل. نعرض آخر قائمة محفوظة." },
} as const;
type MessageKey = keyof typeof messages.en;
interface I18nContextValue { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string }
const I18nContext = createContext<I18nContextValue | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (key: MessageKey) => messages[locale][key] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is missing.");
  return value;
}
