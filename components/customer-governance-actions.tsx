"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/action-types";
import {
  addCustomerRelationship,
  mergeCustomer,
} from "@/app/actions/customer";
import { FormNotice } from "./notice";

const initial: FormState = {};

export function CustomerGovernanceActions({
  customerId,
  customers,
  canMerge,
}: {
  customerId: string;
  customers: Array<{ id: string; name: string }>;
  canMerge: boolean;
}) {
  const [relationshipState, relationshipAction, relationshipPending] =
    useActionState(addCustomerRelationship, initial);
  const [mergeState, mergeAction, mergePending] = useActionState(
    mergeCustomer,
    initial,
  );
  return (
    <div className="governance-actions">
      <form action={relationshipAction} className="card compact-card governance-form">
        <div className="card-header"><div><strong>เพิ่ม Customer hierarchy</strong><small>กำหนด Customer ปัจจุบันเป็น Parent</small></div></div>
        <div className="card-body">
          <input type="hidden" name="parentCustomerId" value={customerId} />
          <label className="field">
            <span>Child customer</span>
            <select className="control" name="childCustomerId" required defaultValue="">
              <option value="" disabled>เลือกลูกค้า</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label className="field governance-field">
            <span>Relationship type</span>
            <input className="control" name="relationshipType" required maxLength={100} />
          </label>
          <FormNotice state={relationshipState}/>
          <button className="secondary governance-submit" disabled={relationshipPending}>
            {relationshipPending ? "กำลังบันทึก…" : "เพิ่มความสัมพันธ์"}
          </button>
        </div>
      </form>
      {canMerge && (
        <form action={mergeAction} className="card compact-card governance-form merge-form">
          <div className="card-header"><div><strong>Merge duplicate customer</strong><small>Source จะถูกเก็บเป็น alias และมี audit history</small></div></div>
          <div className="card-body">
            <input type="hidden" name="targetCustomerId" value={customerId} />
            <label className="field">
              <span>Source customer (เก็บเป็น alias)</span>
              <select className="control" name="sourceCustomerId" required defaultValue="">
                <option value="" disabled>เลือกลูกค้าที่จะ merge</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label className="field governance-field">
              <span>เหตุผล</span>
              <textarea className="control" name="reason" required minLength={3} rows={3} />
            </label>
            <FormNotice state={mergeState}/>
            <button className="primary governance-submit" disabled={mergePending}>
              {mergePending ? "กำลัง Merge…" : "ยืนยัน Merge"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
