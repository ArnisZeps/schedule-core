import { NavLink } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function NavContent() {
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-4 border-b flex items-center">
        <span className="text-sm font-semibold text-foreground">ScheduleCore</span>
      </div>
      <nav className="p-2 flex-1">
        <NavLink
          to="/resources"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`
          }
        >
          <LayoutGrid className="size-4" />
          Resources
        </NavLink>
      </nav>
    </div>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      <aside className="hidden md:flex md:w-56 md:flex-col border-r bg-background">
        <NavContent />
      </aside>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-56 bg-background border-r flex flex-col">
            <NavContent />
          </aside>
        </>
      )}
    </>
  )
}
