import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "neumorphic-toast",
          title: "neumorphic-toast-title",
          description: "neumorphic-toast-description",
          success: "neumorphic-toast-success",
          error: "neumorphic-toast-error",
          warning: "neumorphic-toast-warning",
          info: "neumorphic-toast-info",
          loading: "neumorphic-toast-loading",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }


