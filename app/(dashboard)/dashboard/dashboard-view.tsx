"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, UserSquare } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import type { DateValue } from "react-aria-components";
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Button } from "@/components/base/buttons/button";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { I18nProvider } from "@react-aria/i18n";
import { cx } from "@/utils/cx";
import type { DashboardPeriodId } from "./dashboard-data";
import { useDashboardData } from "./dashboard-data";
import Link from "next/link";
import { ChefHat, CirclePercent } from "lucide-react";

const playfair = Playfair_Display({
    subsets: ["latin"],
    weight: ["600"],
    display: "swap",
});

type PeriodId = DashboardPeriodId;

const periods: { id: PeriodId; label: string }[] = [
    { id: "current", label: "Mês atual" },
    { id: "previous", label: "Mês anterior" },
    { id: "3months", label: "Últimos 3 meses" },
];

const pieColors = ["#22c55e", "#a855f7", "#f97316"] as const;

function formatHourTick(v: number) {
    const h = Math.floor(v);
    const m = Math.round((v - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, "0")}`;
}



function MetricCard({
    title,
    value,
    trendLabel,
    trendUp,
    icon: Icon,
    href,
}: {
    title: string;
    value: string;
    trendLabel: string;
    trendUp: boolean;
    icon: typeof UserSquare;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="block rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset transition-shadow duration-100 ease-linear hover:shadow-md outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
        >
            <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#dbeafe]">
                    <Icon className="size-6 text-[#1c398e]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-md font-medium text-secondary">{title}</p>
                    <p className="mt-1 text-display-sm font-semibold text-primary">{value}</p>
                    <p className="mt-2 flex items-center gap-1 text-sm text-tertiary">
                        {trendUp ? (
                            <ArrowUp className="size-4 text-utility-success-600" aria-hidden />
                        ) : (
                            <ArrowDown className="size-4 text-utility-error-600" aria-hidden />
                        )}
                        <span className={trendUp ? "text-utility-success-600" : "text-utility-error-600"}>{trendLabel}</span>
                        <span className="text-quaternary">vs mês anterior</span>
                    </p>
                </div>
            </div>
        </Link>
    );
}

export function DashboardView() {
    const [period, setPeriod] = useState<PeriodId>("current");
    const [draftCustomRange, setDraftCustomRange] = useState<{ start: DateValue; end: DateValue } | null>(null);
    const [appliedCustomRange, setAppliedCustomRange] = useState<{ start: DateValue; end: DateValue } | null>(null);
    const { derived, errors, loading, reload } = useDashboardData(period, appliedCustomRange);

    const errorSummary = useMemo(() => {
        if (errors.length === 0) return null;
        const parts = errors.map((e) => e.message);
        return parts.join(" • ");
    }, [errors]);

    const pendingChefValue = derived.metrics.pendingChefApprovals.value === null ? "—" : String(derived.metrics.pendingChefApprovals.value);
    const pendingChefTrendLabel = derived.metrics.pendingChefApprovals.trendPercent === null ? "—" : `${derived.metrics.pendingChefApprovals.trendPercent}%`;
    const pendingChefTrendUp = derived.metrics.pendingChefApprovals.trendUp ?? true;

    const requestsValue = derived.metrics.serviceRequests.value === null ? "—" : String(derived.metrics.serviceRequests.value);
    const requestsTrendLabel = derived.metrics.serviceRequests.trendPercent === null ? "—" : `${derived.metrics.serviceRequests.trendPercent}%`;
    const requestsTrendUp = derived.metrics.serviceRequests.trendUp ?? true;

    const unfinishedValue = derived.metrics.unfinishedServices.value === null ? "—" : String(derived.metrics.unfinishedServices.value);
    const unfinishedTrendLabel = derived.metrics.unfinishedServices.trendPercent === null ? "—" : `${derived.metrics.unfinishedServices.trendPercent}%`;
    const unfinishedTrendUp = derived.metrics.unfinishedServices.trendUp ?? true;

    const cancellationValue = derived.metrics.cancellationRate.value === null ? "—" : `${derived.metrics.cancellationRate.value}%`;
    const cancellationTrendLabel = derived.metrics.cancellationRate.trendPercent === null ? "—" : `${derived.metrics.cancellationRate.trendPercent}%`;
    const cancellationTrendUp = derived.metrics.cancellationRate.trendUp ?? false;



    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-8">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>Dashboard</h1>
                        {loading ? <LoadingIndicator type="line-spinner" size="sm" label="Carregando dados..." /> : null}
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <ButtonGroup
                            selectedKeys={new Set([period])}
                            onSelectionChange={(keys) => {
                                const selectedKey = Array.from(keys)[0] as PeriodId | undefined;
                                if (selectedKey) {
                                    setPeriod(selectedKey);
                                }
                            }}
                            disallowEmptySelection
                        >
                            {periods.map((p) => (
                                <ButtonGroupItem
                                    key={p.id}
                                    id={p.id}
                                    iconLeading={
                                        period === p.id ? (
                                            <span className="size-1.5 shrink-0 rounded-full bg-[#1c398e]" aria-hidden />
                                        ) : undefined
                                    }
                                >
                                    {p.label}
                                </ButtonGroupItem>
                            ))}
                        </ButtonGroup>
                        <I18nProvider locale="pt-BR">
                            <DateRangePicker
                                aria-label="Selecionar período"
                                value={draftCustomRange ?? undefined}
                                onChange={setDraftCustomRange}
                                placeholder="Selecionar período"
                                cancelLabel="Cancelar"
                                applyLabel="Aplicar"
                                onApply={() => {
                                    if (!draftCustomRange?.start || !draftCustomRange?.end) return;
                                    setAppliedCustomRange(draftCustomRange);
                                    setPeriod("custom");
                                }}
                                onCancel={() => setDraftCustomRange(appliedCustomRange)}
                                triggerClassName={cx("font-semibold", period === "custom" && "ring-2 ring-[#1c398e] ring-inset")}
                            />
                        </I18nProvider>
                    </div>
                </header>

                {errorSummary ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar todos os dados do dashboard</p>
                                <p className="mt-1 text-sm text-tertiary">{errorSummary}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void reload()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                {loading ? (
                    <>
                        <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:gap-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset flex gap-4">
                                    <Skeleton variant="circular" className="size-12 shrink-0" />
                                    <div className="flex-1 flex flex-col gap-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-8 w-24" />
                                        <Skeleton className="h-4 w-40" />
                                    </div>
                                </div>
                            ))}
                        </section>

                        <section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="flex flex-col overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset p-5 gap-4">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-4 w-64" />
                                    <Skeleton className="h-[220px] w-full" />
                                </div>
                            ))}
                        </section>
                    </>
                ) : (
                    <>
                        <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:gap-6">
                            <MetricCard
                                title="Cadastros pendentes (Chefs)"
                                value={pendingChefValue}
                                trendLabel={pendingChefTrendLabel}
                                trendUp={pendingChefTrendUp}
                                icon={ChefHat}
                                href="/chefs"
                            />
                            <MetricCard title="Solicitações de serviço" value={requestsValue} trendLabel={requestsTrendLabel} trendUp={requestsTrendUp} icon={CirclePercent} href="/agenda" />
                            <MetricCard title="Serviços não finalizados" value={unfinishedValue} trendLabel={unfinishedTrendLabel} trendUp={unfinishedTrendUp} icon={AlertTriangle} href="/agenda" />
                            <MetricCard title="Taxa de cancelamento" value={cancellationValue} trendLabel={cancellationTrendLabel} trendUp={cancellationTrendUp} icon={CirclePercent} href="/agenda" />
                        </section>

                        <section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                            <article className="flex flex-col overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className={"text-lg font-semibold text-primary md:text-xl"}>Serviços finalizados</h2>
                                    <p className="mt-1 text-sm text-tertiary">Proporção de serviços entregues por categoria</p>
                                </div>
                                <div className="px-2 py-6 md:px-5">
                                    <div className="h-[220px] w-full md:h-[240px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                                <Legend verticalAlign="middle" align="right" layout="vertical" content={<ChartLegendContent />} />
                                                <Tooltip content={<ChartTooltipContent isPieChart />} />
                                                <Pie
                                                    isAnimationActive={false}
                                                    data={derived.finishedByCategory}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="38%"
                                                    cy="50%"
                                                    innerRadius="58%"
                                                    outerRadius="88%"
                                                    stroke="none"
                                                >
                                                    {derived.finishedByCategory.map((_, i) => (
                                                        <Cell key={`slice-${i}`} fill={pieColors[i]} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </article>

                            <article className="flex flex-col overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className={cx("text-lg font-semibold text-primary md:text-xl")}>Tempo médio Match</h2>
                                    <p className="mt-1 text-sm text-tertiary">Últimos 7 dias · em horas</p>
                                </div>
                                <div className="h-[280px] w-full px-2 py-4 md:h-[304px] md:px-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={derived.matchTimeByDay}
                                            className="text-tertiary [&_.recharts-text]:text-xs"
                                            margin={{ top: 12, right: 12, left: 0, bottom: 24 }}
                                        >
                                            <defs>
                                                <linearGradient id="tytMatchGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-gray-100" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} />
                                            <YAxis
                                                domain={[3, 5.5]}
                                                ticks={[3, 3.5, 4, 4.5, 5, 5.5]}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={formatHourTick}
                                                width={48}
                                            />
                                            <Tooltip
                                                content={<ChartTooltipContent />}
                                                formatter={(value) => [`${formatHourTick(Number(value ?? 0))}`, "Tempo"]}
                                                labelFormatter={(l) => `Dia: ${l}`}
                                                cursor={{ className: "stroke-[#2563eb] stroke-2" }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="hours"
                                                name="Tempo médio"
                                                stroke="#2563eb"
                                                strokeWidth={2}
                                                fill="url(#tytMatchGradient)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="px-5 pb-4 text-center text-xs text-quaternary md:text-left">Dias da semana · Tempo (h)</p>
                            </article>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
