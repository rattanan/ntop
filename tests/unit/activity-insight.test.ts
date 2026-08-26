import { describe, expect, it } from "vitest";

import { supportsMeetingInsight } from "../../lib/activity/activity-insight";

describe("Activity Meeting Insight eligibility", () => {
  it.each(["CALL", "PHONE_CALL", "MEETING", "SITE_VISIT", "CUSTOMER_VISIT", "ONLINE_MEETING", "VIDEO_CONFERENCE"] as const)(
    "supports customer conversation type %s",
    (type) => expect(supportsMeetingInsight(type)).toBe(true),
  );

  it.each(["EMAIL", "LINE", "DEMO", "PRESENTATION", "NOTE", "FOLLOW_UP", "TASK", "DOCUMENT_REQUEST", "OTHER"] as const)(
    "rejects non-conversation type %s",
    (type) => expect(supportsMeetingInsight(type)).toBe(false),
  );
});
