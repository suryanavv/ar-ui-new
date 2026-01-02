import {
  IconDotsVertical,
  IconLogout,
  IconMail,
  IconPhone,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "./ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar"

export function NavUser({
  user,
  onLogout,
}: {
  user: {
    name: string
    email: string
    avatar: string
    role?: string
    phone?: string
  }
  onLogout?: () => void
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-primary/20 data-[state=open]:text-sidebar-accent-foreground bg-white/40 backdrop-blur-xl rounded-xl text-black border border-white/40 shadow-[0_4px_20px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.5)] hover:bg-white/60 transition-all"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                {/* <span className="truncate text-xs text-foreground/70" style={{ textTransform: 'none' }}>
                  {user.email || "null"}
                </span> */}
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-xl bg-white shadow-xl border border-gray-200"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-3 py-3 text-left text-sm bg-gray-50 rounded-t-lg border-b border-gray-100">
                <Avatar className="h-10 w-10 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-gray-900">{user.name}</span>
                  <span className="truncate text-xs flex items-center gap-1 text-gray-700" style={{ textTransform: 'none' }}>
                    <IconMail className="w-3 h-3" />
                    {user.email || "null"}
                  </span>
                  {/* {user.role && (
                    <span className="truncate text-xs flex items-center gap-1 text-gray-700">
                      {user.role}
                    </span>
                  )} */}
                  {user.phone && (
                    <span className="truncate text-xs flex items-center gap-1 text-gray-700">
                      <IconPhone className="w-3 h-3" />
                      {user.phone}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-2" />
            <DropdownMenuItem
              onClick={onLogout}
              className="w-full mx-auto liquid-glass-btn-primary cursor-pointer"
            >
              <IconLogout />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
