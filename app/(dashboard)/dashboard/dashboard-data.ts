import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLocalTimeZone } from "@internationalized/date";
import type { DateValue } from "react-aria-components";
import { TytApiError, parseApiErrorMessage, parseJsonOrThrow } from "@/lib/tyt-api/errors";
import { tytFetch } from "@/lib/tyt-api/client";
import { tytEndpoints } from "@/lib/tyt-api/endpoints";
import { getTytAccessToken } from "@/lib/tyt-api/session";

export type DashboardPeriodId = "current" | "previous" | "3months" | "custom";

export type DashboardFinishedCategory = "Meal Prep" | "Get Together" | "Season Special";

export type DashboardFinishedByCategoryItem = {
    name: DashboardFinishedCategory;
    value: number;
    className: string;
};

export type DashboardMatchTimeByDayItem = {
    day: string;
    hours: number;
};

export type DashboardMetrics = {
    pendingChefApprovals: {
        value: number | null;
        trendPercent: number | null;
        trendUp: boolean | null;
    };
    serviceRequests: {
        value: number | null;
        trendPercent: number | null;
        trendUp: boolean | null;
    };
    unfinishedServices: {
        value: number | null;
        trendPercent: number | null;
        trendUp: boolean | null;
    };
    cancellationRate: {
        value: number | null;
        trendPercent: number | null;
        trendUp: boolean | null;
    };
};

export type DashboardDerivedData = {
    metrics: DashboardMetrics;
    finishedByCategory: DashboardFinishedByCategoryItem[];
    matchTimeByDay: DashboardMatchTimeByDayItem[];
};

type DashboardLoadError = {
    scope: "overview";
    message: string;
};

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        globalThis.setTimeout(() => resolve(), ms);
    });
}

