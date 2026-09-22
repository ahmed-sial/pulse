import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  close,
  title,
  children,
}: {
  close: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close}>
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
