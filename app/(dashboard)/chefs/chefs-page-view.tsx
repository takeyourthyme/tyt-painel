"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download02, Eye, File06, SearchLg, Star01, Users01, UserSquare } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import type { Key } from "react-aria-components";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Table, TableCard } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { Avatar } from "@/components/base/avatar/avatar";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { TytApiError, parseApiErrorMessage, parseJsonOrThrow } from "@/lib/tyt-api/errors";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { getChefs } from "@/lib/tyt-api/users";
import { cx } from "@/utils/cx";
import { type ChefsFilterOption, ChefsFilterPopover, type ChefsFilterState, emptyChefsFilter } from "./chefs-filter-popover";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";

const playfair = Playfair_Display({
    subsets: ["latin"],
    weight: ["600"],
    display: "swap",
});
type ChefStage = "cadastro" | "analise" | "entrevista" | "documentacao" | "ativo" | "inativo";
type ChefRow = {
    id: string;
    name: string;
    username: string;
    initials: string;
    status: "ativo" | "inativo";
    stage: ChefStage;
    services: { label: string; color: BadgeColors }[];
    location: string;
    rating: number | null;
    registeredAgo: string;
    serviceFilterIds: string[];
    cityFilterId: string;
    avatarUrl: string | null;
    createdAt: string | null;
};

type ApiChef = {
    id: number | string;
    nome: string;
    email: string;
    cidade: string;
    estado: string;
    foto?: string | null;
    createdAt?: string | null;
    usuario_chef?: {
        instagram?: string | null;
        cadastro_aprovado?: boolean | null;
        status?: string | null;
        usuario_chef_disponivel_para?: { disponivel_para: string; active: boolean }[] | null;
    } | null;
};