function isTransientStatus(status: number): boolean {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function isTransientError(err: unknown): boolean {
    if (err instanceof TytApiError) return isTransientStatus(err.status);
    if (err instanceof TypeError) return true;
    return false;
}

async function runWithRetry<T>(fn: () => Promise<T>, options: { retries: number; baseDelayMs?: number }): Promise<T> {
    const { retries, baseDelayMs = 250 } = options;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt === retries || !isTransientError(err)) throw err;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await sleep(delay);
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

function safeDate(raw: unknown): Date | null {
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
    if (typeof raw !== "string" && typeof raw !== "number") return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function monthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

function addMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
}

function getPeriodWindow(period: DashboardPeriodId, customDate: Date | null) {
    const now = new Date();

    if (period === "current") {
        const current = monthRange(now);
        const prev = monthRange(addMonths(now, -1));
        return { current, prev };
    }

    if (period === "previous") {
        const base = addMonths(now, -1);
        const current = monthRange(base);
        const prev = monthRange(addMonths(base, -1));
        return { current, prev };
    }

    if (period === "3months") {
        const endAnchor = monthRange(now).end;
        const startAnchor = monthRange(addMonths(now, -2)).start;
        const current = { start: startAnchor, end: endAnchor };

        const prevEnd = new Date(startAnchor.getTime() - 1);
        const prevStart = monthRange(addMonths(prevEnd, -2)).start;
        const prev = { start: prevStart, end: prevEnd };
        return { current, prev };
    }

    const base = customDate ?? now;
    const current = monthRange(base);
    const prev = monthRange(addMonths(base, -1));
    return { current, prev };
}

function pctChange(current: number, prev: number): { percent: number; up: boolean } {
    if (prev <= 0) {
        if (current <= 0) return { percent: 0, up: true };
        return { percent: 100, up: true };
    }
    const raw = ((current - prev) / prev) * 100;
    const percent = Math.round(Math.abs(raw));
    return { percent, up: raw >= 0 };
}

function inRange(date: Date, start: Date, end: Date) {
    const t = date.getTime();
    return t >= start.getTime() && t <= end.getTime();
}

function getOrderStatus(order: unknown): string {
    if (!order || typeof order !== "object") return "";
    const status = (order as Record<string, unknown>).status;
    return typeof status === "string" ? status : String(status ?? "");
}

function isFinishedStatus(statusRaw: string): boolean {
    const s = statusRaw.trim().toLowerCase();
    return s === "finished" || s === "done" || s === "completed" || s === "complete";
}

function isCanceledStatus(statusRaw: string): boolean {
    const s = statusRaw.trim().toLowerCase();
    return s === "canceled" || s === "cancelled" || s === "cancellation" || s === "canceled_by_user";
}

function getOrderTypeLabel(order: unknown): DashboardFinishedCategory {
    if (!order || typeof order !== "object") return "Season Special";
    const raw = (order as Record<string, unknown>).type;
    const t = typeof raw === "string" ? raw.toLowerCase() : String(raw ?? "").toLowerCase();
    if (t.includes("meal")) return "Meal Prep";
    if (t.includes("get")) return "Get Together";
    if (t.includes("season")) return "Season Special";
    return "Season Special";
}

function getOrderDate(order: unknown): Date | null {
    if (!order || typeof order !== "object") return null;
    const obj = order as Record<string, unknown>;
    return safeDate(obj.event_date) ?? safeDate(obj.createdAt) ?? safeDate(obj.created_at) ?? null;
}

function getMatchHours(order: unknown): number | null {
    if (!order || typeof order !== "object") return null;
    const obj = order as Record<string, unknown>;

    const direct = typeof obj.match_time_hours === "number" ? obj.match_time_hours : typeof obj.matchTimeHours === "number" ? obj.matchTimeHours : null;
    if (direct !== null) return Number.isFinite(direct) ? direct : null;

    const created = safeDate(obj.createdAt) ?? safeDate(obj.created_at);
    const updated = safeDate(obj.updatedAt) ?? safeDate(obj.updated_at);
    if (!created || !updated) return null;
    const diff = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
    if (!Number.isFinite(diff) || diff < 0) return null;
    return diff;
}

function dayLabel(date: Date): string {
    return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
}

export function computeDashboardDerivedData(input: {
    chefs: unknown[] | null;
    orders: unknown[] | null;
    period: DashboardPeriodId;
    customDate: Date | null;
    now?: Date;
}): DashboardDerivedData {
    const { chefs, orders, period, customDate } = input;
    const now = input.now ?? new Date();
    const { current, prev } = getPeriodWindow(period, customDate);

    const chefsList = chefs ?? [];
    const pendingChefsNow = chefs
        ? chefsList.filter((c) => {
            if (!c || typeof c !== "object") return false;
            const obj = c as Record<string, unknown>;
            const status = typeof obj.status === "string" ? obj.status.toLowerCase() : String(obj.status ?? "").toLowerCase();
            const approved = obj.cadastro_aprovado ?? obj.aprovado ?? obj.approved;
            const isApprovedFalse = approved === false;
            return status.includes("pending") || status.includes("entrevista") || isApprovedFalse;
        }).length
        : null;

    const pendingChefsByPeriod = (window: { start: Date; end: Date }) => {
        return chefsList.filter((c) => {
            if (!c || typeof c !== "object") return false;
            const obj = c as Record<string, unknown>;
            const created = safeDate(obj.createdAt) ?? safeDate(obj.created_at);
            if (!created) return false;
            if (!inRange(created, window.start, window.end)) return false;
            const status = typeof obj.status === "string" ? obj.status.toLowerCase() : String(obj.status ?? "").toLowerCase();
            const approved = obj.cadastro_aprovado ?? obj.aprovado ?? obj.approved;
            const isApprovedFalse = approved === false;
            return status.includes("pending") || status.includes("entrevista") || isApprovedFalse;
        }).length;
    };

    const pendingChefsTrend =
        pendingChefsNow === null
            ? { percent: null as number | null, up: null as boolean | null }
            : (() => {
                const currentCount = pendingChefsByPeriod(current);
                const prevCount = pendingChefsByPeriod(prev);
                const { percent, up } = pctChange(currentCount, prevCount);
                return { percent, up };
            })();

    const ordersList = orders ?? [];
    const ordersInWindow = (window: { start: Date; end: Date }) => {
        return ordersList.filter((o) => {
            const d = getOrderDate(o);
            if (!d) return false;
            return inRange(d, window.start, window.end);
        });
    };

    const currentOrders = orders ? ordersInWindow(current) : null;
    const prevOrders = orders ? ordersInWindow(prev) : null;

    const serviceRequestsValue = currentOrders ? currentOrders.length : null;
    const serviceRequestsTrend =
        currentOrders && prevOrders ? pctChange(currentOrders.length, prevOrders.length) : { percent: null as number | null, up: null as boolean | null };

    const unfinishedCount = (list: unknown[]) =>
        list.filter((o) => {
            const status = getOrderStatus(o);
            return !isFinishedStatus(status) && !isCanceledStatus(status);
        }).length;
    const unfinishedServicesValue = currentOrders ? unfinishedCount(currentOrders) : null;
    const unfinishedServicesTrend =
        currentOrders && prevOrders
            ? pctChange(unfinishedCount(currentOrders), unfinishedCount(prevOrders))
            : { percent: null as number | null, up: null as boolean | null };

    const cancellationRateValue =
        currentOrders && currentOrders.length > 0
            ? Math.round((currentOrders.filter((o) => isCanceledStatus(getOrderStatus(o))).length / currentOrders.length) * 100)
            : currentOrders
                ? 0
                : null;

    const cancellationRateTrend =
        currentOrders && prevOrders
            ? (() => {
                const currentRate =
                    currentOrders.length > 0 ? (currentOrders.filter((o) => isCanceledStatus(getOrderStatus(o))).length / currentOrders.length) * 100 : 0;
                const prevRate = prevOrders.length > 0 ? (prevOrders.filter((o) => isCanceledStatus(getOrderStatus(o))).length / prevOrders.length) * 100 : 0;
                const { percent, up } = pctChange(Math.round(currentRate), Math.round(prevRate));
                return { percent, up };
            })()
            : { percent: null as number | null, up: null as boolean | null };

    const finishedByCategory = (() => {
        const base: DashboardFinishedByCategoryItem[] = [
            { name: "Meal Prep", value: 0, className: "text-[#22c55e]" },
            { name: "Get Together", value: 0, className: "text-[#a855f7]" },
            { name: "Season Special", value: 0, className: "text-[#f97316]" },
        ];

        if (!currentOrders) return base.map((x) => ({ ...x, value: 0 }));

        for (const o of currentOrders) {
            if (!isFinishedStatus(getOrderStatus(o))) continue;
            const label = getOrderTypeLabel(o);
            const idx = base.findIndex((b) => b.name === label);
            if (idx >= 0) base[idx] = { ...base[idx], value: base[idx].value + 1 };
        }

        return base;
    })();

    const matchTimeByDay = (() => {
        const days: Date[] = [];
        const baseDate = new Date(now);
        baseDate.setHours(0, 0, 0, 0);
        for (let i = 6; i >= 0; i--) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() - i);
            days.push(d);
        }

        return days.map((d) => {
            if (!orders) {
                return { day: dayLabel(d), hours: 0 };
            }

            const start = new Date(d);
            start.setHours(0, 0, 0, 0);
            const end = new Date(d);
            end.setHours(23, 59, 59, 999);

            const samples: number[] = [];
            for (const o of ordersList) {
                const event = getOrderDate(o);
                if (!event || !inRange(event, start, end)) continue;
                const hours = getMatchHours(o);
                if (hours === null) continue;
                samples.push(hours);
            }

            const avg = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
            return { day: dayLabel(d), hours: Math.round(avg * 100) / 100 };
        });
    })();

    return {
        metrics: {
            pendingChefApprovals: {
                value: pendingChefsNow,
                trendPercent: pendingChefsTrend.percent,
                trendUp: pendingChefsTrend.up,
            },
            serviceRequests: {
                value: serviceRequestsValue,
                trendPercent: serviceRequestsTrend.percent,
                trendUp: serviceRequestsTrend.up,
            },
            unfinishedServices: {
                value: unfinishedServicesValue,
                trendPercent: unfinishedServicesTrend.percent,
                trendUp: unfinishedServicesTrend.up,
            },
            cancellationRate: {
                value: cancellationRateValue,
                trendPercent: cancellationRateTrend.percent,
                trendUp: cancellationRateTrend.up,
            },
        },
        finishedByCategory,
        matchTimeByDay,
    };
}

