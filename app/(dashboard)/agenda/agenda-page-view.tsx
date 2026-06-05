"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Calendar, Download02, Eye, FilterLines, Hourglass03, SearchLg, UserSquare, XCircle } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import type { Key } from "react-aria-components";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Table, TableCard } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import { useAgendaOrders } from "./agenda-data";
import { TriangleAlert, Utensils } from "lucide-react";
import { toast } from "sonner";
import { AgendaFilterPopover, emptyAgendaFilter, type AgendaFilterOption, type AgendaFilterState } from "./agenda-filter-popover";

const playfair = Playfair_Display({
    subsets: ["latin"],
    display: "swap",
});

type TabId = "scheduled" | "requests";

const tabItems: { id: TabId; label: string }[] = [
    { id: "scheduled", label: "Serviços agendados" },
    { id: "requests", label: "Solicitações" },
];

function MetricCard({
    label,
    value,
    sublabel,
    icon: Icon,
}: {
    label: string;
    value: ReactNode;
    sublabel?: string;
    icon: typeof UserSquare;
}) {
    return (
        <div className="flex flex-1 items-start gap-4 rounded-xl bg-primary px-5 py-4 shadow-xs ring-1 ring-secondary ring-inset">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#dbeafe]">
                <Icon className="size-6 text-[#1c398e]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-tertiary">{label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className={cx(playfair.className, "text-display-sm font-semibold text-primary")}>{value}</span>
                    {sublabel ? <span className="text-sm text-quaternary">{sublabel}</span> : null}
                </div>
            </div>
        </div>
    );
}

export function AgendaPageView({ initialTab = "requests" }: { initialTab?: TabId }) {
    const [selectedTab, setSelectedTab] = useState<Key>(initialTab);
    const [query, setQuery] = useState("");
    const [appliedFilter, setAppliedFilter] = useState<AgendaFilterState>(() => emptyAgendaFilter());
    const { scheduled, requests, metrics, loading, error, reload } = useAgendaOrders();

    const currentTabOrders = useMemo(() => {
        return selectedTab === "scheduled" ? scheduled : requests;
    }, [selectedTab, scheduled, requests]);

    const serviceTypeOptions = useMemo<AgendaFilterOption[]>(() => {
        const types = new Set<string>();
        currentTabOrders.forEach((r) => {
            if (r.typeLabel) types.add(r.typeLabel);
        });
        return Array.from(types).map((t) => ({ id: t, label: t }));
    }, [currentTabOrders]);

    const statusOptions = useMemo<AgendaFilterOption[]>(() => {
        const statuses = new Set<string>();
        currentTabOrders.forEach((r) => {
            if (r.statusLabel) statuses.add(r.statusLabel);
        });
        return Array.from(statuses).map((s) => ({ id: s, label: s }));
    }, [currentTabOrders]);

    const visible = useMemo(() => {
        let filteredList = currentTabOrders;
        if (appliedFilter.serviceTypes.length > 0) {
            filteredList = filteredList.filter((r) => appliedFilter.serviceTypes.includes(r.typeLabel));
        }
        if (appliedFilter.statuses.length > 0) {
            filteredList = filteredList.filter((r) => appliedFilter.statuses.includes(r.statusLabel));
        }
        const q = query.trim().toLowerCase();
        if (!q) return filteredList;
        return filteredList.filter((r) => {
            const hay = `${r.code} ${r.typeLabel} ${r.statusLabel} ${r.cityLabel} ${r.chefName ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [currentTabOrders, query, appliedFilter]);

    useEffect(() => {
        setAppliedFilter(emptyAgendaFilter());
        setQuery("");
    }, [selectedTab]);

    const requestsCount = requests.length;

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-8">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>Agenda de Serviços</h1>
                        {loading ? <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." /> : null}
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar a agenda.</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void reload()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                <section className="flex flex-col gap-8">
                    <div className="grid gap-4 sm:grid-cols-3" aria-label="Métricas">
                        <MetricCard label="Total de serviços" value={loading ? "—" : String(metrics.total)} icon={Utensils} />
                        <MetricCard label="Aguardando Match" value={loading ? "—" : String(metrics.awaitingMatch)} icon={Hourglass03} />
                        <MetricCard label="Serviços recusados pelo Chef" value={loading ? "—" : String(metrics.chefRefused)} icon={TriangleAlert} />
                    </div>

                    <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} className="flex w-full flex-col gap-8">
                        <Tabs.List
                            type="underline"
                            size="md"
                            items={tabItems.map((t) => (t.id === "requests" ? { ...t, badge: requestsCount > 0 ? requestsCount : undefined } : t))}
                            className="w-full"
                        >
                            {(tab) => <Tabs.Item {...tab} id={tab.id} />}
                        </Tabs.List>

                        <Tabs.Panel id="scheduled" className="flex flex-col gap-4 outline-hidden">
                            <SectionTable
                                title="Gestão de Agendamentos"
                                description="Visualize, filtre e gerencie os chefs parceiros cadastrados na plataforma."
                                query={query}
                                onQueryChange={setQuery}
                                rows={visible}
                                baseHref="/agenda/servicos-agendados"
                                appliedFilter={appliedFilter}
                                onApplyFilter={setAppliedFilter}
                                serviceTypeOptions={serviceTypeOptions}
                                statusOptions={statusOptions}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel id="requests" className="flex flex-col gap-4 outline-hidden">
                            <SectionTable
                                title="Solicitações"
                                description="Analise os pedidos recentes e realize o match com os chefs disponíveis."
                                query={query}
                                onQueryChange={setQuery}
                                rows={visible}
                                baseHref="/agenda/solicitacoes"
                                appliedFilter={appliedFilter}
                                onApplyFilter={setAppliedFilter}
                                serviceTypeOptions={serviceTypeOptions}
                                statusOptions={statusOptions}
                            />
                        </Tabs.Panel>
                    </Tabs>
                </section>
            </div>
        </main>
    );
}

function SectionTable({
    title,
    description,
    query,
    onQueryChange,
    rows,
    baseHref,
    appliedFilter,
    onApplyFilter,
    serviceTypeOptions,
    statusOptions,
}: {
    title: string;
    description: string;
    query: string;
    onQueryChange: (v: string) => void;
    rows: ReturnType<typeof useAgendaOrders>["rows"];
    baseHref: string;
    appliedFilter: AgendaFilterState;
    onApplyFilter: (next: AgendaFilterState) => void;
    serviceTypeOptions: AgendaFilterOption[];
    statusOptions: AgendaFilterOption[];
}) {
    return (
        <>
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                <p className="text-sm text-tertiary">{description}</p>
            </div>

            <TableCard.Root>
                <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <Input placeholder="Buscar por ordem" value={query} onChange={onQueryChange} icon={SearchLg} className="w-full md:max-w-md" />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            color="secondary"
                            size="md"
                            iconLeading={Download02}
                            onClick={() => {
                                toast.success("Exportação da agenda iniciada!");
                                // TODO: Integrar com a API de exportação da agenda
                            }}
                        >
                            Exportar dados
                        </Button>
                        <AgendaFilterPopover
                            applied={appliedFilter}
                            onApply={onApplyFilter}
                            serviceTypeOptions={serviceTypeOptions}
                            statusOptions={statusOptions}
                        />
                    </div>
                </div>

                <Table aria-label={title} selectionMode="none">
                    <Table.Header>
                        <Table.Head id="order" label="Ordem" isRowHeader className="min-w-[140px]" />
                        <Table.Head id="type" label="Tipo de serviço" className="min-w-[160px]" />
                        <Table.Head id="status" label="Status" className="min-w-[180px]" />
                        <Table.Head id="value" label="Valor" className="min-w-[120px]" />
                        <Table.Head id="city" label="Local" className="min-w-[140px]" />
                        <Table.Head id="date" label="Data" className="min-w-[140px]" />
                        <Table.Head id="actions" label="" className="w-[56px]" />
                    </Table.Header>
                    <Table.Body items={rows}>
                        {(item) => (
                            <Table.Row id={item.id}>
                                <Table.Cell className="whitespace-nowrap font-medium text-primary">{item.code}</Table.Cell>
                                <Table.Cell>
                                    <Badge size="sm" type="pill-color" color={item.typeColor}>
                                        {item.typeLabel}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell>
                                    <Badge size="sm" type="pill-color" color={item.statusColor}>
                                        {item.statusLabel}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap text-tertiary">{item.valueLabel}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{item.cityLabel}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{item.dateLabel}</Table.Cell>
                                <Table.Cell className="!px-4">
                                    <div className="flex justify-end">
                                        <ButtonUtility
                                            size="sm"
                                            color="tertiary"
                                            tooltip="Ver ordem"
                                            icon={Eye}
                                            href={`${baseHref}/${encodeURIComponent(item.code)}`}
                                        />
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </TableCard.Root>
        </>
    );
}
