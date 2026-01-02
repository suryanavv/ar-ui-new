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
import { decodeRefreshToken } from "../lib/jwt"

// Navigation items for admin and staff (full UI)
const adminNavItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: "IconDashboard",
    page: "dashboard"
  },
  {
    title: "AR Operations",
    url: "/ar-operations",
    icon: "IconFileUpload",
    page: "ar-operations"
  },
  {
    title: "Invoice List",
    url: "/invoice-list",
    icon: "IconFileText",
    page: "invoice-list"
  },
  {
    title: "Patients",
    url: "/patients",
    icon: "IconUsers",
    page: "patients"
  },
]

// Navigation items for super_admin (simplified UI)
const superAdminNavItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: "IconDashboard",
    page: "dashboard"
  },
  {
    title: "Patients",
    url: "/patients",
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
  userRole,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onPageChange?: (page: string) => void
  currentPage?: string
  onLogout?: () => void
  userData?: any
  userRole?: 'admin' | 'staff' | 'super_admin' | null
}) {
  // Select navigation items based on user role
  const navItems = React.useMemo(() => {
    if (userRole === 'super_admin') {
      return superAdminNavItems;
    }
    // For admin and staff, show full navigation
    return adminNavItems;
  }, [userRole]);

  const resolvedNavItems = React.useMemo(() => {
    return navItems.map(item => ({
      ...item,
      icon: iconMap[item.icon as keyof typeof iconMap]
    }))
  }, [navItems])

  const resolvedUser = React.useMemo(() => {
    // Decode refresh token to get user data
    const decodedToken = decodeRefreshToken();
    
    if (decodedToken) {
      return {
        name: decodedToken.full_name || 'User',
        email: decodedToken.sub || '',
        avatar: userData?.avatar || '',
        role: decodedToken.role || '',
        phone: userData?.phone_number || userData?.mobile_phone || userData?.phone || userData?.contact_number || ''
      }
    }
    
    // Fallback to userData if token decode fails
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
