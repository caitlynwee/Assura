import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-blue-600">
          Fineprint
        </Link>
        <div className="flex items-center gap-4">
          <Link href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900">
            How it works
          </Link>
          <Link
            href="/login"
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
