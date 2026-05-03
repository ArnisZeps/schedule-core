const HOUR_PX = 64
const TOTAL_HEIGHT = HOUR_PX * 24

export function TimeGutter() {
  return (
    <div className="w-16 flex-shrink-0 relative" style={{ height: TOTAL_HEIGHT }}>
      {Array.from({ length: 24 }, (_, i) => (
        <div
          key={i}
          className="absolute right-2 text-xs text-muted-foreground leading-none select-none"
          style={{ top: i * HOUR_PX - 7 }}
        >
          {String(i).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  )
}
