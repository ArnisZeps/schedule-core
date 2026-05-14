export function TimeGutter({ hourPx = 64 }: { hourPx?: number }) {
  const totalHeight = hourPx * 24
  return (
    <div className="w-16 flex-shrink-0 relative" style={{ height: totalHeight }}>
      {Array.from({ length: 24 }, (_, i) => (
        <div
          key={i}
          className="absolute right-2 text-xs text-muted-foreground leading-none select-none"
          style={{ top: Math.max(0, i * hourPx - 7) }}
        >
          {String(i).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  )
}
