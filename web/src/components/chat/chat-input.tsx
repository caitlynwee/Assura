"use client";

import { useState } from "react";
import { SendHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const t = useT().chat;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t.inputPlaceholder}
        disabled={disabled}
        rows={2}
        aria-label={t.inputLabel}
        className="min-h-0 flex-1 resize-none bg-card"
      />
      <Button type="submit" disabled={disabled || !value.trim()}>
        <SendHorizontalIcon />
        {t.send}
      </Button>
    </form>
  );
}
