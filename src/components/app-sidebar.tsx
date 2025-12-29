import * as React from "react"
import {
  IconDashboard,
  IconFileUpload,
  IconFileText,
  IconUsers,
} from "@tabler/icons-react"

import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"

const navItems = [
  {
    title: "Dashboard",
    url: "#",
    icon: "IconDashboard",
    page: "dashboard"
  },
  {
    title: "AR Operations",
    url: "#",
    icon: "IconFileUpload",
    page: "ar-operations"
  },
  {
    title: "Invoice List",
    url: "#",
    icon: "IconFileText",
    page: "invoice-list"
  },
  {
    title: "Patients",
    url: "#",
    icon: "IconUsers",
    page: "patients"
  },
]

const iconMap = {
  IconDashboard,
  IconFileUpload,
  IconFileText,
  IconUsers,
}

export function AppSidebar({
  onPageChange,
  currentPage,
  onLogout,
  userData,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onPageChange?: (page: string) => void
  currentPage?: string
  onLogout?: () => void
  userData?: any
}) {
  const resolvedNavItems = React.useMemo(() => {
    return navItems.map(item => ({
      ...item,
      icon: iconMap[item.icon as keyof typeof iconMap]
    }))
  }, [])

  const resolvedUser = React.useMemo(() => {
    const fallbackName = 'User'
    const fullName = `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim()

    return {
      name: userData?.name || fullName || fallbackName,
      email: userData?.email || '',
      avatar: userData?.avatar || '',
      role: userData?.role || '',
      phone: userData?.phone_number || userData?.mobile_phone || userData?.phone || userData?.contact_number || ''
    }
  }, [userData])

  return (
    <Sidebar {...props}>
      <SidebarHeader className="-mb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-3 hover:bg-transparent focus:bg-transparent active:bg-transparent"
            >
              <a href="#" className="flex items-center -mt-2 gap-2 min-h-[3rem] text-black">
                <img src="/logo.svg" alt="EZMedTech Logo" className="w-7 h-7 object-contain rounded-full bg-white p-0.5 shadow-sm" />
                <div className="text-lg font-semibold flex-1 min-w-0 max-w-[12rem] !truncate-0 min-h-[2rem] flex flex-col justify-center text-black">EzMedTech</div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={resolvedNavItems}
          onPageChange={onPageChange}
          currentPage={currentPage}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={resolvedUser}
          onLogout={onLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
