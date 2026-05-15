import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

export function AuthFlowShell({ children }: { children: ReactNode }) {
    return (
        <div className="relative flex min-h-dvh flex-col items-center justify-center bg-primary px-4 py-12 md:min-h-screen md:px-8 md:pt-24 md:pb-12">
            <div
                className={cx(
                    "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-linear-to-b to-transparent blur-3xl",
                    "from-login-glow-gradient-from",
                    "top-login-glow-top-mobile size-login-glow-mobile",
                    "md:top-login-glow-top-desktop md:size-login-glow-desktop",
                )}
                aria-hidden
            />
            <div className="relative flex w-full max-w-container flex-col items-center">
                <div className="flex w-full max-w-login-form flex-col gap-8">{children}</div>
            </div>
        </div>
    );
}
