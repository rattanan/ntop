export function safeErrorIdentity(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const errorWithCode = error as Error & { code?: unknown; cause?: unknown };
  const cause = errorWithCode.cause;
  const causeWithCode = cause instanceof Error
    ? cause as Error & { code?: unknown }
    : undefined;
  return {
    name: error.name,
    ...(typeof errorWithCode.code === "string" ? { code: errorWithCode.code } : {}),
    ...(causeWithCode ? {
      cause: {
        name: causeWithCode.name,
        ...(typeof causeWithCode.code === "string" ? { code: causeWithCode.code } : {}),
      },
    } : {}),
  };
}
