export interface OverrideFields {
  startDate: string
  endDate: string
  startTime: string
  endTime: string
}

export function clipOverrideWindow(
  override: OverrideFields,
  date: string,
): { startTime: string; endTime: string } {
  if (override.startDate === override.endDate) {
    return { startTime: override.startTime, endTime: override.endTime }
  }
  if (date === override.startDate) {
    return { startTime: override.startTime, endTime: '24:00' }
  }
  if (date === override.endDate) {
    return { startTime: '00:00', endTime: override.endTime }
  }
  return { startTime: '00:00', endTime: '24:00' }
}
