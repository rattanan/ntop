export type DealRiskRefreshFeedback = {
  message: string;
  status: "success" | "warning";
};

export function buildDealRiskRefreshFeedback({
  evaluatedRuleCount,
  signalCount,
}: {
  evaluatedRuleCount: number;
  signalCount: number;
}): DealRiskRefreshFeedback {
  if (evaluatedRuleCount === 0) {
    return {
      message:
        "ยังไม่มี Risk Rule ที่เปิดใช้งาน จึงไม่สามารถสร้าง Risk Signal ได้ กรุณาให้ผู้ดูแลระบบตั้งค่า Risk Rules",
      status: "warning",
    };
  }

  if (signalCount === 0) {
    return {
      message: `ประเมิน Risk Rule ${evaluatedRuleCount} กฎแล้ว ไม่พบความเสี่ยงที่เข้าเงื่อนไข`,
      status: "success",
    };
  }

  return {
    message: `ประเมิน Risk Rule ${evaluatedRuleCount} กฎแล้ว พบ Risk Signal ${signalCount} รายการ`,
    status: "success",
  };
}
