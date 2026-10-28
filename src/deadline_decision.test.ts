import assert from "node:assert/strict";
import { decideDeadline } from "./deadline_decision.ts";

const now = new Date("2026-10-24T00:00:00Z");
assert.equal(decideDeadline({ learnerId: "l-7", courseId: "c-2", dueAt: "2026-10-25T12:00:00Z" }, now), "due-soon");
assert.equal(decideDeadline({ learnerId: "l-7", courseId: "c-2", dueAt: "2026-10-23T12:00:00Z" }, now), "overdue");
assert.equal(decideDeadline({ learnerId: "l-7", courseId: "c-2", dueAt: "2026-10-23T12:00:00Z", completedAt: "2026-10-23T10:00:00Z" }, now), "completed");
console.log("deadline decisions pass");
