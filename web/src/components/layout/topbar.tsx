"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LogOutIcon, MailIcon, ShieldCheckIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { logoutAction } from "@/app/_actions/auth";
import DeleteAccountDialog from "@/components/account/delete-account-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PublicUser } from "@/lib/types";

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function Topbar({ user }: { user: PublicUser }) {
  const premium = user.tier === "premium";
  const logoutForm = useRef<HTMLFormElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b bg-card px-6">
      {premium && user.maskedInbox && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="hidden gap-1.5 font-mono font-normal md:inline-flex">
              <MailIcon />
              {user.maskedInbox}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Insurers only ever see this relay address</TooltipContent>
        </Tooltip>
      )}

      {premium ? (
        <Badge variant="blue">Premium</Badge>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href="/upgrade">
            <SparklesIcon />
            Upgrade
          </Link>
        </Button>
      )}

      <form ref={logoutForm} action={logoutAction} className="hidden" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="Account menu">
            <Avatar className="size-7">
              <AvatarFallback className="bg-accent text-accent-foreground">
                {initials(user.name || user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
              {user.name || user.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={premium ? "/onboarding" : "/upgrade"}>
              <ShieldCheckIcon />
              Privacy &amp; consent
            </Link>
          </DropdownMenuItem>
          {!premium && (
            <DropdownMenuItem asChild>
              <Link href="/upgrade">
                <SparklesIcon />
                Upgrade to Premium
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logoutForm.current?.requestSubmit()}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2Icon />
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </header>
  );
}
