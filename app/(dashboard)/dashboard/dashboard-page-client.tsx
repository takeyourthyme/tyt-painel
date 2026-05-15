"use client";

import dynamic from "next/dynamic";

const DashboardView = dynamic(() => import("./dashboard-view").then((m) => m.DashboardView), { ssr: false });

export function DashboardPageClient() {
    return <DashboardView />;
}
