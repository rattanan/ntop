import { ProductForm } from "@/components/forms";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function NewProduct(){const s=await requireSession();if(s.role!=="ADMIN")redirect("/products");return <><div className="page-head"><div><p className="eyebrow">Product Catalog</p><h1>เพิ่มบริการใหม่</h1></div></div><ProductForm/></>}
