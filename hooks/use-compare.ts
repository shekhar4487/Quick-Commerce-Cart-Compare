"use client";

import { useState, useCallback } from "react";
import type { CompareResponse } from "@/types";

interface CompareState {
  loading: boolean;
  data: CompareResponse | null;
  error: string | null;
}

export function useCompare() {
  const [state, setState] = useState<CompareState>({ loading: false, data: null, error: null });

  const run = useCallback(async (text: string, listId?: string): Promise<CompareResponse | null> => {
    setState({ loading: true, data: null, error: null });
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, listId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ loading: false, data: null, error: body.error ?? "Comparison failed. Try again." });
        return null;
      }
      setState({ loading: false, data: body, error: null });
      return body as CompareResponse;
    } catch {
      setState({ loading: false, data: null, error: "Network error. Check your connection." });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ loading: false, data: null, error: null }), []);

  return { ...state, run, reset };
}