function errorMessageFromUnknown(err: unknown): string {
    if (err instanceof TytApiError) return parseApiErrorMessage(err.body);
    if (err instanceof Error && err.message) return err.message;
    return "Ocorreu um erro. Tente novamente";
}

function getRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
}

function normalizeOverviewPayload(raw: unknown): Record<string, unknown> | null {
    const obj = getRecord(raw);
    if (!obj) return null;
    const data = getRecord(obj.data);
    return data ?? obj;
}

function formatDateYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

type OverviewTempo = "mes_atual" | "mes_anterior" | "ultimos_3" | "periodo";

function buildOverviewBody(
    period: DashboardPeriodId,
    customRange: { start: Date; end: Date } | null,
): { tempo: OverviewTempo; inicio?: string; fim?: string } {
    if (period === "current") return { tempo: "mes_atual" };
    if (period === "previous") return { tempo: "mes_anterior" };
    if (period === "3months") return { tempo: "ultimos_3" };

    if (!customRange) return { tempo: "mes_atual" };
    return { tempo: "periodo", inicio: formatDateYmd(customRange.start), fim: formatDateYmd(customRange.end) };
}

function emptyDerived(): DashboardDerivedData {
    return {
        metrics: {
            pendingChefApprovals: { value: null, trendPercent: null, trendUp: null },
            serviceRequests: { value: null, trendPercent: null, trendUp: null },
            unfinishedServices: { value: null, trendPercent: null, trendUp: null },
            cancellationRate: { value: null, trendPercent: null, trendUp: null },
        },
        finishedByCategory: [
            { name: "Meal Prep", value: 0, className: "text-[#22c55e]" },
            { name: "Get Together", value: 0, className: "text-[#a855f7]" },
            { name: "Season Special", value: 0, className: "text-[#f97316]" },
        ],
        matchTimeByDay: [],
    };
}

