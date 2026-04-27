"use client";

import { useEffect, useMemo, useRef } from "react";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

function toDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function PinInput({ value, onChange, autoFocus = false, disabled = false }: PinInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const safe = toDigits(value);
    return [safe[0] ?? "", safe[1] ?? "", safe[2] ?? "", safe[3] ?? ""];
  }, [value]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    refs.current[0]?.focus();
  }, [autoFocus, disabled]);

  function focusIndex(index: number) {
    refs.current[Math.max(0, Math.min(3, index))]?.focus();
  }

  function handleInput(index: number, nextRaw: string) {
    const nextDigit = nextRaw.replace(/\D/g, "").slice(-1);
    const chars = [...digits];
    chars[index] = nextDigit;
    const nextValue = toDigits(chars.join(""));
    onChange(nextValue);
    if (nextDigit && index < 3) focusIndex(index + 1);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (digits[index]) {
        const chars = [...digits];
        chars[index] = "";
        onChange(chars.join(""));
        return;
      }
      if (index > 0) {
        const chars = [...digits];
        chars[index - 1] = "";
        onChange(chars.join(""));
        focusIndex(index - 1);
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      focusIndex(index - 1);
      return;
    }
    if (event.key === "ArrowRight" && index < 3) {
      focusIndex(index + 1);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = toDigits(event.clipboardData.getData("text"));
    if (!pasted) return;
    onChange(pasted);
    focusIndex(Math.min(3, pasted.length - 1));
  }

  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2, 3].map((index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={digits[index]}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className="h-11 w-11 rounded border border-slate-300 bg-white text-center text-lg font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
      ))}
    </div>
  );
}
