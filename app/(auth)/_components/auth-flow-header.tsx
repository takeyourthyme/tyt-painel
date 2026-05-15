import type { ReactNode } from "react";
import { Playfair_Display } from "next/font/google";
import { cx } from "@/utils/cx";

const playfair = Playfair_Display({
    subsets: ["latin"],
    weight: ["600"],
    display: "swap",
});

export function AuthFlowHeader({ icon, title, description }: { icon: ReactNode; title: string; description: ReactNode }) {
    return (
        <header className="flex w-full flex-col items-center gap-6">
            {icon}
            <div className="flex w-full flex-col gap-2 text-center md:gap-3">
                <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary md:text-display-sm")}>{title}</h1>
                <p className="text-md font-normal text-tertiary">{description}</p>
            </div>
        </header>
    );
}
