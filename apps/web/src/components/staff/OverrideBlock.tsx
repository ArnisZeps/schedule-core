import type { ScheduleOverride } from '@/hooks/useStaff'

const HOUR_PX = 38
const TOTAL_HEIGHT = HOUR_PX * 24

export type OverridePosition = 'single' | 'start' | 'middle' | 'end'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

interface OverrideBlockProps {
  override: ScheduleOverride
  position: OverridePosition
  onClick: (override: ScheduleOverride) => void
}

export function OverrideBlock({ override, position, onClick }: OverrideBlockProps) {
  const startMin = timeToMinutes(override.startTime)
  const endMin = timeToMinutes(override.endTime)

  let top: number
  let height: number

  switch (position) {
    case 'start':
      top = (startMin / 60) * HOUR_PX
      height = TOTAL_HEIGHT - top
      break
    case 'middle':
      top = 0
      height = TOTAL_HEIGHT
      break
    case 'end':
      top = 0
      height = Math.max(16, (endMin / 60) * HOUR_PX)
      break
    default: // 'single'
      top = (startMin / 60) * HOUR_PX
      height = Math.max(16, ((endMin - startMin) / 60) * HOUR_PX)
  }

  const colorClass =
    override.type === 'available'
      ? 'bg-green-200 border-green-400 text-green-900'
      : 'bg-red-200 border-red-400 text-red-900'

  return (
    <div
      data-testid={`override-block-${override.id}`}
      data-override-type={override.type}
      data-override-position={position}
      className={`absolute left-0.5 right-0.5 z-10 rounded border text-xs p-0.5 cursor-pointer overflow-hidden ${position === 'end' ? 'flex flex-col justify-end' : ''} ${colorClass}`}
      style={{ top, height }}
      onMouseDown={e => e.stopPropagation()}
      onClick={() => onClick(override)}
    >
      {position === 'single' && <span className="truncate">{override.startTime}–{override.endTime}</span>}
      {position === 'start' && <span className="truncate">{override.startTime} →</span>}
      {position === 'end' && <span className="truncate">→ {override.endTime}</span>}
    </div>
  )
}
