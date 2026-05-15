import type { ComponentProps } from "react";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

const authPrimaryClasses =
    "w-full rounded-md! bg-brand-section! text-primary_on-brand! shadow-xs! ring-0! before:hidden! hover:bg-brand-section_subtle! focus-visible:outline-(length:--spacing-focus-ring-width) focus-visible:outline-offset-(--spacing-focus-ring-offset) focus-visible:outline-brand! disabled:bg-disabled!";

export function AuthPrimaryButton({ className, ...props }: ComponentProps<typeof Button>) {
    return <Button size="lg" color="primary" className={cx(authPrimaryClasses, className)} {...props} />;
}
