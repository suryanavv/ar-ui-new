import { useState, useEffect } from "react"
import { IconCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type TimePickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedHour, setSelectedHour] = useState("09")
  const [selectedMinute, setSelectedMinute] = useState("00")
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("AM")

  // Parse initial value
  useEffect(() => {
    const timeMatch = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (timeMatch) {
      let h = parseInt(timeMatch[1])
      const m = timeMatch[2]
      const p = timeMatch[3].toUpperCase() as "AM" | "PM"

      // Convert to 12-hour format
      if (h === 0) h = 12
      else if (h > 12) h = h - 12

      setSelectedHour(h.toString().padStart(2, "0"))
      setSelectedMinute(m)
      setSelectedPeriod(p)
    }
  }, [value])

  const handleDone = () => {
    const formattedTime = `${selectedHour}:${selectedMinute} ${selectedPeriod}`
    onChange(formattedTime)
    setIsOpen(false)
  }

  const hours = Array.from({ length: 12 }, (_, i) =>
    (i + 1).toString().padStart(2, "0")
  )
  const minutes = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, "0")
  )
  const periods: Array<"AM" | "PM"> = ["AM", "PM"]

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          className={`w-28 justify-start text-left text-xs sm:text-sm font-medium neumorphic-pressed text-foreground hover:text-foreground-foreground rounded-lg shadow-none cursor-pointer transition-all duration-200 px-3 py-2 ${className || ""}`}
        >
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 sm:w-60 p-0 border-0 shadow-none neumorphic-pressed rounded-2xl"
        align="start"
      >
        <div className="p-4 space-y-2">
          <div className="flex justify-center gap-4 sm:gap-6">
            {/* Hour Section */}
            <div className="flex flex-col items-center">
              <div className="text-xs sm:text-sm font-medium text-foreground mb-2">
                Hour
              </div>
              <div className="w-12 sm:w-14 h-40 overflow-y-auto neumorphic-inset rounded-xl p-1 timepicker-scroll">
                <div className="py-0.5 space-y-1">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className={`w-fit text-xs font-medium neumorphic-pressed rounded-lg shadow-none cursor-pointer transition-all duration-200 px-3 py-2 mx-auto border ${selectedHour === hour
                          ? "border-primary text-foreground hover:text-foreground-foreground"
                          : "border-transparent text-foreground hover:text-foreground-foreground"
                        }`}
                      onClick={() => setSelectedHour(hour)}
                    >
                      {hour}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Minute Section */}
            <div className="flex flex-col items-center">
              <div className="text-xs sm:text-sm font-medium text-foreground mb-2">
                Min
              </div>
              <div className="w-12 sm:w-14 h-40 overflow-y-auto neumorphic-inset rounded-xl p-1 timepicker-scroll">
                <div className="py-0.5 space-y-1">
                  {minutes.map((minute) => (
                    <div
                      key={minute}
                      className={`w-fit text-xs font-medium neumorphic-pressed rounded-lg shadow-none cursor-pointer transition-all duration-200 px-3 py-2 mx-auto border ${selectedMinute === minute
                          ? "border-primary text-foreground hover:text-foreground-foreground"
                          : "border-transparent text-foreground hover:text-foreground-foreground"
                        }`}
                      onClick={() => setSelectedMinute(minute)}
                    >
                      {minute}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Period Section */}
            <div className="flex flex-col items-center">
              <div className="text-xs sm:text-sm font-medium text-foreground mb-2">
                Period
              </div>
              <div className="flex flex-col gap-1">
                {periods.map((period) => (
                  <div
                    key={period}
                    className={`w-fit text-xs font-medium neumorphic-pressed rounded-lg shadow-none cursor-pointer transition-all duration-200 px-3 py-2 mx-auto border ${selectedPeriod === period
                        ? "border-primary text-foreground hover:text-foreground-foreground"
                        : "border-transparent text-foreground hover:text-foreground-foreground"
                      }`}
                    onClick={() => setSelectedPeriod(period)}
                  >
                    {period}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Done Button */}
          <div className="flex justify-center border-t border-muted/30">
            <Button
              onClick={handleDone}
              className="neumorphic-button-primary"
            >
              <IconCheck className="w-3 h-3" />
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}


