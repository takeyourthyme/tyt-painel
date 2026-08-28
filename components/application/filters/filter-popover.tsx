"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { FilterLines } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay, Popover } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";

type FilterPopoverProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    description: string;
    children: ReactNode;
    onCancel: () => void;
    onSearch: () => void;
};

function FilterDialog({ description, children, onCancel, onSearch }: Omit<FilterPopoverProps, "isOpen" | "onOpenChange">) {
    return (
        <Dialog className="outline-hidden">
            <div className="px-4 pt-5 sm:px-6 sm:pt-6">
                <h2 className="text-lg font-semibold text-primary">Filtrar por</h2>
                <p className="mt-0.5 text-sm text-tertiary">{description}</p>
            </div>

            <div className="px-4 pt-5 sm:px-6">
                <div className="flex flex-col gap-5 pb-1">{children}</div>
            </div>

            <div className="flex gap-3 px-4 pt-5 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6">
                <Button color="secondary" size="md" className="flex-1" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button color="primary" size="md" className="flex-1" onClick={onSearch}>
                    Buscar
                </Button>
            </div>
        </Dialog>
    );
}

export function FilterPopover({ isOpen, onOpenChange, description, children, onCancel, onSearch }: FilterPopoverProps) {
    const triggerRef = useRef<HTMLDivElement>(null);
    const isDesktop = useBreakpoint("sm");
    const dialog = (
        <FilterDialog description={description} onCancel={onCancel} onSearch={onSearch}>
            {children}
        </FilterDialog>
    );

    return (
        <div ref={triggerRef} className="relative inline-flex">
            <Button color="primary" size="md" iconTrailing={FilterLines} onClick={() => onOpenChange(!isOpen)}>
                Filtrar
            </Button>

            {isDesktop ? (
                <Popover
                    triggerRef={triggerRef}
                    isOpen={isOpen}
                    onOpenChange={onOpenChange}
                    placement="bottom end"
                    offset={8}
                    shouldFlip
                    className={({ isEntering, isExiting }) =>
                        cx(
                            "z-50 max-h-[var(--available-height)] w-[min(400px,calc(100vw-32px))] origin-(--trigger-anchor-point) overflow-y-auto overscroll-contain rounded-lg bg-primary shadow-xl ring-1 ring-secondary_alt outline-hidden will-change-transform",
                            isEntering &&
                                "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                            isExiting &&
                                "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                        )
                    }
                >
                    {dialog}
                </Popover>
            ) : (
                <ModalOverlay
                    isOpen={isOpen}
                    isDismissable
                    onOpenChange={onOpenChange}
                    className={({ isEntering, isExiting }) =>
                        cx(
                            "fixed inset-0 z-50 flex items-end overflow-y-auto bg-overlay/70 pt-4 backdrop-blur-[6px]",
                            isEntering && "duration-200 ease-out animate-in fade-in",
                            isExiting && "duration-150 ease-in animate-out fade-out",
                        )
                    }
                >
                    <Modal
                        className={({ isEntering, isExiting }) =>
                            cx(
                                "max-h-[calc(100dvh-16px)] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-primary shadow-xl outline-hidden",
                                isEntering && "duration-300 ease-out animate-in slide-in-from-bottom",
                                isExiting && "duration-200 ease-in animate-out slide-out-to-bottom",
                            )
                        }
                    >
                        {dialog}
                    </Modal>
                </ModalOverlay>
            )}
        </div>
    );
}
