import Link from "next/link";
import { auth } from "@/lib/auth";
import Logo from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default async function Navbar() {
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <nav className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/#how-it-works">How it works</Link>
          </Button>
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/compare">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
