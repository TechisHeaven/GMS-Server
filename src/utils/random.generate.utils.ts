import crypto from "crypto";

// Function to generate a random 6-character alphanumeric code
export const generateStoreCode = (): string => {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // Generates a 6-character code
};
