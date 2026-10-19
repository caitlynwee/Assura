"use client";

import { useFormStatus } from "react-dom";
import Button from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & { pendingText?: string };

/** Submit button that shows a spinner while its parent <form> action runs. */
export default function SubmitButton({ children, pendingText, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
