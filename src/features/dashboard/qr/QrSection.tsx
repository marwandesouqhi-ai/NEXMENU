import { useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Printer, QrCode as QrIcon } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DashboardDetails } from "../types";

export function QrSection({ data }: { data: DashboardDetails }) {
  const { session } = useAuth();
  const [qr, setQr] = useState("");
  const [target, setTarget] = useState("");

  const generate = async (branchId?: string) => {
    const value = await restaurantService.qr(session!, data.restaurant!.id, branchId);
    setTarget(value.target_url);
    setQr(
      await QRCode.toDataURL(value.target_url, {
        width: 720,
        margin: 2,
        color: { dark: "#17221d", light: "#ffffff" },
      }),
    );
  };

  const download = () => {
    const anchor = document.createElement("a");
    anchor.href = qr;
    anchor.download = `${data.restaurant!.slug}-qr.png`;
    anchor.click();
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(target, {
      type: "svg",
      margin: 2,
      color: { dark: "#17221d", light: "#ffffff" },
    });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.restaurant!.slug}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <Card className="p-6">
        <p className="text-sm font-bold text-[var(--accent)]">MENU QR</p>
        <h2 className="mt-2 text-2xl font-black">One scan to your menu</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
          Generate a QR for your main menu or a branch. Every scan opens the public menu directly.
        </p>
        <div className="mt-6 grid gap-2">
          <Button onClick={() => void generate()}>
            <QrIcon className="size-4" />
            Generate main QR
          </Button>
          {data.branches.map((branch) => (
            <Button key={branch.id} variant="secondary" onClick={() => void generate(branch.id)}>
              {branch.name_en}
            </Button>
          ))}
        </div>
      </Card>
      <Card className="grid min-h-96 place-items-center p-6">
        {qr ? (
          <div className="w-full max-w-sm text-center">
            <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
              <img
                src={data.restaurant?.logo_url}
                alt=""
                className="mx-auto mb-3 size-12 rounded-xl"
              />
              <p className="font-black">{data.restaurant?.name_en}</p>
              <p className="mb-4 mt-1 text-xs text-[var(--ink-soft)]">Scan to view our menu</p>
              <img
                src={qr}
                alt="Restaurant menu QR"
                className="mx-auto aspect-square w-full max-w-64"
              />
              <p className="mt-3 text-xs font-black tracking-[.18em]">NEXMENU</p>
            </div>
            <p className="mt-4 truncate text-xs text-[var(--ink-soft)]">{target}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button onClick={download}>
                <Download className="size-4" />
                PNG
              </Button>
              <Button variant="secondary" onClick={() => void downloadSvg()}>
                <Download className="size-4" />
                SVG
              </Button>
              <Button
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(target)}
              >
                <Copy className="size-4" />
                Copy URL
              </Button>
              <Button variant="secondary" onClick={() => print()}>
                <Printer className="size-4" />
                Print
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center text-[var(--ink-soft)]">
            <QrIcon className="mx-auto size-10 opacity-30" />
            <p className="mt-3 text-sm">Generate a QR to preview it here.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export default QrSection;
