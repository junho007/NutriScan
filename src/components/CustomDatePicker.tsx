import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  align?: "left" | "right";
}

export default function CustomDatePicker({
  value,
  onChange,
  align = "right",
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected date
  const [selectedYear, selectedMonth, selectedDay] = value.split("-").map(Number);

  // Display month & year in the calendar grid state
  const [displayMonth, setDisplayMonth] = useState(selectedMonth - 1); // 0-indexed
  const [displayYear, setDisplayYear] = useState(selectedYear);

  // Sync displayed month/year with value changes
  useEffect(() => {
    const [y, m] = value.split("-").map(Number);
    setDisplayMonth(m - 1);
    setDisplayYear(y);
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    onChange(todayStr);
    setIsOpen(false);
  };

  // Build calendar cell list
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDayIndex = new Date(displayYear, displayMonth, 1).getDay(); // 0 is Sunday
  const prevMonthDays = new Date(displayYear, displayMonth, 0).getDate();

  const cells: { day: number; isCurrentMonth: boolean; dateString: string }[] = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevMonth = displayMonth === 0 ? 11 : displayMonth - 1;
    const prevYear = displayMonth === 0 ? displayYear - 1 : displayYear;
    const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(prevMonthDays - i).padStart(2, "0")}`;
    cells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      dateString: dStr
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    cells.push({
      day: i,
      isCurrentMonth: true,
      dateString: dStr
    });
  }

  // Next month padding to fill grid (6 rows = 42 cells)
  const remainingCells = 42 - cells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonth = displayMonth === 11 ? 0 : displayMonth + 1;
    const nextYear = displayMonth === 11 ? displayYear + 1 : displayYear;
    const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    cells.push({
      day: i,
      isCurrentMonth: false,
      dateString: dStr
    });
  }

  // Format date beautiful string
  const formatTriggerLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = y === today.getFullYear() && (m - 1) === today.getMonth() && d === today.getDate();
    const isYesterday = y === yesterday.getFullYear() && (m - 1) === yesterday.getMonth() && d === yesterday.getDate();

    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const monthName = date.toLocaleDateString("en-US", { month: "short" });

    if (isToday) return `Today, ${monthName} ${d}`;
    if (isYesterday) return `Yesterday, ${monthName} ${d}`;
    return `${dayName}, ${monthName} ${d}`;
  };

  const isTodayDate = (dateStr: string) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return dateStr === `${y}-${m}-${d}`;
  };

  const alignmentClass = align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right";

  return (
    <div ref={containerRef} className="relative inline-block" id={`date-picker-${value}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-slate-150 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-black text-slate-800 shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
        <span className="font-semibold text-slate-700 tracking-tight">{formatTriggerLabel(value)}</span>
      </button>

      {isOpen && (
        <div className={`absolute ${alignmentClass} mt-2 z-50 w-72 rounded-[24px] border border-slate-100 bg-white p-4 shadow-xl ring-1 ring-black/5 animate-fade-in focus:outline-none`}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-600 rounded-lg transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-extrabold text-slate-800">
              {monthNames[displayMonth]} {displayYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-600 rounded-lg transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day} className="text-[10px] font-black uppercase text-slate-400">
                {day}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {cells.map((cell, idx) => {
              const isSelected = cell.dateString === value;
              const isToday = isTodayDate(cell.dateString);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(cell.dateString)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer relative flex items-center justify-center ${
                    !cell.isCurrentMonth
                      ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                      : isSelected
                      ? "bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-100"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span>{cell.day}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 bg-indigo-500 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer controls */}
          <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between items-center">
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 transition-all cursor-pointer px-2 py-1 rounded-md hover:bg-indigo-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all cursor-pointer px-2 py-1 rounded-md hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
