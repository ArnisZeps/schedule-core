import type { ScheduleOverride } from '@/hooks/useStaff'

const HOUR_PX = 64

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

interface OverrideBlockProps {
  override: ScheduleOverride
  onClick: (override: ScheduleOverride) => void
}

export function OverrideBlock({ override, onClick }: OverrideBlockProps) {
  const top = (timeToMinutes(override.startTime) / 60) * HOUR_PX
  const height = Math.max(
    16,
    ((timeToMinutes(override.endTime) - timeToMinutes(override.startTime)) / 60) * HOUR_PX,
  )

  const colorClass =
    override.type === 'available'
      ? 'bg-green-200 border-green-400 text-green-900'
      : 'bg-red-200 border-red-400 text-red-900'

  return (
    <div
      data-testid={`override-block-${override.id}`}
      data-override-type={override.type}
      className={`absolute left-0.5 right-0.5 z-10 rounded border text-xs p-0.5 cursor-pointer overflow-hidden ${colorClass}`}
      style={{ top, height }}
      onMouseDown={e => e.stopPropagation()}
      onClick={() => onClick(override)}
    >
      <span className="truncate">{override.startTime}–{override.endTime}</span>
    </div>
  )
}
