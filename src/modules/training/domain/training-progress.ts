export type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";

export function calculateAttendanceRate(presentSessions: number, recordedSessions: number): number | null {
  if (recordedSessions === 0) return null;
  return Math.round((presentSessions / recordedSessions) * 10_000) / 100;
}
