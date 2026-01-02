import { SidebarTrigger } from "./ui/sidebar"

// Page title mapping
const pageTitles = {
  dashboard: "Dashboard",
  "ar-operations": "AR Operations",
  upload: "AR Operations", // Backward compatibility
  "invoice-list": "Invoice List",
  patients: "Patients",
  users: "Users"
}

interface AppHeaderProps {
  currentPage?: string
}

export function AppHeader({ currentPage }: AppHeaderProps) {
  const getPageTitle = (page: string) => {
    return pageTitles[page as keyof typeof pageTitles] || "Dashboard"
  }

  return (
    <header className="app-header-sticky">
      <div className="app-header-inner">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 liquid-glass-btn w-9 h-9" />
          <span className="text-lg font-semibold text-foreground">
            {currentPage ? getPageTitle(currentPage) : "Dashboard"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Branding - Powered by EzMedTech */}
          <div className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt="EzMedTech Logo"
              className="w-6 h-6 object-contain rounded-full"
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium leading-tight text-foreground">
                Powered by
              </span>
              <span className="text-sm font-semibold text-foreground leading-tight">
                EzMedTech
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
