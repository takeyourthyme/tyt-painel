import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import { getKitchenOrders, type KitchenOrderListItem } from "@/lib/tyt-api/kitchen-orders";
import { getTytAccessToken } from "@/lib/tyt-api/session";

type CacheEntry<T> = { value: T; storedAt: number };

const requestCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

async function requestOnce<T>(key: string, fn: () => Promise<T>, ttlMs = 1500): Promise<T> {
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.storedAt <= ttlMs) return cached.value as T;

    const existing = inflight.get(key);
    if (existing) return (await existing) as T;

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

function cleanUrl(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const cleaned = raw.replace(/`/g, "").trim();
    return cleaned || null;
}

function formatCurrency(value: number | null): string {
    if (value === null) return "—";
    try {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch {
        return "—";
    }
}

function formatDatePtBr(dateIso: string | null): string {
    if (!dateIso) return "—";
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
}

function statusBadge(statusRaw: string | null | undefined, typeRaw: string | null | undefined): { label: string; color: BadgeColors } {
    const status = (statusRaw ?? "").trim().toUpperCase();
    if (!status) return { label: "—", color: "gray" };

    const type = (typeRaw ?? "").trim().toUpperCase();
    const isSpecial = type.includes("SPECIAL");

    if (status === "PENDING") return { label: "Aguardando match", color: "warning" };
    if (status === "IN_REVIEW") return { label: isSpecial ? "Em análise" : "Aguardando chef", color: isSpecial ? "blue" : "brand" };
    if (status === "CONFIRMED") return { label: "Confirmado", color: "success" };
    if (status === "COMPLETED") return { label: "Concluído", color: "success" };
    if (status === "DECLINED") return { label: "Chef recusou", color: "error" };
    if (status === "CANCELLED") return { label: "Cancelado", color: "error" };
    if (status === "CANCELLATION_REQUESTED") return { label: "Cancelamento solicitado", color: "warning" };

    return { label: statusRaw ?? "—", color: "gray" };
}

function typeBadge(typeRaw: string | null | undefined): { label: string; color: BadgeColors } {
    const t = (typeRaw ?? "").trim().toUpperCase();
    if (!t) return { label: "—", color: "gray" };
    const label = t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return { label, color: "gray" };
}

export type AgendaOrderRow = {
    id: string;
    code: string;
    typeLabel: string;
    typeColor: BadgeColors;
    statusLabel: string;
    statusColor: BadgeColors;
    valueLabel: string;
    cityLabel: string;
    dateLabel: string;
    chefId: number | null;
    chefName: string | null;
    chefAvatarUrl: string | null;
    rawStatus: string;
};

export type AgendaMetrics = {
    total: number;
    awaitingMatch: number;
    chefRefused: number;
};

function isRequestOrder(o: AgendaOrderRow): boolean {
    const status = o.rawStatus.trim().toUpperCase();
    if (status === "CONFIRMED") return false;
    if (status === "COMPLETED") return false;
    if (status === "CANCELLED") return false;
    return true;
}

export function useAgendaOrders() {
    const [rows, setRows] = useState<AgendaOrderRow[]>([]);
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
            const json = await requestOnce(`agenda:kitchen-orders:${token}`, async () => {
                const res = await getKitchenOrders(token);
                return parseJsonOrThrow<unknown>(res);
            });

            if (!mountedRef.current || requestId !== requestIdRef.current) return;

            const list = normalizeList<KitchenOrderListItem>(json);
            const mapped = list.map((o) => {
                const type = typeBadge(o.type);
                const status = statusBadge(o.status, o.type);
                return {
                    id: String(o.id),
                    code: o.code,
                    typeLabel: type.label,
                    typeColor: type.color,
                    statusLabel: status.label,
                    statusColor: status.color,
                    valueLabel: formatCurrency(null),
                    cityLabel: o.city || "—",
                    dateLabel: formatDatePtBr(o.event_date),
                    chefId: o.chef?.id ?? null,
                    chefName: o.chef?.nome ?? null,
                    chefAvatarUrl: cleanUrl(o.chef?.foto),
                    rawStatus: o.status,
                } satisfies AgendaOrderRow;
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

    const requests = useMemo(() => rows.filter(isRequestOrder), [rows]);
    const scheduled = useMemo(() => rows.filter((r) => !isRequestOrder(r)), [rows]);

    const metrics: AgendaMetrics = useMemo(() => {
        const total = rows.length;
        const awaitingMatch = rows.filter((r) => r.rawStatus.trim().toUpperCase() === "PENDING").length;
        const chefRefused = rows.filter((r) => r.rawStatus.trim().toUpperCase() === "DECLINED").length;
        return { total, awaitingMatch, chefRefused };
    }, [rows]);

    return { rows, requests, scheduled, metrics, loading, error, reload };
}
