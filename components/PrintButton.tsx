"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
    >
      Cetak
    </button>
  );
}
