"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function FlashContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const notice = params.get("notice");
  if (!error && !notice) return null;
  return (
    <div className={`flash ${error ? "flash-error" : "flash-success"}`} role={error ? "alert" : "status"}>
      {error || notice}
    </div>
  );
}

export function FlashMessage() {
  return (
    <Suspense fallback={null}>
      <FlashContent />
    </Suspense>
  );
}
