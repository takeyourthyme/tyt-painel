"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { FilterPopover } from "@/components/application/filters/filter-popover";
import { cx } from "@/utils/cx";

export type ClientesFilterState = {
    status: ("ativo" | "inativo")[];
    cityIds: string[];
};

export type ClientesFilterOption = {
    id: string;
    label: string;
};

export function emptyClientesFilter(): ClientesFilterState {
    return { status: [], cityIds: [] };
}

export function isClientesFilterActive(f: ClientesFilterState): boolean {
    return f.status.length > 0 || f.cityIds.length > 0;
}

const STATUS_OPTIONS: { id: "ativo" | "inativo"; label: string }[] = [
    { id: "ativo", label: "Ativo" },
    { id: "inativo", label: "Inativo" },
];

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

function SectionDivider() {
    return <div className="h-px w-full bg-border-secondary" role="separator" />;
}

type ClientesFilterPopoverProps = {
    applied: ClientesFilterState;
    onApply: (next: ClientesFilterState) => void;
    cityOptions: ClientesFilterOption[];
};

export function ClientesFilterPopover({ applied, onApply, cityOptions }: ClientesFilterPopoverProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<ClientesFilterState>(applied);

    useEffect(() => {
        if (open) {
            setDraft({
                status: [...applied.status],
                cityIds: [...applied.cityIds],
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
            description="Selecione os critérios para filtrar a lista"
            onCancel={handleCancel}
            onSearch={handleSearch}
        >
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-secondary">Status</p>
                <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                        <FilterChip
                            key={opt.id}
                            selected={draft.status.includes(opt.id)}
                            onClick={() => setDraft((d) => ({ ...d, status: toggleInList(d.status, opt.id) }))}
                        >
                            {opt.label}
                        </FilterChip>
                    ))}
                </div>
            </div>

            {cityOptions.length > 0 ? (
                <>
                    <SectionDivider />
                    <div className="flex flex-col gap-2 pb-1">
                        <p className="text-sm font-medium text-secondary">Localização</p>
                        <div className="flex flex-wrap gap-2">
                            {cityOptions.map((opt) => (
                                <FilterChip
                                    key={opt.id}
                                    selected={draft.cityIds.includes(opt.id)}
                                    onClick={() =>
                                        setDraft((d) => ({
                                            ...d,
                                            cityIds: toggleInList(d.cityIds, opt.id),
                                        }))
                                    }
                                >
                                    {opt.label}
                                </FilterChip>
                            ))}
                        </div>
                    </div>
                </>
            ) : null}
        </FilterPopover>
    );
}
