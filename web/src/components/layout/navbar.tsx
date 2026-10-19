import Link from "next/link";
import { auth } from "@/lib/auth";
import Logo from "@/components/brand/logo";

export default async function Navbar() {
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-4">
          <Link href="/#how-it-works" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">
            How it works
          </Link>
          {signedIn ? (
            <Link
              href="/compare"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white transition hover:bg-blue-700"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white transition hover:bg-blue-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
