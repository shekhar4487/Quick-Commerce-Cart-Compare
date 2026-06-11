"use client";

import { useCallback, useState } from "react";
import type { UserCardInput } from "@/types";

export function useCards(initial: UserCardInput[]) {
  const [cards, setCards] = useState<UserCardInput[]>(initial);
  const [saving, setSaving] = useState(false);

  /** Persists the full card set to the API (replace semantics). */
  const persist = useCallback(async (next: UserCardInput[]): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: next.map(({ bankId, cardName, cardType }) => ({
            bankId,
            cardName,
            cardType: cardType ?? (cardName.toLowerCase().includes("debit") ? "DEBIT" : "CREDIT"),
          })),
        }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { cards, setCards, persist, saving };
}
