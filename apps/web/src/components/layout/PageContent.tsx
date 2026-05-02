import { cn } from "@/lib/utils"

interface PageContentProps {
  children: React.ReactNode
  className?: string
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  )
}
