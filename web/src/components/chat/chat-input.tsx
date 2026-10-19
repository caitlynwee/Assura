"use client";

import { useState } from "react";
import { SendHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");

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
        placeholder="Ask about plan coverage, premiums, exclusions…"
        disabled={disabled}
        rows={2}
        aria-label="Message"
        className="min-h-0 flex-1 resize-none bg-card"
      />
      <Button type="submit" disabled={disabled || !value.trim()}>
        <SendHorizontalIcon />
        Send
      </Button>
    </form>
  );
}
