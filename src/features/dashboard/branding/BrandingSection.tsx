import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { evaluateContrast } from "@/utils/contrast";
import type { Branding } from "@/types/domain";

export function BrandingSection({ branding }: { branding?: Branding }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const [value, setValue] = useState(branding);

  if (!value) return <ErrorState body="Branding settings are missing." />;

  const textBgAudit = evaluateContrast(value.text_color, value.background_color, 4.5);
  const buttonAudit = evaluateContrast("#ffffff", value.primary_color, 4.5);
  const isBlocked = textBgAudit.isBlocked || buttonAudit.isBlocked;
  const hasWarning = !isBlocked && (!textBgAudit.passesNormalAa || !buttonAudit.passesNormalAa);

  const save = async () => {
    if (isBlocked) return;
    await restaurantService.saveBranding(session!, value);
    await client.invalidateQueries({ queryKey: ["restaurant", value.restaurant_id] });
  };

  return (
    <Card className="p-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-black">Make it unmistakably yours</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Templates only change presentation. Your menu data stays intact.
          </p>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold">
              Template
              <select
                value={value.template}
                onChange={(e) =>
                  setValue({ ...value, template: e.target.value as Branding["template"] })
                }
                className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3"
              >
                {["Modern", "Minimal", "Elegant", "Cafe", "Restaurant", "Fast Food"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Primary", "primary_color"],
                ["Background", "background_color"],
                ["Text", "text_color"],
                ["Secondary", "secondary_color"],
              ].map(([label, field]) => (
                <label key={field} className="grid gap-2 text-sm font-bold">
                  {label}
                  <input
                    type="color"
                    value={String(value[field as keyof Branding])}
                    onChange={(e) => setValue({ ...value, [field]: e.target.value })}
                    className="h-12 w-full rounded-xl border border-[var(--line)] bg-white p-1"
                  />
                </label>
              ))}
            </div>

            {/* Accessibility & Contrast (WCAG 2.1) Audit */}
            <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[var(--ink)]">WCAG 2.1 Contrast Audit</span>
                {isBlocked ? (
                  <Badge className="bg-rose-100 text-rose-800">Critical Fail (&lt; 3:1)</Badge>
                ) : hasWarning ? (
                  <Badge className="bg-amber-100 text-amber-800">Warning (AA Large)</Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800">AA Passed</Badge>
                )}
              </div>

              {/* Text / Background */}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                <div>
                  <p className="font-bold text-[var(--ink)]">Text on Background</p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Contrast: <span className="font-mono font-bold">{textBgAudit.formattedRatio}</span>
                  </p>
                </div>
                <Badge
                  className={
                    textBgAudit.passesNormalAa
                      ? "bg-emerald-100 text-emerald-800"
                      : textBgAudit.passesLargeAa
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                  }
                >
                  {textBgAudit.passesNormalAa
                    ? "Pass (4.5:1+)"
                    : textBgAudit.passesLargeAa
                      ? "Large Only (3:1+)"
                      : "Fail (< 3:1)"}
                </Badge>
              </div>
              {textBgAudit.suggestedAlternative && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--muted)] p-2.5 text-xs">
                  <span>
                    Suggested accessible text: <code className="font-mono font-bold">{textBgAudit.suggestedAlternative}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setValue({ ...value, text_color: textBgAudit.suggestedAlternative! })
                    }
                    className="rounded-lg bg-[var(--accent)] px-2.5 py-1 font-bold text-white hover:brightness-95"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Button (Primary) / White Text */}
              <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
                <div>
                  <p className="font-bold text-[var(--ink)]">Button (Primary) / Text</p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Contrast: <span className="font-mono font-bold">{buttonAudit.formattedRatio}</span>
                  </p>
                </div>
                <Badge
                  className={
                    buttonAudit.passesNormalAa
                      ? "bg-emerald-100 text-emerald-800"
                      : buttonAudit.passesLargeAa
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                  }
                >
                  {buttonAudit.passesNormalAa
                    ? "Pass (4.5:1+)"
                    : buttonAudit.passesLargeAa
                      ? "Large Only (3:1+)"
                      : "Fail (< 3:1)"}
                </Badge>
              </div>

              {/* Warnings and Block Notices */}
              {isBlocked && (
                <p className="mt-3 text-xs font-bold text-rose-600">
                  Saving is blocked: Contrast ratio is below 3.0:1. Text will be unreadable on mobile screens in sunlight. Please choose higher-contrast colors.
                </p>
              )}
              {hasWarning && (
                <p className="mt-3 text-xs font-medium text-amber-700">
                  Warning: Colors meet 3.0:1 minimum for large text, but fall short of 4.5:1 for standard menu descriptions.
                </p>
              )}
            </div>

            <Button onClick={() => void save()} disabled={isBlocked}>
              Save branding
            </Button>
          </div>
        </div>
        <div style={{ background: value.background_color, color: value.text_color }} className="min-h-96 rounded-3xl p-5">
          <div style={{ background: value.primary_color }} className="rounded-2xl p-6 text-white">
            <p className="text-xs font-bold opacity-70">{value.template.toUpperCase()}</p>
            <p className="mt-12 text-3xl font-black">Cafe Moon</p>
            <p className="mt-2 text-sm opacity-75">Your menu, beautifully yours.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[1, 2].map((item) => (
              <div key={item} className="rounded-2xl bg-white/70 p-3">
                <div className="aspect-square rounded-xl bg-black/10" />
                <p className="mt-3 font-bold">Menu item</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default BrandingSection;
