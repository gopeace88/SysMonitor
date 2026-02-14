"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cloudflare");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-sm-bg">
      <div className="text-sm-text-dim text-sm">Redirecting...</div>
    </div>
  );
}
