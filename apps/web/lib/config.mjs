export const eventTypes = [
  "item/created", "item/updated", "item/error", "item/deleted",
  "item/waiting_user_input", "item/waiting_user_action",
  "transactions/created", "transactions/updated", "transactions/deleted",
];

export const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const sandbox = () => process.env.PLUGGY_SANDBOX !== "0";

export function existingItemId() {
  const id = process.env.PLUGGY_EXISTING_ITEM_ID?.trim();
  return id && uuid.test(id) ? id : null;
}

export function origin() {
  const url = new URL(process.env.APP_ORIGIN || "http://localhost:3000");
  return url.origin;
}
