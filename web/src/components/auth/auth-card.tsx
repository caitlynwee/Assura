import { ShieldMark } from "@/components/brand/logo";

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <ShieldMark className="mx-auto h-10 w-10" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-gray-500">{footer}</div>}
      </div>
    </div>
  );
}
