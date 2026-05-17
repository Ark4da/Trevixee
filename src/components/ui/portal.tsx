"use client";
import type React from "react";
import { createPortal } from "react-dom";

/**
 * Renders children directly into document.body via a React portal.
 * This ensures modals/overlays are never clipped by a parent stacking context
 * (e.g. elements with opacity/transform animations).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
