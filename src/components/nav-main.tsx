import { type Icon } from "@tabler/icons-react"
import { useState, useEffect, useRef } from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"

export function NavMain({
  items,
  onPageChange,
  currentPage,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    page?: string
  }[]
  onPageChange?: (page: string) => void
  currentPage?: string
}) {
  const [activeTabRect, setActiveTabRect] = useState<{ top: number; height: number } | null>(null)
  const menuRefs = useRef<(HTMLLIElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentPage) {
      const activeIndex = items.findIndex(item => item.page === currentPage)
      if (activeIndex !== -1 && menuRefs.current[activeIndex]) {
        const rect = menuRefs.current[activeIndex]?.getBoundingClientRect()
        const containerRect = containerRef.current?.getBoundingClientRect()
        if (rect && containerRect) {
          setActiveTabRect({
            top: rect.top - containerRect.top,
            height: rect.height,
          })
        }
      }
    }
  }, [currentPage, items])

  return (
    <SidebarGroup>
      <SidebarGroupContent ref={containerRef} className="flex flex-col gap-2 relative">
        <SidebarMenu>
          {items.map((item, index) => (
            <SidebarMenuItem key={item.title} ref={(el) => { menuRefs.current[index] = el; }}>
              <SidebarMenuButton
                tooltip={item.title}
                onClick={() => item.page && onPageChange?.(item.page)}
                isActive={currentPage === item.page}
                className="transition-colors"
              >
                {item.icon && <item.icon className="shrink-0" />}
                <span className="font-medium">{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

          {activeTabRect && (
          <div
              className="absolute left-0 right-0 bg-primary/20 rounded-sm pointer-events-none"
            style={{
                top: activeTabRect.top,
                height: activeTabRect.height,
              }}
            />
          )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
