"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface MenuItem {
  label: string;
  href: string;
  icon: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { label: "Cloudflare", href: "/cloudflare", icon: "\u{2601}" },
  {
    label: "Claude",
    href: "/claude",
    icon: "\u{1F916}",
    children: [
      { label: "Overview", href: "/claude", icon: "\u{1F4CB}" },
      { label: "Usage", href: "/claude/usage", icon: "\u{1F4CA}" },
      { label: "Cost", href: "/claude/cost", icon: "\u{1F4B0}" },
      { label: "Sessions", href: "/claude/sessions", icon: "\u{1F4DD}" },
    ],
  },
  { label: "Ports", href: "/ports", icon: "\u{1F50C}" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/claude") return pathname === "/claude";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isClaudeExpanded = pathname.startsWith("/claude");

  return (
    <aside className="fixed top-12 left-0 w-56 h-[calc(100vh-48px)] bg-[#16213e] border-r border-[#2d3a4f] overflow-y-auto z-40">
      <nav className="py-2">
        {menuItems.map((item) => (
          <div key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
                isActive(item.href)
                  ? "bg-sm-link/15 text-sm-link border-r-2 border-sm-link"
                  : "text-sm-text-dim hover:bg-sm-surface-hover hover:text-sm-text"
              }`}
            >
              <span className="text-sm w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>

            {item.children && isClaudeExpanded && (
              <div className="ml-4">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center gap-2.5 px-4 py-1.5 text-[11px] transition-colors ${
                      isActive(child.href)
                        ? "bg-sm-link/10 text-sm-link"
                        : "text-sm-text-dim hover:bg-sm-surface-hover hover:text-sm-text"
                    }`}
                  >
                    <span className="text-xs w-4 text-center">{child.icon}</span>
                    <span>{child.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#2d3a4f]">
        <div className="text-[10px] text-sm-text-dim">
          <div>SysMonitor v2.0</div>
          <div className="mt-0.5">Cloudflare & Claude & Ports</div>
        </div>
      </div>
    </aside>
  );
}
