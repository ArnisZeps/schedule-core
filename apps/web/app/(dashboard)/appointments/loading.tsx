export default function Loading() {
  return (
    <div
      className="-m-6 flex flex-col overflow-hidden animate-pulse"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0 flex-wrap">
        <div className="h-8 w-16 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-32 rounded-md bg-muted" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-8 w-24 rounded-md bg-muted" />
          <div className="h-8 w-36 rounded-md bg-muted" />
          <div className="h-8 w-32 rounded-md bg-muted" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Time gutter */}
        <div className="w-14 shrink-0 border-r">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 border-b flex items-start pt-1 px-2">
              <div className="h-3 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 overflow-x-auto">
          {Array.from({ length: 7 }).map((_, col) => (
            <div key={col} className="flex-1 min-w-[80px] border-r last:border-0">
              {/* Day header */}
              <div className="h-10 border-b flex flex-col items-center justify-center gap-1">
                <div className="h-3 w-6 rounded bg-muted" />
                <div className="h-4 w-4 rounded-full bg-muted" />
              </div>
              {/* Hour rows */}
              {Array.from({ length: 12 }).map((_, row) => (
                <div key={row} className="h-16 border-b last:border-0" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
