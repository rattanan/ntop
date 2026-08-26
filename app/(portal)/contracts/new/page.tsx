import Link from "next/link";

import { ContractCreateForm } from "@/components/contract-create-form";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { assertPermission, PERMISSIONS } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/number-format";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ quoteVersionId?: string }>;
}) {
  const session = await requireSession();
  assertPermission(session, PERMISSIONS.contractManage);
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const selectedId = (await searchParams).quoteVersionId;
  const [acceptedQuotes, types] = await Promise.all([
    prisma.quoteVersion.findMany({
      where: {
        status: "ACCEPTED",
        quote: { opportunity: buildOpportunityScopeWhere(authorization), internalOrder: null },
      },
      include: { quote: { include: { customer: { select: { name: true } } } }, items: true },
      orderBy: [{ acceptedAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
    prisma.contractTypeDefinition.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);
  const usedQuoteVersions = acceptedQuotes.length
    ? await prisma.contract.findMany({
        where: { quoteVersionId: { in: acceptedQuotes.map((quote) => quote.id) } },
        select: { quoteVersionId: true },
      })
    : [];
  const usedIds = new Set(usedQuoteVersions.map((contract) => contract.quoteVersionId));
  const quotes = acceptedQuotes.filter((quote) => !usedIds.has(quote.id));
  const quote = quotes.find((candidate) => candidate.id === selectedId);

  if (!quote) {
    return <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Contract Management</p>
          <h1>Create Contract</h1>
          <p>เลือก accepted quotation ที่อยู่ใน scope ของคุณและยังไม่มีสัญญา</p>
        </div>
        <Link className="secondary" href="/contracts">Back</Link>
      </div>
      <section className="card">
        <div className="card-body contract-quote-options">
          {quotes.map((candidate) => <Link key={candidate.id} href={`/contracts/new?quoteVersionId=${candidate.id}`}>
            <strong>{candidate.quote.quoteNo} · v{candidate.versionNumber}</strong>
            <span>{candidate.quote.customer.name}</span>
            <small>{formatMoney(candidate.total, candidate.currency)}</small>
          </Link>)}
          {!quotes.length && <div className="empty">ไม่มี Quote Version สถานะ ACCEPTED ที่ยังไม่ถูกสร้างสัญญา</div>}
        </div>
      </section>
    </>;
  }

  return <>
    <div className="page-head">
      <div>
        <p className="eyebrow">{quote.quote.quoteNo} · accepted version {quote.versionNumber}</p>
        <h1>Contract details</h1>
        <p>ตรวจ recurring, one-time, ระยะเวลา และส่วนลดก่อนบันทึก</p>
      </div>
      <Link className="secondary" href="/contracts/new">Change quote</Link>
    </div>
    <ContractCreateForm
      quote={{
        id: quote.id,
        customerName: quote.quote.customer.name,
        items: quote.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          discountAmount: item.discountAmount.toString(),
        })),
      }}
      types={types}
    />
  </>;
}