function mapOverviewToDerived(raw: unknown): DashboardDerivedData {
    const obj = normalizeOverviewPayload(raw) ?? {};
    const metrics = emptyDerived().metrics;

    const pendingChefs = typeof obj.pending_chefs === "number" ? obj.pending_chefs : Number(obj.pending_chefs);
    const serviceRequests = typeof obj.service_requests === "number" ? obj.service_requests : Number(obj.service_requests);
    const unfinishedServices = typeof obj.unfinished_services === "number" ? obj.unfinished_services : Number(obj.unfinished_services);
    const cancellationRate = typeof obj.cancelation_rate === "number" ? obj.cancelation_rate : Number(obj.cancelation_rate);

    const finishedByCategoryBase: DashboardFinishedByCategoryItem[] = [
        { name: "Meal Prep", value: 0, className: "text-[#22c55e]" },
        { name: "Get Together", value: 0, className: "text-[#a855f7]" },
        { name: "Season Special", value: 0, className: "text-[#f97316]" },
    ];

    const finishedRaw = obj.finished_services_chart;
    const finishedList = Array.isArray(finishedRaw) ? finishedRaw : [];
    for (const item of finishedList) {
        const r = getRecord(item);
        if (!r) continue;
        const type = typeof r.type === "string" ? r.type.trim().toUpperCase() : String(r.type ?? "").trim().toUpperCase();
        const total = typeof r.total === "number" ? r.total : Number(r.total);
        if (!Number.isFinite(total)) continue;
        const label: DashboardFinishedCategory | null =
            type === "MEAL_PREP" ? "Meal Prep" : type.includes("TOGETHER") ? "Get Together" : type.includes("SPECIAL") ? "Season Special" : null;
        if (!label) continue;
        const idx = finishedByCategoryBase.findIndex((x) => x.name === label);
        if (idx >= 0) finishedByCategoryBase[idx] = { ...finishedByCategoryBase[idx], value: total };
    }

    const matchRaw = obj.match_time_chart;
    const matchList = Array.isArray(matchRaw) ? matchRaw : [];
    const matchTimeByDay = matchList
        .map((x) => {
            const r = getRecord(x);
            if (!r) return null;
            const day = typeof r.label === "string" ? r.label : typeof r.day === "string" ? r.day : null;
            const hours = typeof r.average_hours === "number" ? r.average_hours : Number(r.average_hours);
            if (!day || !Number.isFinite(hours)) return null;
            return { day, hours: Math.round(hours * 100) / 100 } satisfies DashboardMatchTimeByDayItem;
        })
        .filter(Boolean) as DashboardMatchTimeByDayItem[];

    return {
        metrics: {
            pendingChefApprovals: { ...metrics.pendingChefApprovals, value: Number.isFinite(pendingChefs) ? pendingChefs : null },
            serviceRequests: { ...metrics.serviceRequests, value: Number.isFinite(serviceRequests) ? serviceRequests : null },
            unfinishedServices: { ...metrics.unfinishedServices, value: Number.isFinite(unfinishedServices) ? unfinishedServices : null },
            cancellationRate: { ...metrics.cancellationRate, value: Number.isFinite(cancellationRate) ? cancellationRate : null },
        },
        finishedByCategory: finishedByCategoryBase,
        matchTimeByDay,
    };
}

