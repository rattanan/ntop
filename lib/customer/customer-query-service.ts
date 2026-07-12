import type { Prisma } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export class CustomerQueryValidationError extends Error {
  constructor() {
    super("Customer query is invalid.");
    this.name = "CustomerQueryValidationError";
  }
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return undefined;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    if (!decoded || decoded.length > 191) throw new Error();
    return decoded;
  } catch {
    throw new CustomerQueryValidationError();
  }
}

export function encodeCustomerCursor(id: string) {
  return Buffer.from(id, "utf8").toString("base64url");
}

export function buildCustomerScopeWhere(
  context: AuthorizationContext,
): Prisma.CustomerWhereInput {
  if (
    context.assignments.some(
      (assignment) => assignment.scope === "ENTERPRISE",
    )
  ) {
    return {};
  }
  const organizationUnitIds = [
    ...new Set(
      context.assignments
        .filter(
          (assignment) =>
            (assignment.scope === "ORG_UNIT" ||
              assignment.scope === "TEAM") &&
            assignment.organizationUnitId,
        )
        .map((assignment) => assignment.organizationUnitId as string),
    ),
  ];
  return {
    OR: [
      { ownerId: context.actorId },
      ...(organizationUnitIds.length > 0
        ? [{ organizationUnitId: { in: organizationUnitIds } }]
        : []),
    ],
  };
}

export function buildCustomerFilterWhere(input: {
  query?: string;
  segment?: string;
}): Prisma.CustomerWhereInput {
  const query = input.query?.trim();
  if (query && query.length > 100) throw new CustomerQueryValidationError();
  const filters: Prisma.CustomerWhereInput[] = [];
  if (query) {
    filters.push({
      OR: /^\d{13}$/.test(query)
        ? [{ taxId: query }]
        : [
            { name: { startsWith: query } },
            { province: query },
          ],
    });
  }
  if (input.segment?.trim()) filters.push({ segment: input.segment.trim() });
  return filters.length > 0 ? { AND: filters } : {};
}

export async function listCustomers(
  context: AuthorizationContext,
  input: {
    query?: string;
    segment?: string;
    cursor?: string;
    pageSize?: number;
  },
) {
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new CustomerQueryValidationError();
  }
  const cursorId = decodeCursor(input.cursor);
  const records = await import("../prisma").then(({ prisma }) =>
    prisma.customer.findMany({
      where: {
        AND: [
          buildCustomerScopeWhere(context),
          buildCustomerFilterWhere(input),
        ],
      },
      select: {
        id: true,
        name: true,
        taxId: true,
        type: true,
        segment: true,
        province: true,
        status: true,
        owner: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take: pageSize + 1,
    }),
  );
  const hasNextPage = records.length > pageSize;
  const items = hasNextPage ? records.slice(0, pageSize) : records;
  return {
    items,
    nextCursor:
      hasNextPage && items.length > 0
        ? encodeCustomerCursor(items[items.length - 1].id)
        : null,
  };
}
