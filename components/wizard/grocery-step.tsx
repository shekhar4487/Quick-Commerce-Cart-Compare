"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookmarkPlus, Loader2 } from "lucide-react";

export interface SavedList {
  id: string;
  name: string;
  items: string[];
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  savedLists: SavedList[];
  onListSaved: (list: SavedList) => void;
  onBack: () => void;
  onCompare: () => void;
  comparing: boolean;
}

/** Step 2 — grocery list entry (+ saved lists), migrated from the prototype. */
export function GroceryStep({ value, onChange, savedLists, onListSaved, onBack, onCompare, comparing }: Props) {
  const [savingName, setSavingName] = useState<string | null>(null);

  const saveList = async () => {
    const items = value.split("\n").map((l) => l.trim()).filter(Boolean);
    if (items.length === 0 || !savingName?.trim()) return;
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: savingName.trim(), items }),
    });
    if (res.ok) {
      const list = await res.json();
      onListSaved({ id: list.id, name: list.name, items });
      setSavingName(null);
      toast.success(`List "${list.name}" saved`);
    } else {
      toast.error((await res.json()).error ?? "Could not save the list.");
    }
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="mb-1.5 text-[22px] font-bold tracking-tight">Kya kya lena hai? 🥦</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ek item per line likho. Quantity bhi likh sakte ho (e.g. &quot;Milk 1L x2&quot;).
        </p>
      </div>

      {savedLists.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {savedLists.map((l) => (
            <button
              key={l.id}
              onClick={() => onChange(l.items.join("\n"))}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-foreground/70 transition-colors hover:border-primary/40"
            >
              📋 {l.name}
            </button>
          ))}
        </div>
      )}

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"Amul Butter 500g\nTata Salt 1kg\nAashirvaad Atta 5kg\nMilk 1L x2\nOnion 1kg"}
      />

      <div className="mt-3.5">
        {savingName === null ? (
          <button
            onClick={() => value.trim() && setSavingName("")}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
          >
            <BookmarkPlus className="h-3.5 w-3.5" /> Save this list for reuse
          </button>
        ) : (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="List name (e.g. Weekly groceries)"
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveList()}
              className="h-10"
            />
            <Button size="sm" className="h-10" onClick={saveList} disabled={!savingName.trim()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-10" onClick={() => setSavingName(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2.5">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={comparing}>
          ← Back
        </Button>
        <Button className="flex-[3]" onClick={onCompare} disabled={!value.trim() || comparing}>
          {comparing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Comparing live prices…
            </>
          ) : (
            "Compare Prices →"
          )}
        </Button>
      </div>
    </div>
  );
}
