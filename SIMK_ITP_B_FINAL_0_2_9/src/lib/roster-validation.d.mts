export type RosterValidationInput = {
  course: string
  lecturer: string
  day: string
  start: string
  end: string
  room: string
}
export type ExistingRosterCourse = {
  name: string
  day: string
  start: string
  end: string
  room?: string
  lecturers?: string[]
}
export type GroupedRosterCourse = {
  course: string
  day: string
  start: string
  end: string
  room: string
  lecturers: string[]
}
export function validateAndGroupRoster(
  rows: RosterValidationInput[],
  existingCourses?: ExistingRosterCourse[],
): { ok: boolean; errors: string[]; courses: GroupedRosterCourse[] }
