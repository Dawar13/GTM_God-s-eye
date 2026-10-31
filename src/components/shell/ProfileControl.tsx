"use client";

import { useId, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { initials, MAX_NAME_LENGTH, NEW_PERSON_NAME, type Profile } from "@/lib/user";
import { useProfile } from "@/lib/user/use-profile";

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.625rem] font-semibold text-ink",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * The person's initials and name in the top bar, opening a popover to rename, switch, add or
 * remove people on this browser. Profiles keep settings apart; they are not passwords.
 */
export function ProfileControl() {
  const { active, profiles, needsName, create, rename, switchTo, remove } = useProfile();
  const nameId = useId();
  const addId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirming, setConfirming] = useState<Profile | null>(null);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    // Start from the saved name on open; drop half-finished add and remove prompts on close.
    setDraft(next ? (active?.name ?? "") : "");
    setAdding(false);
    setNewName("");
    setConfirming(null);
  };

  if (!active) {
    // Server render and first client render: same size, nothing personal.
    return <span aria-hidden className="inline-block h-8 w-9 md:w-24" />;
  }

  const others = profiles.filter((p) => p.id !== active.id);
  const commitName = () => {
    if (draft.trim() === active.name) return;
    if (!rename(active.id, draft)) setDraft(active.name);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={
            needsName
              ? `Profile: ${active.name}. Set your name`
              : `Profile: ${active.name}. Switch or edit`
          }
          className="h-8 max-w-44 gap-2 border-rule bg-panel text-ink-2 hover:text-ink"
        >
          <Avatar name={active.name} />
          <span className="hidden min-w-0 truncate md:inline">
            <span className="text-ink">{active.name}</span>
            {needsName && <span className="ml-1.5 text-xs text-muted">Set your name</span>}
          </span>
          {needsName && (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent md:hidden" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            Your name
          </label>
          <Input
            id={nameId}
            value={draft}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitName();
              }
            }}
            placeholder="Your name"
          />
        </div>

        {others.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xs font-medium text-muted">Other people on this browser</h2>
            <ul className="flex flex-col">
              {others.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      switchTo(p.id);
                      setOpen(false);
                    }}
                    className="h-8 min-w-0 flex-1 justify-start gap-2 text-ink"
                  >
                    <Avatar name={p.name} />
                    <span className="truncate">{p.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => setConfirming(p)}
                    className="size-8 shrink-0 text-muted hover:text-ink"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {confirming && (
          <div
            role="alertdialog"
            aria-label={`Remove ${confirming.name}`}
            className="rounded-lg border border-rule bg-panel-sunk p-2.5"
          >
            <p className="text-sm">
              Remove {confirming.name}? Their settings on this browser are deleted.
            </p>
            <div className="mt-2 flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                Keep
              </Button>
              <Button
                variant="outline"
                size="sm"
                autoFocus
                onClick={() => {
                  remove(confirming.id);
                  setConfirming(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        )}

        {adding ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              create(newName || NEW_PERSON_NAME);
              setOpen(false);
            }}
          >
            <label htmlFor={addId} className="sr-only">
              Name of the new person
            </label>
            <Input
              id={addId}
              autoFocus
              value={newName}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Their name"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Add this person">
              <Check aria-hidden />
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
            className="h-8 justify-start gap-2 text-ink"
          >
            <Plus aria-hidden />
            Add a person
          </Button>
        )}

        <p className="border-t border-rule pt-2 text-xs text-muted">
          Profiles keep each person&apos;s settings separate on this browser. They are not
          passwords; access is controlled by the deployment&apos;s sign-in. Saved work and history
          arrive in a later version.
        </p>
      </PopoverContent>
    </Popover>
  );
}
