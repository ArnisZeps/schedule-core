import { describe, it, expect } from 'vitest'
import { clipOverrideWindow } from '@/lib/overrideClip'

describe('clipOverrideWindow', () => {
  it('single-day: returns startTime/endTime unchanged', () => {
    expect(
      clipOverrideWindow(
        { startDate: '2026-05-13', endDate: '2026-05-13', startTime: '09:00', endTime: '17:00' },
        '2026-05-13',
      ),
    ).toEqual({ startTime: '09:00', endTime: '17:00' })
  })

  it('first day of multi-day: returns startTime / 24:00', () => {
    expect(
      clipOverrideWindow(
        { startDate: '2026-05-11', endDate: '2026-05-14', startTime: '12:00', endTime: '17:00' },
        '2026-05-11',
      ),
    ).toEqual({ startTime: '12:00', endTime: '24:00' })
  })

  it('intermediate day: returns 00:00 / 24:00', () => {
    expect(
      clipOverrideWindow(
        { startDate: '2026-05-11', endDate: '2026-05-14', startTime: '12:00', endTime: '17:00' },
        '2026-05-12',
      ),
    ).toEqual({ startTime: '00:00', endTime: '24:00' })
  })

  it('last day of multi-day: returns 00:00 / endTime', () => {
    expect(
      clipOverrideWindow(
        { startDate: '2026-05-11', endDate: '2026-05-14', startTime: '12:00', endTime: '17:00' },
        '2026-05-14',
      ),
    ).toEqual({ startTime: '00:00', endTime: '17:00' })
  })

  it('overnight multi-day (startTime > endTime): clips each day correctly', () => {
    const ov = { startDate: '2026-05-11', endDate: '2026-05-12', startTime: '22:00', endTime: '06:00' }
    expect(clipOverrideWindow(ov, '2026-05-11')).toEqual({ startTime: '22:00', endTime: '24:00' })
    expect(clipOverrideWindow(ov, '2026-05-12')).toEqual({ startTime: '00:00', endTime: '06:00' })
  })
})
