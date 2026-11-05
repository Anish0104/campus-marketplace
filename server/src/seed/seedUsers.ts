import { User } from "../models/User";
import { hashPassword } from "../services/password";

export const SEEDED_USERS = [
  { name: "Krisha Borana", email: "krisha.borana@rutgers.edu" },
  { name: "Kunal Pasad", email: "kunal.pasad@rutgers.edu" },
  { name: "Anuj Bohra", email: "anuj.bohra@rutgers.edu" },
] as const;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

export async function seedUsers(password: string) {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES
  ) {
    throw new Error(`Seed password must be at least ${PASSWORD_MIN_LENGTH} characters and no more than ${PASSWORD_MAX_BYTES} bytes.`);
  }

  const passwordHash = await hashPassword(password);
  const result = await User.bulkWrite(
    SEEDED_USERS.map(({ name, email }) => ({
      updateOne: {
        filter: { email },
        update: {
          $set: { passwordHash },
          $setOnInsert: {
            name,
            email,
            role: "student",
            suspended: false,
          },
        },
        upsert: true,
      },
    })),
  );

  return { created: result.upsertedCount, updated: result.matchedCount };
}
