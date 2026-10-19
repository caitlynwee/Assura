import { cn } from "@/lib/utils";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

/** Labelled input with accessible error/hint wiring. */
export default function Field({ label, name, error, hint, className, ...props }: FieldProps) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          error ? "border-red-400" : "border-gray-300",
          className
        )}
        {...props}
      />
      {error ? (
        <p id={`${name}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
