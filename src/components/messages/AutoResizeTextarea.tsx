import { useRef, useEffect, forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AutoResizeTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
  maxRows?: number;
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, minRows = 1, maxRows = 6, value, onChange, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const combinedRef = (node: HTMLTextAreaElement) => {
      textareaRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset height to recalculate
      textarea.style.height = 'auto';
      
      // Calculate line height
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
      const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
      const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
      
      const minHeight = lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom;
      const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom;
      
      // Set the height based on scroll height, clamped between min and max
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
      
      // Show scrollbar if content exceeds max height
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [value, minRows, maxRows]);

    return (
      <textarea
        ref={combinedRef}
        value={value}
        onChange={onChange}
        rows={minRows}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "resize-none transition-[height] duration-100",
          className
        )}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
