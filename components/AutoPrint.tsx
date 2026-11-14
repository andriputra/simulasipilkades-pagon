"use client";

import { useEffect } from "react";

export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
