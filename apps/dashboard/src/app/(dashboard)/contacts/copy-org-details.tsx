"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";

type Org = {
  name: string | null;
  address: string | null;
  fiscalCode: string | null;
  iban: string | null;
  bank: string | null;
  representative: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * These details are almost always wanted somewhere else — a chat, a contract,
 * an email — so they're laid out the way we already write them by hand.
 */
function asText(org: Org): string {
  const lines = [
    ["nume", org.name],
    ["adresa", org.address],
    ["cod fiscal", org.fiscalCode],
    ["cont IBAN", org.iban],
    ["banca", org.bank],
    ["reprezentant", org.representative],
  ]
    .filter(([, v]) => v)
    .map(([label, value]) => `${label}: ${value}`);

  const reach = [org.email, org.phone].filter(Boolean).join(" · ");
  if (reach) lines.push("", `Contact: ${reach}`);
  return lines.join("\n");
}

export function CopyOrgDetails({ org }: { org: Org }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(asText(org));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the details stay readable on screen.
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={handleCopy}
      className="h-9 px-3"
      title="Copy the details as text"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
