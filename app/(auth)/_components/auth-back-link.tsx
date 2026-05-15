import { ArrowLeft } from "@untitledui/icons";
import Link from "next/link";
import { cx } from "@/utils/cx";

export function AuthBackToLoginLink({ children, className }: { children: string; className?: string }) {
    return (
        <Link
            href="/login"
            className={cx(
                "inline-flex items-center justify-center gap-1 text-sm font-semibold text-tertiary transition-colors hover:text-tertiary_hover",
                className,
            )}
        >
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
            {children}
        </Link>
    );
}