function cleanUrl(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const cleaned = raw.replace(/`/g, "").trim();
    if (!cleaned) return null;
    return cleaned;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/g).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return `${first}${last}`.toUpperCase();
}

function toId(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function formatServiceLabel(value: string): string {
    return value
        .trim()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeChefStage(raw: unknown): ChefStage | null {
    if (typeof raw !== "string") return null;
    const normalized = raw.trim().toLowerCase();
    const mapped: Record<string, ChefStage> = {
        cadastro: "cadastro",
        analise: "analise",
        análise: "analise",
        entrevista: "entrevista",
        documentacao: "documentacao",
        documentação: "documentacao",
        ativo: "ativo",
        inativo: "inativo",
        active: "ativo",
        inactive: "inativo",
        pending: "cadastro",
    };
    return mapped[normalized] ?? null;
}

function isFinalChefStage(stage: ChefStage): boolean {
    return stage === "ativo" || stage === "inativo";
}

function formatChefStageLabel(stage: ChefStage): string {
    const map: Record<ChefStage, string> = {
        cadastro: "Cadastro",
        analise: "Análise de perfil",
        entrevista: "Entrevista",
        documentacao: "Documentação",
        ativo: "Ativo",
        inativo: "Inativo",
    };
    return map[stage];
}

function getChefStageBadgeColor(stage: ChefStage): BadgeColors {
    const map: Record<ChefStage, BadgeColors> = {
        cadastro: "pink",
        analise: "purple",
        entrevista: "blue",
        documentacao: "gray-blue",
        ativo: "success",
        inativo: "gray",
    };
    return map[stage];
}

const serviceColorCycle: BadgeColors[] = ["brand", "indigo", "purple", "orange", "blue", "success", "pink", "gray-blue"];

function getServiceColorById(id: string): BadgeColors {
    const sum = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return serviceColorCycle[sum % serviceColorCycle.length] ?? "gray";
}

function timeAgo(createdAtRaw: string | null | undefined): string {
    if (!createdAtRaw) return "—";
    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime())) return "—";

    const diffMs = Date.now() - createdAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return "hoje";
    if (diffDays === 1) return "1 dia";
    if (diffDays < 30) return `${diffDays} dias`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return "1 mês";
    if (diffMonths < 12) return `${diffMonths} meses`;
    const diffYears = Math.floor(diffMonths / 12);
    return diffYears === 1 ? "1 ano" : `${diffYears} anos`;
}

function isTransientStatus(status: number): boolean {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function isTransientError(err: unknown): boolean {
    if (err instanceof TytApiError) return isTransientStatus(err.status);
    if (err instanceof TypeError) return true;
    return false;
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        globalThis.setTimeout(() => resolve(), ms);
    });
}

async function runWithRetry<T>(fn: () => Promise<T>, options: { retries: number }): Promise<T> {
    const { retries } = options;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt === retries || !isTransientError(err)) throw err;
            await sleep(250 * Math.pow(2, attempt));
        }
    }

    throw lastError;
}

type CacheEntry<T> = { value: T; storedAt: number };

const requestCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

async function requestOnce<T>(key: string, fn: () => Promise<T>, ttlMs = 1500): Promise<T> {
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.storedAt <= ttlMs) {
        return cached.value as T;
    }

    const existing = inflight.get(key);
    if (existing) {
        return (await existing) as T;
    }

    const p = fn()
        .then((value) => {
            requestCache.set(key, { value, storedAt: Date.now() });
            return value;
        })
        .finally(() => {
            inflight.delete(key);
        });

    inflight.set(key, p);
    return (await p) as T;
}

function normalizeList<T = unknown>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data as T[];
        if (Array.isArray(obj.items)) return obj.items as T[];
        if (Array.isArray(obj.results)) return obj.results as T[];
    }
    return [];
}

function chefMatchesFilter(chef: ChefRow, f: ChefsFilterState): boolean {
    if (f.status.length > 0 && !f.status.includes(chef.status)) {
        return false;
    }
    if (f.serviceIds.length > 0 && !chef.serviceFilterIds.some((sid) => f.serviceIds.includes(sid))) {
        return false;
    }
    if (f.cityIds.length > 0 && !f.cityIds.includes(chef.cityFilterId)) {
        return false;
    }
    return true;
}

const tabItems = [
    { id: "todos", label: "Todos os Chefs" },
    { id: "novos", label: "Novos cadastros" },
];

function StarRating({ value, max = 5 }: { value: number | null; max?: number }) {
    if (value === null) {
        return <span className="text-sm text-tertiary">—</span>;
    }
    return (
        <div className="flex items-center gap-0.5" aria-label={`Avaliação ${value} de ${max}`}>
            {Array.from({ length: max }, (_, i) => (
                <Star01
                    key={i}
                    className={cx("size-4 shrink-0", i < value ? "text-utility-warning-400" : "text-utility-gray-200")}
                    strokeWidth={i < value ? 0 : 1.5}
                    fill={i < value ? "currentColor" : "none"}
                />
            ))}
        </div>
    );
}

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

export function ChefsPageView() {
    const [selectedTab, setSelectedTab] = useState<Key>("todos");
    const [query, setQuery] = useState("");
    const [appliedFilter, setAppliedFilter] = useState<ChefsFilterState>(() => emptyChefsFilter());
    const [rows, setRows] = useState<ChefRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const mountedRef = useRef(false);

    const reload = useCallback(async () => {
        const requestId = ++requestIdRef.current;

        const token = getTytAccessToken();
        if (!token) {
            setRows([]);
            setError("Sessão expirada. Faça login novamente.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const list = await requestOnce(`chefs:${token}`, async () => {
                return runWithRetry(
                    async () => {
                        const res = await getChefs(token, undefined);
                        const json = await parseJsonOrThrow<unknown>(res);
                        return normalizeList<ApiChef>(json);
                    },
                    { retries: 2 },
                );
            });

            if (!mountedRef.current || requestId !== requestIdRef.current) return;

            const mapped = list.map((c) => {
                const chefName = c.nome ?? "";
                const chefId = String(c.id);
                const city = c.cidade ?? "";
                const state = c.estado ?? "";

                const instagram = c.usuario_chef?.instagram ?? null;
                const usernameFromEmail = c.email ? `@${c.email.split("@")[0] ?? ""}` : "";
                const username = (instagram && instagram.trim().length > 0 ? instagram.trim() : usernameFromEmail) || `@chef_${chefId}`;

                const approved = c.usuario_chef?.cadastro_aprovado === true;
                const status: ChefRow["status"] = approved ? "ativo" : "inativo";
                const stage: ChefStage = normalizeChefStage(c.usuario_chef?.status) ?? (approved ? "ativo" : "cadastro");

                const available = (c.usuario_chef?.usuario_chef_disponivel_para ?? []).filter((x) => x?.active);
                const serviceFilterIds = available.map((x) => x.disponivel_para).filter(Boolean);
                const services = serviceFilterIds.map((id) => ({
                    label: formatServiceLabel(id),
                    color: getServiceColorById(id),
                }));

                const cityId = city ? toId(city) : "unknown";
                const location = city && state ? `${city}, ${state}` : city || state || "—";

                return {
                    id: chefId,
                    name: chefName,
                    username,
                    initials: getInitials(chefName),
                    status,
                    stage,
                    services,
                    location,
                    rating: null,
                    registeredAgo: timeAgo(c.createdAt ?? null),
                    serviceFilterIds,
                    cityFilterId: cityId,
                    avatarUrl: cleanUrl(c.foto),
                    createdAt: c.createdAt ?? null,
                };
            });

            setRows(mapped);
        } catch (err) {
            if (!mountedRef.current || requestId !== requestIdRef.current) return;
            if (err instanceof TytApiError) {
                setError(parseApiErrorMessage(err.body));
            } else if (err instanceof Error && err.message) {
                setError(err.message);
            } else {
                setError("Ocorreu um erro. Tente novamente.");
            }
            setRows([]);
        } finally {
            if (!mountedRef.current || requestId !== requestIdRef.current) return;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        void reload();
        return () => {
            mountedRef.current = false;
        };
    }, [reload]);

    const serviceOptions: ChefsFilterOption[] = useMemo(() => {
        const ids = new Set<string>();
        rows.forEach((r) => r.serviceFilterIds.forEach((id) => ids.add(id)));
        return Array.from(ids)
            .sort((a, b) => a.localeCompare(b))
            .map((id) => ({ id, label: formatServiceLabel(id) }));
    }, [rows]);

    const cityOptions: ChefsFilterOption[] = useMemo(() => {
        const map = new Map<string, string>();
        rows.forEach((r) => {
            if (!r.cityFilterId || r.cityFilterId === "unknown") return;
            const label = r.location.split(",")[0]?.trim() || r.cityFilterId;
            map.set(r.cityFilterId, label);
        });
        return Array.from(map.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, label]) => ({ id, label }));
    }, [rows]);

    const filteredChefs = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = rows.filter((c) => chefMatchesFilter(c, appliedFilter));
        if (!q) return list;
        list = list.filter((c) => c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) || c.location.toLowerCase().includes(q));
        return list;
    }, [query, appliedFilter, rows]);

    const newChefs = useMemo(() => {
        return rows.filter((c) => !isFinalChefStage(c.stage));
    }, [rows]);

    const metrics = useMemo(() => {
        const active = rows.filter((c) => c.status === "ativo").length;
        return { active, recent: newChefs.length };
    }, [rows, newChefs.length]);

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-8">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>Personal Chefs</h1>
                        {loading ? <LoadingIndicator type="line-spinner" size="sm" label="Carregando chefs..." /> : null}
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar os chefs.</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void reload()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Métricas">
                    <MetricCard label="Chefs ativos" value={loading ? "—" : String(metrics.active)} icon={ChefHat} />
                    <MetricCard label="Novos cadastros" value={loading ? "—" : String(metrics.recent)} sublabel="últimos 30 dias" icon={File06} />
                    <MetricCard
                        label="Avaliação média"
                        value={
                            <span className="inline-flex items-center gap-2">
                                —<span className="text-display-xs font-normal text-quaternary">/5</span>
                            </span>
                        }
                        icon={Star01}
                    />
                </section>

                <section className="flex flex-col gap-8">
                    <NativeSelect
                        aria-label="Seção"
                        value={selectedTab as string}
                        onChange={(e) => setSelectedTab(e.target.value)}
                        options={tabItems.map((t) => ({ label: t.label, value: t.id }))}
                        className="w-full md:hidden"
                    />

                    <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} className="hidden w-full flex-col gap-8 md:flex">
                        <Tabs.List type="underline" size="md" items={tabItems} className="w-full">
                            {(tab) => <Tabs.Item {...tab} id={tab.id} />}
                        </Tabs.List>

                        <Tabs.Panel id="todos" className="flex flex-col gap-4 outline-hidden">
                            <GestaoChefsTable
                                mode="all"
                                query={query}
                                onQueryChange={setQuery}
                                chefs={filteredChefs}
                                appliedFilter={appliedFilter}
                                onApplyFilter={setAppliedFilter}
                                cityOptions={cityOptions}
                                serviceOptions={serviceOptions}
                                loading={loading}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel id="novos" className="flex flex-col gap-4 outline-hidden">
                            {newChefs.length > 0 || loading ? (
                                <GestaoChefsTable
                                    mode="new"
                                    query={query}
                                    onQueryChange={setQuery}
                                    chefs={newChefs.filter((c) => chefMatchesFilter(c, appliedFilter))}
                                    appliedFilter={appliedFilter}
                                    onApplyFilter={setAppliedFilter}
                                    cityOptions={cityOptions}
                                    serviceOptions={serviceOptions}
                                    loading={loading}
                                />
                            ) : (
                                <NovosCadastrosEmpty />
                            )}
                        </Tabs.Panel>
                    </Tabs>

                    {/* Mobile: panels sem Tabs do Aria (evita duplicar markup complexo) */}
                    <div className="flex flex-col gap-4 md:hidden">
                        {selectedTab === "todos" ? (
                            <GestaoChefsTable
                                mode="all"
                                query={query}
                                onQueryChange={setQuery}
                                chefs={filteredChefs}
                                appliedFilter={appliedFilter}
                                onApplyFilter={setAppliedFilter}
                                cityOptions={cityOptions}
                                serviceOptions={serviceOptions}
                                loading={loading}
                            />
                        ) : newChefs.length > 0 || loading ? (
                            <GestaoChefsTable
                                mode="new"
                                query={query}
                                onQueryChange={setQuery}
                                chefs={newChefs.filter((c) => chefMatchesFilter(c, appliedFilter))}
                                appliedFilter={appliedFilter}
                                onApplyFilter={setAppliedFilter}
                                cityOptions={cityOptions}
                                serviceOptions={serviceOptions}
                                loading={loading}
                            />
                        ) : (
                            <NovosCadastrosEmpty />
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

function GestaoChefsTable({
    mode,
    query,
    onQueryChange,
    chefs,
    appliedFilter,
    onApplyFilter,
    cityOptions,
    serviceOptions,
    loading,
}: {
    mode: "all" | "new";
    query: string;
    onQueryChange: (v: string) => void;
    chefs: ChefRow[];
    appliedFilter: ChefsFilterState;
    onApplyFilter: (next: ChefsFilterState) => void;
    cityOptions: ChefsFilterOption[];
    serviceOptions: ChefsFilterOption[];
    loading?: boolean;
}) {
    return (
        <>
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-primary">
                    {mode === "new" ? "Aprovação de Novos Cadastros" : "Gestão de Chefs"}
                </h2>
                <p className="text-sm text-tertiary">
                    {mode === "new"
                        ? "Gerencie as etapas de entrada e aprove novos chefs parceiros."
                        : "Visualize, filtre e gerencie os chefs cadastrados na plataforma."}
                </p>
            </div>

            <TableCard.Root>
                <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <Input placeholder="Pesquisar chef..." value={query} onChange={onQueryChange} icon={SearchLg} className="w-full md:max-w-md" />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            color="secondary"
                            size="md"
                            iconLeading={Download02}
                            onClick={() => {
                                toast.success("Exportação de chefs iniciada!");
                                // TODO: Integrar com a API de exportação de chefs
                            }}
                        >
                            Exportar dados
                        </Button>
                        <ChefsFilterPopover applied={appliedFilter} onApply={onApplyFilter} cityOptions={cityOptions} serviceOptions={serviceOptions} />
                    </div>
                </div>

                <Table key={mode} aria-label="Lista de chefs" selectionMode="none">
                    <Table.Header>
                        <Table.Head id="nome" label="Nome" isRowHeader className="min-w-[220px]" />
                        {mode === "new" ? (
                            <Table.Head id="stage" label="Etapa" className="min-w-[160px]" />
                        ) : (
                            <Table.Head id="status" label="Status" className="min-w-[100px]" />
                        )}
                        <Table.Head id="servico" label="Serviço" className="min-w-[200px]" />
                        <Table.Head id="local" label="Localização" className="min-w-[140px]" />

                        <Table.Head id="cadastro" label="Cadastro há" className="min-w-[100px]" />
                        <Table.Head id="acao" className="w-14 min-w-[56px] !pr-4" />
                    </Table.Header>
                    <Table.Body items={loading ? Array.from({ length: 5 }).map((_, i) => ({ id: `skeleton-${i}`, isSkeleton: true } as any)) : chefs}>
                        {(item) => (
                            <Table.Row id={item.id}>
                                {item.isSkeleton ? (
                                    <>
                                        <Table.Cell>
                                            <div className="flex items-center gap-3 animate-pulse">
                                                <Skeleton variant="circular" className="size-10 shrink-0" />
                                                <div className="flex flex-col gap-2">
                                                    <Skeleton className="h-4 w-28" />
                                                    <Skeleton className="h-3 w-20" />
                                                </div>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Skeleton className="h-6 w-16" />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Skeleton className="h-6 w-24" />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Skeleton className="h-4 w-20" />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Skeleton className="h-4 w-16" />
                                        </Table.Cell>
                                        <Table.Cell className="!px-4">
                                            <div className="flex justify-end">
                                                <Skeleton className="size-8 rounded-lg" />
                                            </div>
                                        </Table.Cell>
                                    </>
                                ) : (
                                    <>
                                        <Table.Cell>
                                            <div className="flex items-center gap-3">
                                                <Avatar src={item.avatarUrl} initials={item.initials} size="md" alt={item.name} />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-primary">{item.name}</p>
                                                    <p className="truncate text-sm text-tertiary">{item.username}</p>
                                                </div>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {mode === "new" ? (
                                                <Badge size="sm" type="pill-color" color={getChefStageBadgeColor(item.stage)}>
                                                    {formatChefStageLabel(item.stage)}
                                                </Badge>
                                            ) : (
                                                <Badge size="sm" type="pill-color" color={item.status === "ativo" ? "success" : "gray"}>
                                                    {item.status === "ativo" ? "Ativo" : "Inativo"}
                                                </Badge>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex flex-wrap gap-1">
                                                {item.services.length > 0 ? (
                                                    item.services.map((s: any) => (
                                                        <Badge key={s.label} size="sm" type="pill-color" color={s.color}>
                                                            {s.label}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-sm text-tertiary">—</span>
                                                )}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{item.location}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{item.registeredAgo}</Table.Cell>
                                        <Table.Cell className="!px-4">
                                            <div className="flex justify-end">
                                                <ButtonUtility size="sm" color="tertiary" tooltip="Ver perfil" icon={Eye} href={`/chefs/${item.id}`} />
                                            </div>
                                        </Table.Cell>
                                    </>
                                )}
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </TableCard.Root>
        </>
    );
}

function NovosCadastrosEmpty() {
    return (
        <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
            <div className="flex min-h-[min(440px,70vh)] items-center justify-center px-6 py-10 md:px-8 md:py-12">
                <EmptyState size="sm" className="max-w-[352px]">
                    <EmptyState.Header pattern="circle">
                        <EmptyState.FeaturedIcon color="gray" theme="modern" icon={SearchLg} />
                    </EmptyState.Header>
                    <EmptyState.Content>
                        <h2 className="text-center text-md font-semibold text-primary">Nenhum novo cadastro</h2>
                        <EmptyState.Description>
                            Não há chefs cadastrados recentemente neste período. Os novos aparecerão aqui assim que forem aprovados.
                        </EmptyState.Description>
                    </EmptyState.Content>
                </EmptyState>
            </div>
        </div>
    );
}
