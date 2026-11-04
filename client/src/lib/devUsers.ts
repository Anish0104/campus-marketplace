import type { User } from "./types";

/**
 * TEMPORARY test accounts, used until sign-in lands (Krisha).
 * The header lets you switch between them so two browser tabs can chat.
 * Set NEXT_PUBLIC_DEV_LOGIN=false to hide the switcher.
 */
export const DEV_USERS: User[] = [
  { id: "000000000000000000000001", name: "Anish Shirodkar" },
  { id: "000000000000000000000002", name: "Krisha Borana" },
  { id: "000000000000000000000003", name: "Anuj Bohra" },
];

export const DEV_LOGIN_ENABLED = process.env.NEXT_PUBLIC_DEV_LOGIN !== "false";

export function userName(id: string) {
  return DEV_USERS.find((u) => u.id === id)?.name ?? "Rutgers student";
}
