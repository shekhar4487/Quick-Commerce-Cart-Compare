"use client";

import { useState } from "react";
import { BANKS } from "@/lib/platforms";
import type { Bank, UserCardInput } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  cards: UserCardInput[];
  onChange: (cards: UserCardInput[]) => void;
}

/** Step 1 — bank/card selection, migrated from the prototype. */
export function CardSetup({ cards, onChange }: Props) {
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  const addCard = (bank: Bank, cardName: string) => {
    if (!cards.some((c) => c.bankId === bank.id && c.cardName === cardName)) {
      onChange([...cards, { bankId: bank.id, bankName: bank.name, cardName }]);
    }
    setSelectedBank(null);
  };

  const removeCard = (bankId: string, cardName: string) => {
    onChange(cards.filter((c) => !(c.bankId === bankId && c.cardName === cardName)));
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="mb-1.5 text-[22px] font-bold tracking-tight">Aapke paas kaunse cards hain? 💳</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Bank aur app offers calculate karne ke liye yeh zaroori hai. Sirf aapke eligible offers dikhayenge.
        </p>
      </div>

      {cards.length > 0 && (
        <div className="mb-5">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-primary">
            Added Cards ({cards.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {cards.map((c) => (
              <div
                key={`${c.bankId}-${c.cardName}`}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px]"
              >
                <span className="text-foreground/70">
                  {c.bankName ?? BANKS.find((b) => b.id === c.bankId)?.name} {c.cardName}
                </span>
                <button
                  aria-label={`Remove ${c.cardName}`}
                  onClick={() => removeCard(c.bankId, c.cardName)}
                  className="leading-none text-destructive hover:opacity-80"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedBank ? (
        <div>
          <div className="mb-3 text-[13px] text-muted-foreground">Select your bank:</div>
          <div className="grid grid-cols-2 gap-2.5">
            {BANKS.map((bank) => (
              <button
                key={bank.id}
                onClick={() => setSelectedBank(bank)}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40"
              >
                <span className="text-sm font-medium">{bank.name}</span>
                <span className="text-muted-foreground/50">›</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-2.5 text-sm">
            <button onClick={() => setSelectedBank(null)} className="text-primary hover:opacity-80">
              ← Back
            </button>
            <span className="text-muted-foreground">{selectedBank.name} — Select card type</span>
          </div>
          <div className="flex flex-col gap-2">
            {selectedBank.cards.map((card) => {
              const already = cards.some((c) => c.bankId === selectedBank.id && c.cardName === card);
              return (
                <button
                  key={card}
                  disabled={already}
                  onClick={() => addCard(selectedBank, card)}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-4 py-3.5 text-left text-sm transition-colors",
                    already
                      ? "border-primary/30 bg-primary/5 cursor-default"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span>
                    {selectedBank.name} {card}
                  </span>
                  {already ? <span className="text-[13px] text-primary">✓ Added</span> : <span className="text-muted-foreground/50">+</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
