"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasTytSession } from "@/lib/tyt-api/session";
import { TytMobileNavigationHeader } from "./tyt-mobile-navigation-header";
import { TytSidebar } from "./tyt-sidebar";

const SIDEBAR_EXPANDED_WIDTH = 296;
const SIDEBAR_COLLAPSED_WIDTH = 80;
const SIDEBAR_STORAGE_KEY = "tyt_sidebar_collapsed";

export function DashboardShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (!hasTytSession()) {
            router.replace("/login");
            return;
        }
        setReady(true);
    }, [router]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
            if (raw === "true") setSidebarCollapsed(true);
        } catch { }
    }, []);

    const handleSidebarCollapsedChange = (next: boolean) => {
        setSidebarCollapsed(next);
        try {
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "true" : "false");
        } catch { }
    };

    if (!ready) {
        return null;
    }

    return (
        <div className="flex min-h-dvh flex-col bg-secondary_alt lg:flex-row">
            <TytMobileNavigationHeader>
                <TytSidebar collapsed={false} variant="mobile" />
            </TytMobileNavigationHeader>

            <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:py-0">
                <TytSidebar collapsed={sidebarCollapsed} onCollapsedChange={handleSidebarCollapsedChange} variant="desktop" />
            </div>

            <div
                className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-(--sidebar-width)"
                style={{ "--sidebar-width": `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH}px` } as React.CSSProperties}
            >
                {children}
            </div>
        </div>
    );
}
