import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldProps extends React.ComponentProps<typeof Input> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

/** shadcn Label + Input with accessible error/hint wiring. */
export default function Field({ label, name, error, hint, ...props }: FieldProps) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
