import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Form-level error shown under auth forms. */
export default function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" data-testid="form-error">
      <AlertCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
