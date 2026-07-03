"use server";
import type { Plan } from "@/types";

export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string };

export async function createCheckoutSession(_plan: Plan): Promise<CheckoutResult> {
  return { success: false, error: "Checkout not configured yet." };
}
