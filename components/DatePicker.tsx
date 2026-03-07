import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (date: string) => void;
  minDate?: string;
  placeholder?: string;
  className?: string;
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  placeholder = "Select a date",
  className = "",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<Date>(
    value ? new Date(value) : new Date()
  );
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isDateDisabled = (dateStr: string) => {
    if (!minDate) return false;
    return new Date(dateStr) < new Date(minDate);
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(
      displayMonth.getFullYear(),
      displayMonth.getMonth(),
      day
    );
    const dateString = selectedDate.toISOString().split("T")[0];

    if (!isDateDisabled(dateString)) {
      onChange(dateString);
      setIsOpen(false);
    }
  };

  const handlePrevMonth = () => {
    setDisplayMonth(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1)
    );
  };

  const handleNextMonth = () => {
    setDisplayMonth(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1)
    );
  };

  const daysInMonth = getDaysInMonth(displayMonth);
  const firstDayOfMonth = getFirstDayOfMonth(displayMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const monthYear = displayMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedDate = value ? formatDate(value) : "";

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      {/* Input Field */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-left flex items-center justify-between hover:border-gray-400 transition-colors"
      >
        <span className={selectedDate ? "text-gray-900" : "text-gray-500"}>
          {selectedDate || placeholder}
        </span>
        <svg
          className="w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          {/* Header with Month/Year and Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 min-w-48 text-center">
              {monthYear}
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold text-gray-600 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before month starts */}
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="text-center py-2" />
            ))}

            {/* Actual days */}
            {days.map((day) => {
              const dateStr = `${displayMonth.getFullYear()}-${String(
                displayMonth.getMonth() + 1
              ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const disabled = isDateDisabled(dateStr);
              const isSelected = value === dateStr;
              const isToday =
                dateStr ===
                new Date().toISOString().split("T")[0];

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  disabled={disabled}
                  className={`py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                    disabled
                      ? "text-gray-300 cursor-not-allowed"
                      : isSelected
                        ? "bg-blue-600 text-white"
                        : isToday
                          ? "bg-blue-100 text-blue-600"
                          : "text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              if (!isDateDisabled(today)) {
                onChange(today);
                setIsOpen(false);
              }
            }}
            className="w-full mt-4 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-medium transition-colors"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
