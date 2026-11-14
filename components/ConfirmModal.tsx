"use client";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ open, title, message, confirmLabel = "Ya, lanjutkan", onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/60 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="pop-in w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
