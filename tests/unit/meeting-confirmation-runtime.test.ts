import { describe, expect, it } from "vitest";

import { createMeetingConfirmationRuntime } from "../../lib/ai/meeting-confirmation-runtime";
import { MeetingConfirmationService } from "../../lib/ai/meeting-confirmation-service";

describe("meeting confirmation runtime", () => {
  it("composes the transactional confirmation service", () => {
    expect(createMeetingConfirmationRuntime()).toBeInstanceOf(
      MeetingConfirmationService,
    );
  });
});
