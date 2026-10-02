"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Building2, User, Layers, Home } from "lucide-react";
import { cn } from "@/lib/cn";
import { type WorkspaceKind } from "@/lib/mode";

interface WorkspaceOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface WorkspaceSwitcherProps {
  current: WorkspaceKind;
  options: WorkspaceOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function WorkspaceSwitcher({
  current,
  options,
  onChange,
  className,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentLabel = options.find((o) => o.value === workspaceToValue(current))?.label ?? "Workspace";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        if (listRef.current && !listRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="workspace-list"
        aria-label="Switch workspace"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium text-text",
          "rounded-input border border-border bg-surface",
          "hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgb(var(--c-focus-ring))]",
          "min-h-touch min-w-[180px] justify-between"
        )}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className={cn("h-4 w-4 flex-shrink-0 text-text-muted", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id="workspace-list"
          role="listbox"
          aria-label="Workspaces"
          className={cn(
            "absolute right-0 top-full z-50 mt-1 min-w-[200px] max-w-[320px]",
            "rounded-input border border-border bg-surface shadow-raised",
            "py-1 animate-slide-down"
          )}
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === workspaceToValue(current)}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text",
                  "hover:bg-surface-muted focus:outline-none focus:bg-surface-muted",
                  option.value === workspaceToValue(current) && "bg-accent-soft"
                )}
              >
                <span className="flex-shrink-0 h-5 w-5 text-text-muted" aria-hidden="true">
                  {option.icon}
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium truncate">{option.label}</div>
                  <div className="text-caption text-text-muted truncate">{option.description}</div>
                </div>
                {option.value === workspaceToValue(current) && (
                  <span className="sr-only">(current)</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function workspaceToValue(ws: WorkspaceKind): string {
  switch (ws.kind) {
    case "personal":
      return "personal";
    case "combined":
      return "combined";
    case "allBusinesses":
      return "allBusinesses";
    case "business":
      return `b:${ws.businessId}`;
  }
}