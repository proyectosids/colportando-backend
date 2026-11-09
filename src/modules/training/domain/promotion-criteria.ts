export type PromotionCriteria = Readonly<{
  minimumPresentSessions?: number;
  minimumAttendanceRate?: number;
  requiredEvidenceCodes: readonly string[];
}>;

export type PromotionMetrics = Readonly<{ recordedSessions: number; presentSessions: number; attendanceRate: number | null }>;

export function evaluatePromotionCriteria(criteria: PromotionCriteria, metrics: PromotionMetrics, evidenceCodes: ReadonlySet<string>) {
  const checks = {
    minimumPresentSessions: criteria.minimumPresentSessions === undefined || metrics.presentSessions >= criteria.minimumPresentSessions,
    minimumAttendanceRate: criteria.minimumAttendanceRate === undefined || (metrics.attendanceRate !== null && metrics.attendanceRate >= criteria.minimumAttendanceRate),
    requiredEvidence: criteria.requiredEvidenceCodes.every((code) => evidenceCodes.has(code))
  };
  return { eligible: checks.minimumPresentSessions && checks.minimumAttendanceRate && checks.requiredEvidence, checks } as const;
}
