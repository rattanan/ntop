export type LegacyMeetingDraft = {
  summary: string;
  actionItems: string;
};

export function createLegacyMeetingDraft(notes: string): LegacyMeetingDraft {
  const sentences = notes.split(/(?<=[.!?\n])\s+/).filter(Boolean);
  const items = notes
    .split("\n")
    .map((value) => value.trim())
    .filter((value) =>
      /^(todo|action|ติดตาม|ดำเนินการ|ส่ง)/i.test(value),
    );

  return {
    summary:
      sentences.slice(0, 2).join(" ") || "รอรายละเอียดการประชุม",
    actionItems:
      items.join("\n") || "ยังไม่มี Action Item ที่ระบุ",
  };
}
