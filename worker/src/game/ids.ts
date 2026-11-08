// Ids are 24 hex characters, laid out like Mongo ObjectIds
// (4-byte timestamp + 8 random bytes) so ids from the old database
// remain valid and sort roughly by creation time.

export const newId = (): string => {
  const seconds = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, "0");
  const random = new Uint8Array(8);
  crypto.getRandomValues(random);
  const randomHex = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");
  return seconds + randomHex;
};

export const isValidId = (id: unknown): id is string =>
  typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

export const areIdsEqual = (
  id1: string | null | undefined,
  id2: string | null | undefined
): boolean => {
  if (id1 && id2) {
    return String(id1).toLowerCase() === String(id2).toLowerCase();
  }
  return false;
};
