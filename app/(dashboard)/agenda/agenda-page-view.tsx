"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Download02, Eye, FilterLines, SearchLg } from "@untitledui/icons";
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

const playfair = Playfair_Display({
    subsets: ["latin"],
    display: "swap",
});

type TabId = "scheduled" | "requests";

const tabItems: { id: TabId; label: string }[] = [
    { id: "scheduled", label: "Serviços agendados" },
    { id: "requests", label: "Solicitações" },
];

function MetricCard({ label, value, sublabel }: { label: string; value: ReactNode; sublabel?: string }) {
    return (
        <div className="flex flex-1 flex-col gap-1 rounded-xl bg-primary px-5 py-4 shadow-xs ring-1 ring-secondary ring-inset">
            <p className="text-sm font-medium text-tertiary">{label}</p>
            <div className="flex items-baseline gap-2">
                <span className="text-display-sm font-semibold text-primary">{value}</span>
                {sublabel ? <span className="text-sm text-quaternary">{sublabel}</span> : null}
            </div>
        </div>
    );
}

export function AgendaPageView({ initialTab = "requests" }: { initialTab?: TabId }) {
    const [selectedTab, setSelectedTab] = useState<Key>(initialTab);
    const [query, setQuery] = useState("");
    const { scheduled, requests, metrics, loading, error, reload } = useAgendaOrders();

    const visible = useMemo(() => {
        const list = selectedTab === "scheduled" ? scheduled : requests;
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((r) => {
            const hay = `${r.code} ${r.typeLabel} ${r.statusLabel} ${r.cityLabel} ${r.chefName ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [selectedTab, scheduled, requests, query]);

    const requestsCount = requests.length;

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h1 className={cx(playfair.className, "text-display-md font-normal text-primary lg:text-display-lg")}>Agenda de Serviços</h1>
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

                <section className="flex flex-col gap-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <MetricCard label="Total de serviços" value={loading ? "—" : String(metrics.total)} />
                        <MetricCard label="Aguardando Match" value={loading ? "—" : String(metrics.awaitingMatch)} />
                        <MetricCard label="Serviços recusados pelo Chef" value={loading ? "—" : String(metrics.chefRefused)} />
                    </div>

                    <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} className="flex w-full flex-col gap-6">
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
                                title="Serviços agendados"
                                description="Acompanhe os serviços com chef definido."
                                query={query}
                                onQueryChange={setQuery}
                                rows={selectedTab === "scheduled" ? visible : scheduled}
                                baseHref="/agenda/servicos-agendados"
                            />
                        </Tabs.Panel>

                        <Tabs.Panel id="requests" className="flex flex-col gap-4 outline-hidden">
                            <SectionTable
                                title="Solicitações"
                                description="Analise os pedidos recentes e realize o match com os chefs disponíveis."
                                query={query}
                                onQueryChange={setQuery}
                                rows={selectedTab === "requests" ? visible : requests}
                                baseHref="/agenda/solicitacoes"
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
}: {
    title: string;
    description: string;
    query: string;
    onQueryChange: (v: string) => void;
    rows: ReturnType<typeof useAgendaOrders>["rows"];
    baseHref: string;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
            <div className="border-b border-secondary px-6 py-5">
                <p className="text-sm font-semibold text-primary">{title}</p>
                <p className="mt-1 text-sm text-tertiary">{description}</p>
            </div>

            <TableCard.Root>
                <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <Input placeholder="Buscar por ordem" value={query} onChange={onQueryChange} icon={SearchLg} className="min-w-0 md:max-w-sm md:flex-1" />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button color="secondary" size="md" iconLeading={Download02}>
                            Exportar dados
                        </Button>
                        <Button color="primary" size="md" iconLeading={FilterLines}>
                            Filtrar
                        </Button>
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
        </div>
    );
}
