export function getInsurerRecipientAddress(
  insurerId: string,
  configuredEmail: string,
): string {
  const email = configuredEmail.trim();
  if (email) return email;

  const slug = insurerId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug)
    throw new Error(
      "Cannot create a simulated email address for this insurer.",
    );
  return `insurer-${slug}@insurer.assura.local`;
}
