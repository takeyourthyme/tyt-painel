"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasTytSession } from "@/lib/tyt-api/session";
import { TytMobileNavigationHeader } from "./tyt-mobile-navigation-header";
import { TytSidebar } from "./tyt-sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!hasTytSession()) {
            router.replace("/login");
            return;
        }
        setReady(true);
    }, [router]);

    if (!ready) {
        return null;
    }

    return (
        <div className="flex min-h-dvh flex-col bg-secondary_alt lg:flex-row">
            <TytMobileNavigationHeader>
                <TytSidebar />
            </TytMobileNavigationHeader>

            <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:py-0">
                <TytSidebar />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-[296px]">{children}</div>
        </div>
    );
}
