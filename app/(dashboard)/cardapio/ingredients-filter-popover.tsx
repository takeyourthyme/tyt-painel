"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { FilterPopover } from "@/components/application/filters/filter-popover";
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
        <FilterPopover
            isOpen={open}
            onOpenChange={setOpen}
            description="Selecione os critérios para filtrar os ingredientes"
            onCancel={handleCancel}
            onSearch={handleSearch}
        >
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
        </FilterPopover>
    );
}
