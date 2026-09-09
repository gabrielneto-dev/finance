function allowedPhones(): string[] {
  return (process.env.ALLOWED_PHONES ?? "")
    .split(",")
    .map((phone) => phone.replace(/\D/g, ""))
    .filter(Boolean);
}

export function isSenderAllowed(jid: string): boolean {
  const allowed = allowedPhones();
  if (allowed.length === 0) return false;
  const senderPhone = jid.split("@")[0].replace(/\D/g, "");
  return allowed.includes(senderPhone);
}
