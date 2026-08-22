import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerForm } from "@/components/forms";
import { CustomerContactForm } from "@/components/customer-contact-form";
import { isAdmin, requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { getCustomer360 } from "@/lib/customer/prisma-customer-repository";
import { prisma } from "@/lib/prisma";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!permissionPolicy.allows(session, PERMISSIONS.recordUpdate)) notFound();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const { id } = await params;
  const customer = await getCustomer360(prisma, context, id);
  if (!customer || customer.mergedIntoCustomerId) notFound();

  const users = isAdmin(session.role)
    ? await prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })
    : [];
  const customerFormValue = {
    id: customer.id, version: customer.version, name: customer.name, taxId: customer.taxId,
    type: customer.type, segment: customer.segment, province: customer.province,
    status: customer.status, address: customer.address, ownerId: customer.ownerId,
    contacts: customer.contacts.map((contact) => ({
      id: contact.id, name: contact.name, title: contact.title, phone: contact.phone,
      email: contact.email, relationship: contact.relationship, purpose: contact.purpose,
      isPrimary: contact.isPrimary,
    })),
    externalIds: customer.externalIds.map((externalId) => ({
      sourceSystem: externalId.sourceSystem, externalId: externalId.externalId,
    })),
  };

  return <>
    <div className="page-head"><div>
      <Link className="back-link" href={`/customers/${id}`}><ArrowLeft aria-hidden="true" />กลับหน้ารายละเอียด</Link>
      <p className="eyebrow">Customer Management</p><h1>แก้ไข {customer.name}</h1>
    </div></div>
    <CustomerForm value={customerFormValue} users={users} role={session.role} />
    <section className="card compact-card" style={{ marginTop: 20 }}>
      <div className="card-header"><div><strong>จัดการ Contacts</strong><small>{customer.contacts.length} รายการ</small></div></div>
      <div className="card-body">
        {customer.contacts.map((contact) => <details className="contact-edit" key={contact.id}>
          <summary>แก้ไข {contact.name}</summary>
          <CustomerContactForm customerId={customer.id} customerVersion={customer.version} value={contact} />
        </details>)}
        <div className="contact-create">
          <h3>เพิ่ม Contact</h3>
          <CustomerContactForm customerId={customer.id} customerVersion={customer.version} />
        </div>
      </div>
    </section>
  </>;
}
