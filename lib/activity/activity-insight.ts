import { ActivityType } from "@prisma/client";

const meetingInsightActivityTypes = new Set<ActivityType>([
  ActivityType.CALL,
  ActivityType.PHONE_CALL,
  ActivityType.MEETING,
  ActivityType.SITE_VISIT,
  ActivityType.CUSTOMER_VISIT,
  ActivityType.ONLINE_MEETING,
  ActivityType.VIDEO_CONFERENCE,
]);

export function supportsMeetingInsight(type: ActivityType) {
  return meetingInsightActivityTypes.has(type);
}

export const MEETING_INSIGHT_ACTIVITY_TYPE_MESSAGE =
  "AI Meeting Insight ใช้ได้เฉพาะ Activity ประเภทโทรศัพท์ ประชุม หรือเข้าพบลูกค้า";
