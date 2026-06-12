"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FilterLines } from "@untitledui/icons";
import { Dialog, Popover } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

export type IngredientsFilterState = {
    categories: string[];
};

export type IngredientsFilterOption = {
    id: string;
    label: string;
};

export function emptyIngredientsFilter(): IngredientsFilterState {
    return { categories: [] };
}

export function isIngredientsFilterActive(f: IngredientsFilterState): boolean {
    return f.categories.length > 0;
}

function toggleInList<T extends string>(list: T[], id: T): T[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function FilterChip({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cx(
                "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-sm font-medium outline-focus-ring transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                selected
                    ? "border-utility-brand-200 bg-utility-brand-50 text-utility-brand-700"
                    : "border-utility-gray-200 bg-utility-gray-50 text-utility-gray-700 hover:bg-utility-gray-100",
            )}
        >
            {children}
        </button>
    );
}

type IngredientsFilterPopoverProps = {
    applied: IngredientsFilterState;
    onApply: (next: IngredientsFilterState) => void;
    categoryOptions: IngredientsFilterOption[];
};

export function IngredientsFilterPopover({ applied, onApply, categoryOptions }: IngredientsFilterPopoverProps) {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<IngredientsFilterState>(applied);

    useEffect(() => {
        if (open) {
            setDraft({
                categories: [...applied.categories],
            });
        }
    }, [open, applied]);

    const handleCancel = useCallback(() => {
        setOpen(false);
    }, []);

    const handleSearch = useCallback(() => {
        onApply(draft);
        setOpen(false);
    }, [draft, onApply]);

    return (
        <div ref={triggerRef} className="relative inline-flex">
            <Button
                color="primary"
                size="md"
                iconTrailing={FilterLines}
                onClick={() => setOpen((v) => !v)}
            >
                Filtrar
            </Button>

            <Popover
                triggerRef={triggerRef}
                isOpen={open}
                onOpenChange={setOpen}
                placement="bottom end"
                offset={8}
                shouldFlip
                className={({ isEntering, isExiting }) =>
                    cx(
                        "z-50 w-[min(400px,calc(100vw-32px))] origin-(--trigger-anchor-point) rounded-lg bg-primary shadow-xl ring-1 ring-secondary_alt outline-hidden will-change-transform",
                        isEntering &&
                            "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                        isExiting &&
                            "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                    )
                }
            >
                <Dialog className="flex max-h-[min(560px,85dvh)] flex-col outline-hidden">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <div className="flex flex-col gap-5 px-6 pt-6">
                            <div className="flex flex-col gap-0.5">
                                <h2 className="text-lg font-semibold text-primary">Filtrar por</h2>
                                <p className="text-sm text-tertiary">Selecione os critérios para filtrar os ingredientes</p>
                            </div>

                            {categoryOptions.length > 0 ? (
                                <div className="flex flex-col gap-2 pb-1">
                                    <p className="text-sm font-medium text-secondary">Categoria</p>
                                    <div className="flex flex-wrap gap-2">
                                        {categoryOptions.map((opt) => (
                                            <FilterChip
                                                key={opt.id}
                                                selected={draft.categories.includes(opt.id)}
                                                onClick={() =>
                                                    setDraft((d) => ({
                                                        ...d,
                                                        categories: toggleInList(d.categories, opt.id),
                                                    }))
                                                }
                                            >
                                                {opt.label}
                                            </FilterChip>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex shrink-0 gap-3 px-6 pt-6 pb-6">
                        <Button color="secondary" size="md" className="flex-1" onClick={handleCancel}>
                            Cancelar
                        </Button>
                        <Button color="primary" size="md" className="flex-1" onClick={handleSearch}>
                            Buscar
                        </Button>
                    </div>
                </Dialog>
            </Popover>
        </div>
    );
}