async function fetchDashboardOverview(token: string, body: { tempo: OverviewTempo; inicio?: string; fim?: string }) {
    const key = `dashboard:overview:${token}:${JSON.stringify(body)}`;
    return requestOnce(key, async () => {
        const res = await runWithRetry(() => tytFetch(tytEndpoints.dashboard.overview, { method: "PUT", token, json: body }), { retries: 2 });
        return parseJsonOrThrow<unknown>(res);
    });
}

export function useDashboardData(period: DashboardPeriodId, customDateValue: unknown) {
    const [derived, setDerived] = useState<DashboardDerivedData>(() => emptyDerived());
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<DashboardLoadError[]>([]);
    const requestIdRef = useRef(0);
    const mountedRef = useRef(false);

    const customRange = useMemo(() => {
        if (!customDateValue || typeof customDateValue !== "object") return null;
        const range = customDateValue as { start?: DateValue; end?: DateValue };
        if (!range.start || !range.end) return null;
        try {
            const start = range.start.toDate(getLocalTimeZone());
            const end = range.end.toDate(getLocalTimeZone());
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
            return { start, end };
        } catch {
            return null;
        }
    }, [customDateValue]);

    const reload = useCallback(async () => {
        const requestId = ++requestIdRef.current;

        const token = getTytAccessToken();
        if (!token) {
            setDerived(emptyDerived());
            setErrors([{ scope: "overview", message: "Sessão expirada. Faça login novamente" }]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setErrors([]);

        const body = buildOverviewBody(period, customRange);
        const settled = await Promise.allSettled([fetchDashboardOverview(token, body)]);
        if (!mountedRef.current || requestId !== requestIdRef.current) return;

        const nextErrors: DashboardLoadError[] = [];

        const [overviewRes] = settled;
        if (overviewRes.status === "fulfilled") {
            setDerived(mapOverviewToDerived(overviewRes.value));
        } else {
            setDerived(emptyDerived());
            nextErrors.push({ scope: "overview", message: errorMessageFromUnknown(overviewRes.reason) });
        }

        setErrors(nextErrors);
        setLoading(false);
    }, [customRange, period]);

    useEffect(() => {
        mountedRef.current = true;
        void reload();
        return () => {
            mountedRef.current = false;
        };
    }, [reload]);

    return { loading, errors, derived, reload };
}
