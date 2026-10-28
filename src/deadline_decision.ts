export type LearnerDeadline = { learnerId: string; courseId: string; dueAt: string; completedAt?: string };

export function decideDeadline(item: LearnerDeadline, now: Date): "completed" | "overdue" | "due-soon" | "on-track" {
  if (item.completedAt) return "completed";
  const due = new Date(item.dueAt).getTime();
  const hours = (due - now.getTime()) / 3_600_000;
  if (hours < 0) return "overdue";
  if (hours <= 48) return "due-soon";
  return "on-track";
}
