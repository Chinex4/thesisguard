"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer, IconButton } from "@mui/material";
import {
  LayoutDashboard,
  FileText,
  ScanLine,
  Library,
  UserRound,
  Users,
  Settings,
  Building2,
  Menu,
  LogOut,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import type { Profile } from "@/types";
const student = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["My theses", "/theses", FileText],
  ["Similarity checks", "/scans", ScanLine],
  ["Repository", "/repository", Library],
  ["Profile", "/profile", UserRound],
] as const;
const supervisor = [
  ["Dashboard", "/supervisor", LayoutDashboard],
  ["Submissions", "/supervisor/submissions", FileText],
  ["Reports", "/scans", ScanLine],
  ["Repository", "/repository", Library],
  ["Profile", "/profile", UserRound],
] as const;
const admin = [
  ["Dashboard", "/admin", LayoutDashboard],
  ["Users", "/admin/users", Users],
  ["Theses", "/admin/theses", FileText],
  ["Scans", "/admin/scans", ScanLine],
  ["Departments", "/admin/departments", Building2],
  ["Settings", "/admin/settings", Settings],
  ["Repository", "/repository", Library],
] as const;
export function Shell({
  user,
  children,
}: {
  user: Profile | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items =
    user?.role === "ADMIN"
      ? admin
      : user?.role === "SUPERVISOR"
        ? supervisor
        : student;
  const nav = (
    <>
      <Brand />
      <div className="eyebrow text-slate-400! px-3 mb-3">Workspace</div>
      <nav>
        {items.map(([name, url, Icon]) => (
          <Link
            onClick={() => setOpen(false)}
            key={url}
            href={url}
            className={
              "nav-item " +
              (pathname === url ||
              (url !== "/admin" &&
                url !== "/supervisor" &&
                pathname.startsWith(url + "/"))
                ? "active"
                : "")
            }
          >
            <Icon size={18} />
            {name}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="flex gap-2 text-xs text-slate-500 mb-4">
          <ShieldCheck size={17} />
          <span>
            Research with confidence.
            <br />
            Review with care.
          </span>
        </div>
        <Link href="/" className="text-xs flex gap-2 items-center">
          About ThesisGuard <ArrowUpRight size={13} />
        </Link>
      </div>
    </>
  );
  return (
    <>
      <aside className="sidebar">{nav}</aside>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <div className="p-6 w-64 h-full flex flex-col gap-6">{nav}</div>
      </Drawer>
      <div className="workspace">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <span className="mobile-menu">
              <IconButton
                aria-label="Open navigation"
                onClick={() => setOpen(true)}
              >
                <Menu />
              </IconButton>
            </span>
            <small>Institutional research workspace</small>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs font-semibold">
                {user?.full_name || "Welcome to ThesisGuard"}
              </div>
              <small>{user?.role.toLowerCase() || "Setup required"}</small>
            </div>
            {user && (
              <form action={signOut}>
                <IconButton type="submit" aria-label="Sign out" size="small">
                  <LogOut size={17} />
                </IconButton>
              </form>
            )}
          </div>
        </header>
        <main id="main" className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          ThesisGuard · Similarity is an indicator, never an automatic verdict.
        </footer>
      </div>
    </>
  );
}
