import { STAGES } from "../constants";

const standardWorkflowStages = STAGES.filter(([value]) => !["LOST", "CANCELLED", "EXPIRED"].includes(value));
const lostStage = STAGES.find(([value]) => value === "LOST");

export function getOpportunityWorkflowPathStages(stage: string) {
  if (stage !== "LOST" || !lostStage) return standardWorkflowStages;

  return standardWorkflowStages.map((item) => item[0] === "WON" ? lostStage : item);
}
