/** The installed adapter maps SQLITE_BUSY to Prisma SocketTimeout/P1008. */
export function isSqliteContention(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    code?: unknown;
    message?: unknown;
    cause?: unknown;
    meta?: unknown;
  };
  if (
    typeof value.code === "string" &&
    (value.code.startsWith("SQLITE_BUSY") ||
      value.code.startsWith("SQLITE_LOCKED") ||
      ["P1008", "P2034"].includes(value.code))
  )
    return true;
  if (
    typeof value.message === "string" &&
    /SQLITE_BUSY|SQLITE_LOCKED|database (?:is )?(?:locked|busy)/i.test(
      value.message,
    )
  )
    return true;
  if (value.cause && value.cause !== error && isSqliteContention(value.cause))
    return true;
  const meta = value.meta as
    { driverAdapterError?: { cause?: { kind?: string } } } | undefined;
  return meta?.driverAdapterError?.cause?.kind === "SocketTimeout";
}
