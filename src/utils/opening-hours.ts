import type { OpeningHours, Shift } from "@/types/domain";

const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};
function activeShift(shift: Shift, current: number, previousDay = false) {
  const start = minutes(shift.open);
  const end = minutes(shift.close);
  if (end > start) return !previousDay && current >= start && current < end;
  return previousDay ? current < end : current >= start;
}
export function isRestaurantOpen(hours: OpeningHours, timezone: string, at = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const day = parts.find((part) => part.type === "weekday")?.value.toLowerCase() ?? "sunday";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const current = hour * 60 + minute;
  const index = dayNames.indexOf(day);
  const previous = dayNames[(index + 6) % 7];
  const today = hours[day];
  const yesterday = hours[previous];
  if (!today?.closed && today.shifts.some((shift) => activeShift(shift, current))) return true;
  return Boolean(!yesterday?.closed && yesterday.shifts.some((shift) => activeShift(shift, current, true)));
}
