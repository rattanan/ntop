import { ProspectForm } from "@/components/prospect-form";
import { requireSession } from "@/lib/auth";
import { loadCustomerClassifications } from "@/lib/customer/customer-classification";

export default async function NewProspectPage() {
  await requireSession();
  const classifications = await loadCustomerClassifications();
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Prospect Management</p>
          <h1>สร้าง Prospect</h1>
          <p>ระบบจะตรวจข้อมูลซ้ำก่อนบันทึก</p>
        </div>
      </div>
      <ProspectForm classifications={classifications} />
    </>
  );
}
