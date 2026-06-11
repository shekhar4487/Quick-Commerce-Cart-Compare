"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CardSetup } from "./card-setup";
import { GroceryStep, type SavedList } from "./grocery-step";
import { ResultsStep } from "./results-step";
import { ResultsSkeleton } from "./results-skeleton";
import { Button } from "@/components/ui/button";
import { useCards } from "@/hooks/use-cards";
import { useCompare } from "@/hooks/use-compare";
import { cn } from "@/lib/utils";
import type { UserCardInput } from "@/types";

interface Props {
  initialCards: UserCardInput[];
  initialLists: SavedList[];
  plan: "FREE" | "PRO";
}

/**
 * The 3-step onboarding/compare flow from the prototype:
 *   1 → add bank cards   2 → grocery list   3 → results + open best app
 */
export function CompareWizard({ initialCards, initialLists, plan }: Props) {
  // Skip card setup for returning users who already saved cards.
  const [step, setStep] = useState(initialCards.length > 0 ? 2 : 1);
  const [groceryText, setGroceryText] = useState("");
  const [savedLists, setSavedLists] = useState(initialLists);
  const { cards, setCards, persist } = useCards(initialCards);
  const compare = useCompare();

  const continueFromCards = async () => {
    setStep(2);
    // Persist in the background; failure shouldn't block the flow.
    const ok = await persist(cards);
    if (!ok) toast.error("Could not save your cards — they'll apply for this session only.");
  };

  const runComparison = async () => {
    const result = await compare.run(groceryText);
    if (result) {
      setStep(3);
    } else if (compare.error) {
      toast.error(compare.error);
    }
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-end gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              s === step ? "w-6 bg-primary" : s < step ? "w-2 bg-primary/40" : "w-2 bg-muted"
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <div>
          <CardSetup cards={cards} onChange={setCards} />
          <Button className="mt-7 w-full" size="lg" disabled={cards.length === 0} onClick={continueFromCards}>
            {cards.length === 0
              ? "Add at least one card to continue"
              : `Continue with ${cards.length} card${cards.length > 1 ? "s" : ""} →`}
          </Button>
          {cards.length === 0 && (
            <button
              onClick={() => setStep(2)}
              className="mt-3 w-full text-center text-[13px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              Skip for now (only app offers will show)
            </button>
          )}
        </div>
      )}

      {step === 2 && !compare.loading && (
        <GroceryStep
          value={groceryText}
          onChange={setGroceryText}
          savedLists={savedLists}
          onListSaved={(l) => setSavedLists((prev) => [l, ...prev])}
          onBack={() => setStep(1)}
          onCompare={runComparison}
          comparing={compare.loading}
        />
      )}

      {compare.loading && <ResultsSkeleton />}

      {step === 3 && compare.data && !compare.loading && (
        <ResultsStep
          data={compare.data}
          groceryText={groceryText}
          plan={plan}
          onEditList={() => {
            compare.reset();
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
