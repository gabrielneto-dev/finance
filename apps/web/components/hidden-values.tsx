"use client";

import { createContext, useContext } from "react";
import { maskValue } from "@/lib/format";

export const HiddenValues = createContext(false);
export const HIDDEN_VALUES_KEY = "finance.hideValues";

export function useMaskValue() {
  const hidden = useContext(HiddenValues);
  return <T extends string | null | undefined>(value: T) => maskValue(hidden, value);
}
