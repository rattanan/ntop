"use client";

import { Download, Printer } from "lucide-react";

function openPrintDialog(fileName:string){
  const previous=document.title;
  document.title=fileName;
  window.print();
  window.setTimeout(()=>{document.title=previous;},500);
}

export function QuoteDocumentActions({quoteNo}:{quoteNo:string}){
  return <div className="actions quote-document-actions">
    <button type="button" className="secondary" onClick={()=>openPrintDialog(quoteNo)}><Printer aria-hidden="true"/>Print</button>
    <button type="button" className="primary" onClick={()=>openPrintDialog(quoteNo)} title="เลือก Save as PDF ในหน้าต่างพิมพ์"><Download aria-hidden="true"/>ดาวน์โหลด PDF</button>
  </div>;
}
