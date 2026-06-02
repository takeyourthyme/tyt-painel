import { cx } from "@/utils/cx";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rectangular", ...props }: SkeletonProps) {
    return (
        <div
            className={cx(
                "animate-pulse bg-neutral-200 dark:bg-neutral-800",
                variant === "circular" && "rounded-full",
                variant === "text" && "h-4 w-full rounded-md",
                variant === "rectangular" && "rounded-lg",
                className
            )}
            {...props}
        />
    );
}
