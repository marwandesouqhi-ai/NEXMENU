import { ArrowRight, BarChart3, Check, Languages, QrCode, ScanLine, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { Brand } from "@/components/shared/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/app/i18n";
import { PLANS } from "@/config/plans";

export default function LandingPage() {
  const { locale, setLocale } = useI18n();
  return <div className="min-h-screen overflow-hidden bg-[var(--canvas)]">
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Brand />
      <nav className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Change language" onClick={() => setLocale(locale === "en" ? "ar" : "en")}><Languages className="size-5" /></Button>
        <Link to="/login"><Button variant="ghost">Log in</Button></Link>
        <Link to="/signup" className="hidden sm:block"><Button>Start free</Button></Link>
      </nav>
    </header>
    <main>
      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-32 lg:pt-24">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--accent-strong)]"><Sparkles className="size-3.5" /> Menus made beautifully simple</div>
          <h1 className="max-w-3xl text-balance text-5xl font-black leading-[.96] tracking-[-0.055em] text-[var(--ink)] sm:text-6xl lg:text-7xl">Your restaurant.<br /><span className="text-[var(--accent)]">Your menu.</span><br />One QR.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">Create a fast, premium digital menu that feels like your restaurant. Update it in seconds. Share it everywhere.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup"><Button size="lg" className="w-full sm:w-auto">Create your menu <ArrowRight className="size-4 rtl:rotate-180" /></Button></Link>
            <Link to="/r/cafe-moon"><Button size="lg" variant="secondary" className="w-full sm:w-auto">View live demo</Button></Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--ink-soft)]">{["No card required", "Works offline", "Arabic & English"].map((item) => <span key={item} className="flex items-center gap-2"><Check className="size-4 text-[var(--accent)]" />{item}</span>)}</div>
        </div>
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-20 -z-10 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="relative mx-auto aspect-[4/5] max-w-md rounded-[2.5rem] border-[10px] border-[var(--ink)] bg-[var(--surface)] p-3 shadow-2xl">
            <div className="h-full overflow-hidden rounded-[1.9rem] bg-[#f7f4ed]">
              <img src="/assets/cafe-cover.webp" alt="Cafe Moon menu preview" className="h-48 w-full object-cover" />
              <div className="p-5"><div className="-mt-11 mb-4 size-16 overflow-hidden rounded-2xl border-4 border-white bg-white"><img src="/assets/moon-logo.svg" alt="" className="size-full" /></div><p className="text-2xl font-black text-[#17221d]">Cafe Moon</p><p className="mt-1 text-sm text-[#5b665f]">Honest food. Slow mornings. Good company.</p><div className="mt-5 flex gap-2 overflow-hidden">{["Featured", "Burgers", "Pizza"].map((item, i) => <span key={item} className={i === 0 ? "rounded-full bg-[#176b4d] px-3 py-2 text-xs font-bold text-white" : "rounded-full bg-white px-3 py-2 text-xs font-bold text-[#17221d]"}>{item}</span>)}</div><div className="mt-5 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((item) => <div key={item} className="overflow-hidden rounded-2xl bg-white"><img src={`/assets/food-${item}.webp`} alt="" className="aspect-square w-full object-cover" /><div className="p-3"><div className="h-2 w-4/5 rounded bg-[#dfe5df]" /><div className="mt-2 h-2 w-1/2 rounded bg-[#176b4d]" /></div></div>)}</div></div>
            </div>
          </div>
          <div className="absolute -end-2 top-20 hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl sm:block"><QrCode className="size-20" /><p className="mt-2 text-center text-xs font-bold">SCAN MENU</p></div>
        </div>
      </section>
      <section className="bg-[var(--ink)] py-24 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent-bright)]">From table to menu</p><h2 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">Three steps. Zero friction.</h2></div><div className="mt-14 grid gap-5 md:grid-cols-3">{[
          [QrCode, "Create your menu", "Add dishes, prices, offers and your restaurant’s personality."],
          [ScanLine, "Place your QR", "Download a table-ready QR for every restaurant branch."],
          [BarChart3, "Keep it fresh", "Update instantly and learn what guests explore most."],
        ].map(([Icon, title, body], i) => { const Component = Icon as typeof QrCode; return <div key={String(title)} className="rounded-3xl border border-white/10 bg-white/5 p-7"><span className="mb-12 grid size-12 place-items-center rounded-2xl bg-white/10"><Component className="size-5 text-[var(--accent-bright)]" /></span><p className="text-xs font-bold text-white/50">0{i + 1}</p><h3 className="mt-2 text-xl font-bold">{String(title)}</h3><p className="mt-3 leading-7 text-white/60">{String(body)}</p></div>; })}</div></div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Simple plans</p><h2 className="mt-4 text-4xl font-black tracking-[-.04em]">Grow at your pace.</h2>      <p className="mt-3 text-[var(--ink-soft)]">Choose a plan, pay by transfer, and confirm the payment with WhatsApp verification.</p></div><div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.values(PLANS).map((plan) => <Card key={plan.code} className={plan.code === "PRO" ? "border-[var(--accent)] p-6 ring-2 ring-[var(--accent-soft)]" : "p-6"}><p className="text-xs font-extrabold tracking-[.15em] text-[var(--accent)]">{plan.code}</p><h3 className="mt-3 text-2xl font-black">{plan.name}</h3><p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">{plan.productLimit ? `Up to ${plan.productLimit} products` : "Unlimited products"} · {plan.branchLimit ? `${plan.branchLimit} branch${plan.branchLimit > 1 ? "es" : ""}` : "Unlimited branches"}</p><Link to="/signup" className="mt-7 block"><Button variant={plan.code === "PRO" ? "primary" : "secondary"} className="w-full">Choose plan</Button></Link></Card>)}</div></section>
    </main>
    <footer className="border-t border-[var(--line)] px-5 py-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-[var(--ink-soft)] sm:flex-row sm:items-center sm:justify-between"><Brand /><p>Digital menus only. No orders. No payments.</p><p>© {new Date().getFullYear()} NEXMENU</p></div></footer>
  </div>;
}
