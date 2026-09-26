import { useCallback, useRef, type ReactNode } from "react";

/**
 * Wraps scrollable content in a box whose height can be dragged from
 * anywhere along its bottom edge — not just a corner grip, like a
 * native OS window pane. Height is written straight to the DOM node
 * during drag (no re-renders per mousemove); the starting height and
 * lower bound come from CSS (`className`), the upper bound defaults
 * to 85% of the viewport unless overridden.
 */
export function ResizableY({
  children,
  className = "",
  contentClassName = "",
  minHeight = 150,
  maxHeight,
  handleTitle = "Drag to resize",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  minHeight?: number;
  maxHeight?: number;
  handleTitle?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const box = boxRef.current;
      if (!box) return;
      const startY = e.clientY;
      const startHeight = box.getBoundingClientRect().height;
      const upperBound = maxHeight ?? window.innerHeight * 0.85;
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        const next = Math.min(
          upperBound,
          Math.max(minHeight, startHeight + (ev.clientY - startY)),
        );
        box.style.height = `${next}px`;
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [minHeight, maxHeight],
  );

  return (
    <div ref={boxRef} className={`resizable-y ${className}`}>
      <div className={`resizable-y-content ${contentClassName}`}>
        {children}
      </div>
      <div
        className="resize-handle-y"
        onMouseDown={onDragStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize"
        title={handleTitle}
      />
    </div>
  );
}
