"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Toggles the whole site between English and Simplified Chinese. */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      aria-label={t.common.switchToLabel}
      title={t.common.switchToLabel}
    >
      <LanguagesIcon />
      <span lang={locale === "en" ? "zh-CN" : "en"}>{t.common.switchTo}</span>
    </Button>
  );
}
