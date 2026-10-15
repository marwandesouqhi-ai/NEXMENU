import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { DashboardDetails } from "../types";

export function TeamSection({ data }: { data: DashboardDetails }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"RESTAURANT_MANAGER" | "STAFF">("STAFF");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await restaurantService.invite(session!, data.restaurant!.id, email, role);
      setEmail("");
      setNotice("Invitation created");
      await client.invalidateQueries({ queryKey: ["restaurant", data.restaurant!.id] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add member.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_.5fr]">
      <div className="grid gap-3">
        {data.members.map((member) => (
          <Card key={member.id} className="flex items-center gap-4 p-4">
            <span className="grid size-11 place-items-center rounded-full bg-[var(--accent-soft)] font-black text-[var(--accent)]">
              {member.email[0].toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{member.email}</p>
              <p className="text-xs text-[var(--ink-soft)]">
                {member.role.replace("RESTAURANT_", "").replace("_", " ")}
              </p>
            </div>
            <Badge>{member.status}</Badge>
          </Card>
        ))}
      </div>
      <Card className="h-fit p-5">
        <h2 className="font-black">Add team member</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">
          Invite a manager (admin) or staff member to manage your restaurant.
        </p>
        <form onSubmit={(event) => void invite(event)} className="mt-5 grid gap-3">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="grid gap-1.5 text-xs font-bold text-[var(--ink)]">
            Role
            <select
              className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium"
              value={role}
              onChange={(e) => setRole(e.target.value as "RESTAURANT_MANAGER" | "STAFF")}
            >
              <option value="RESTAURANT_MANAGER">Manager / Admin (Full menu & settings)</option>
              <option value="STAFF">Staff (Menu stock & availability)</option>
            </select>
          </label>
          {notice && (
            <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {notice}
            </p>
          )}
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <Button type="submit">
            <Plus className="size-4" />
            Add member
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default TeamSection;
