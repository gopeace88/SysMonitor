"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && !isLoginPage) {
      router.replace("/login");
    }
    setChecked(true);
  }, [pathname, isLoginPage, router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sm-bg">
        <div className="text-sm-text-dim text-sm">Loading...</div>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar />
      <Sidebar />
      <main className="ml-56 mt-12 min-h-[calc(100vh-48px)] p-4 bg-sm-bg">
        {children}
      </main>
    </>
  );
}
