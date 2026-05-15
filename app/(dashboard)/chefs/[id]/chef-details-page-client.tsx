"use client";

import dynamic from "next/dynamic";

const ChefDetailsView = dynamic<{ id: string }>(() => import("./chef-details-view").then((m) => m.ChefDetailsView), { ssr: false });

export function ChefDetailsPageClient({ id }: { id: string }) {
    return <ChefDetailsView id={id} />;
}
