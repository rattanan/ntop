"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/action-types";
import { createContractAction } from "@/app/(portal)/contracts/actions";
import { FormNotice } from "@/components/notice";

type ContractQuote = {
  id: string;
  customerName: string;
  items: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    quantity: string;
    unitPrice: string;
    discountAmount: string;
  }>;
};

const initialState: FormState = {};

export function ContractCreateForm({
  quote,
  types,
}: {
  quote: ContractQuote;
  types: Array<{ code: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createContractAction, initialState);
  return <form action={action} className="card">
    <div className="card-body form-grid">
      <input type="hidden" name="quoteVersionId" value={quote.id} />
      <input type="hidden" name="itemCount" value={quote.items.length} />
      <label className="field">
        <span>Contract name</span>
        <input className="control" name="name" required defaultValue={`Contract for ${quote.customerName}`} maxLength={255} />
      </label>
      <label className="field">
        <span>Contract type</span>
        <select className="control" name="contractTypeCode" required defaultValue="">
          <option value="" disabled>เลือกประเภทสัญญา</option>
          {types.map((type) => <option key={type.code} value={type.code}>{type.name}</option>)}
        </select>
      </label>
      <label className="field"><span>Start date</span><input className="control" name="startDate" type="date" /></label>
      <label className="field"><span>End date</span><input className="control" name="endDate" type="date" /></label>
      <label className="field"><span>Payment term</span><input className="control" name="paymentTerm" maxLength={255} /></label>
      <label className="field"><span>Billing cycle</span><input className="control" name="billingCycle" placeholder="MONTHLY / QUARTERLY" maxLength={100} /></label>
      <label className="field"><span>Tax rate (%)</span><input className="control" name="taxRate" inputMode="decimal" defaultValue="7" required /></label>
    </div>
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Service</th><th>Qty</th><th>Monthly</th><th>One-time</th><th>Months</th><th>Discount</th></tr></thead>
        <tbody>{quote.items.map((item, index) => <tr key={item.id}>
          <td>
            <input type="hidden" name={`productId.${index}`} value={item.productId} />
            <input type="hidden" name={`productCode.${index}`} value={item.productCode} />
            <input type="hidden" name={`unit.${index}`} value="unit" />
            <input className="control" name={`serviceName.${index}`} defaultValue={item.productName} required />
          </td>
          <td><input className="control" name={`quantity.${index}`} inputMode="decimal" defaultValue={item.quantity} required /></td>
          <td><input className="control" name={`monthlyCharge.${index}`} inputMode="decimal" defaultValue="0" required /></td>
          <td><input className="control" name={`oneTimeCharge.${index}`} inputMode="decimal" defaultValue={item.unitPrice} required /></td>
          <td><input className="control" name={`durationMonths.${index}`} type="number" min="1" max="1200" defaultValue="12" required /></td>
          <td><input className="control" name={`discountAmount.${index}`} inputMode="decimal" defaultValue={item.discountAmount} required /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="card-body form-grid">
      <label className="field field-wide"><span>Terms</span><textarea className="control" name="terms" rows={6} /></label>
      <label className="field field-wide"><span>Remarks</span><textarea className="control" name="remarks" rows={3} /></label>
      <div className="field-wide"><FormNotice state={state} /></div>
      <div className="form-actions field-wide">
        <button className="primary" type="submit" disabled={pending || !types.length}>
          {pending ? "กำลังสร้างสัญญา…" : "Create immutable v1"}
        </button>
      </div>
    </div>
  </form>;
}
