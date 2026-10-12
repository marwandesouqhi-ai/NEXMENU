import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ReorderableControlsProps {
  label: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isDragging?: boolean;
}

export function ReorderableControls({
  label,
  index,
  total,
  onMoveUp,
  onMoveDown,
  isDragging,
}: ReorderableControlsProps) {
  const isFirst = index === 0;
  const isLast = index >= total - 1;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <span
        aria-hidden="true"
        title="Drag to reorder"
        className={`cursor-grab active:cursor-grabbing p-1 text-[var(--ink-soft)] hover:text-[var(--ink)] ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <GripVertical className="size-4" />
      </span>

      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          aria-label={`Move ${label} up`}
          className="size-8"
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          aria-label={`Move ${label} down`}
          className="size-8"
        >
          <ArrowDown className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
