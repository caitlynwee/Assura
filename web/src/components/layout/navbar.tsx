import Link from "next/link";
import { auth } from "@/lib/auth";
import Logo from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/i18n/language-switcher";

export default async function Navbar() {
  const session = await auth();
  const signedIn = !!session?.user;
  const t = (await getT()).layout.publicNav;

  return (
    <nav className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/#how-it-works">{t.howItWorks}</Link>
          </Button>
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/compare">{t.openApp}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t.signIn}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">{t.getStarted}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
