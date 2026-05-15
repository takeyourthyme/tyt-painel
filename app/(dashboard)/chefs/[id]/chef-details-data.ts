import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import { getTytAccessToken, getTytUser, isSessionAdmin } from "@/lib/tyt-api/session";
import { getUserById, putChefUpdateStatus } from "@/lib/tyt-api/users";

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
            await sleep(baseDelayMs * Math.pow(2, attempt));
        }
    }

    throw lastError;
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
    if (!cleaned) return null;
    return cleaned;
}

function getInitials(name: string): string {
    const parts = name
        .trim()
        .split(/\s+/g)
        .filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return `${first}${last}`.toUpperCase();
}

function formatServiceLabel(value: string): string {
    return value
        .trim()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDayLabel(raw: string): string {
    const s = raw.trim().toLowerCase();
    const map: Record<string, string> = {
        segunda: "Segunda-feira",
        terca: "Terça-feira",
        terça: "Terça-feira",
        quarta: "Quarta-feira",
        quinta: "Quinta-feira",
        sexta: "Sexta-feira",
        sabado: "Sábado",
        sábado: "Sábado",
        domingo: "Domingo",
    };
    return map[s] ?? raw;
}

function safeDate(raw: unknown): Date | null {
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
    if (typeof raw !== "string" && typeof raw !== "number") return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDatePtBr(dateRaw: string | null | undefined): string {
    if (!dateRaw) return "—";
    const d = safeDate(dateRaw);
    if (!d) return "—";
    return d.toLocaleDateString("pt-BR");
}

function formatMemberSince(createdAtRaw: string | null | undefined): string {
    if (!createdAtRaw) return "—";
    const createdAt = safeDate(createdAtRaw);
    if (!createdAt) return "—";
    const diffMs = Date.now() - createdAt.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return "agora";
    if (diffMin === 1) return "1 minuto";
    if (diffMin < 60) return `${diffMin} minutos`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return "1 hora";
    if (diffHours < 24) return `${diffHours} horas`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 dia";
    if (diffDays < 30) return `${diffDays} dias`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return "1 mês";
    if (diffMonths < 12) return `${diffMonths} meses`;
    const diffYears = Math.floor(diffMonths / 12);
    return diffYears === 1 ? "1 ano" : `${diffYears} anos`;
}

export type ChefDetails = {
    id: string;
    chefUserId: number | null;
    name: string;
    email: string;
    cpf: string;
    birthDate: string;
    whatsapp: string;
    cep: string | null;
    address: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    avatarUrl: string | null;
    username: string;
    memberSinceLabel: string;
    approved: boolean;
    statusLabel: string;
    canTravel: boolean | null;
    transportType: string | null;
    school: string | null;
    about: string | null;
    languages: string[];
    specialties: string[];
    availableFor: string[];
    availability: { day: string; morning: boolean; afternoon: boolean; night: boolean }[];
};

export type ChefOrderItem = {
    id: string;
    code: string | null;
    status: string | null;
    type: string | null;
    eventDate: string | null;
};

export type ChefDetailsMetrics = {
    totalOrders: number | null;
    finishedOrders: number | null;
    cancelledOrders: number | null;
};

type ApiChefUser = {
    id: number | string;
    nome?: string | null;
    cpf?: string | null;
    data_nascimento?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    createdAt?: string | null;
    cep?: string | null;
    endereco?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    foto?: string | null;
    usuario_chef?: {
        id_user?: number | string | null;
        disponivel_viajar?: boolean | null;
        tipo_transporte?: string | null;
        instagram?: string | null;
        cadastro_aprovado?: boolean | null;
        status?: string | null;
        escola_formacao?: string | null;
        conte_sobre_voce?: string | null;
        usuario_chef_idiomas?: { idioma: string; active: boolean }[] | null;
        usuario_chef_especialidades?: { especialidade: string; active: boolean }[] | null;
        usuario_chef_disponivel_para?: { disponivel_para: string; active: boolean }[] | null;
        usuario_chef_disponibilidade?: { dia_semana: string; manha: boolean; tarde: boolean; noite: boolean; active: boolean }[] | null;
    } | null;
};

function mapChefDetails(raw: ApiChefUser): ChefDetails {
    const name = raw.nome ?? "—";
    const email = raw.email ?? "—";
    const cpf = raw.cpf ?? "—";
    const birthDate = formatDatePtBr(raw.data_nascimento ?? null);
    const whatsapp = raw.whatsapp ?? "—";

    const chef = raw.usuario_chef ?? null;
    const chefUserId =
        typeof chef?.id_user === "number"
            ? chef.id_user
            : typeof chef?.id_user === "string" && chef.id_user.trim().length > 0
                ? Number(chef.id_user)
                : null;
    const instagram = chef?.instagram ?? null;
    const usernameFromEmail = raw.email ? `@${raw.email.split("@")[0] ?? ""}` : "";
    const username = (instagram && instagram.trim().length > 0 ? instagram.trim() : usernameFromEmail) || `@chef_${raw.id}`;

    const approved = chef?.cadastro_aprovado === true;
    const statusLabel = chef?.status ?? (approved ? "active" : "pending");

    const languages = (chef?.usuario_chef_idiomas ?? []).filter((x) => x.active).map((x) => x.idioma);
    const specialties = (chef?.usuario_chef_especialidades ?? []).filter((x) => x.active).map((x) => x.especialidade);
    const availableFor = (chef?.usuario_chef_disponivel_para ?? []).filter((x) => x.active).map((x) => x.disponivel_para);
    const availability = (chef?.usuario_chef_disponibilidade ?? [])
        .filter((x) => x.active)
        .map((x) => ({ day: x.dia_semana, morning: x.manha, afternoon: x.tarde, night: x.noite }));

    return {
        id: String(raw.id),
        chefUserId: Number.isFinite(chefUserId ?? NaN) ? chefUserId : null,
        name,
        email,
        cpf,
        birthDate,
        whatsapp,
        cep: raw.cep ?? null,
        address: raw.endereco ?? null,
        number: raw.numero ?? null,
        complement: raw.complemento ?? null,
        district: raw.bairro ?? null,
        city: raw.cidade ?? null,
        state: raw.estado ?? null,
        avatarUrl: cleanUrl(raw.foto),
        username,
        memberSinceLabel: formatMemberSince(raw.createdAt ?? null),
        approved,
        statusLabel,
        canTravel: chef?.disponivel_viajar ?? null,
        transportType: chef?.tipo_transporte ?? null,
        school: chef?.escola_formacao ?? null,
        about: chef?.conte_sobre_voce ?? null,
        languages,
        specialties,
        availableFor,
        availability,
    };
}

export function useChefDetails(chefId: string) {
    const [chef, setChef] = useState<ChefDetails | null>(null);
    const [orders, setOrders] = useState<ChefOrderItem[] | null>([]);
    const [metrics, setMetrics] = useState<ChefDetailsMetrics>({ totalOrders: null, finishedOrders: null, cancelledOrders: null });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const mountedRef = useRef(false);

    const canManage = useMemo(() => isSessionAdmin(), []);

    const load = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        const token = getTytAccessToken();
        if (!token) {
            setChef(null);
            setOrders([]);
            setMetrics({ totalOrders: null, finishedOrders: null, cancelledOrders: null });
            setError("Sessão expirada. Faça login novamente.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const userJson = await requestOnce(`chef-details:user:${token}:${chefId}`, async () => {
                return runWithRetry(async () => {
                    const res = await getUserById(chefId, token);
                    return parseJsonOrThrow<ApiChefUser>(res);
                }, { retries: 2 });
            });

            if (!mountedRef.current || requestId !== requestIdRef.current) return;

            const mappedChef = mapChefDetails(userJson);
            setChef(mappedChef);
            setOrders([]);
            setMetrics({ totalOrders: null, finishedOrders: null, cancelledOrders: null });
        } catch (err) {
            if (!mountedRef.current || requestId !== requestIdRef.current) return;
            if (err instanceof TytApiError) {
                setError(parseApiErrorMessage(err.body));
            } else if (err instanceof Error && err.message) {
                setError(err.message);
            } else {
                setError("Ocorreu um erro. Tente novamente.");
            }
            setChef(null);
            setOrders([]);
            setMetrics({ totalOrders: null, finishedOrders: null, cancelledOrders: null });
        } finally {
            if (!mountedRef.current || requestId !== requestIdRef.current) return;
            setLoading(false);
        }
    }, [chefId]);

    useEffect(() => {
        mountedRef.current = true;
        void load();
        return () => {
            mountedRef.current = false;
        };
    }, [load]);

    const user = useMemo(() => getTytUser(), []);

    return { chef, orders, metrics, loading, error, reload: load, canManage, user };
}

export function useChefApprovalActions() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const update = useCallback(async (input: { chefUserId: number; approved: boolean; status: string }): Promise<boolean> => {
        const token = getTytAccessToken();
        if (!token) {
            setError("Sessão expirada. Faça login novamente.");
            return false;
        }

        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            const res = await runWithRetry(() => putChefUpdateStatus({ id_user: input.chefUserId, aprovado: input.approved, status: input.status }, token), {
                retries: 2,
            });
            await parseJsonOrThrow<unknown>(res);
            setMessage("Status atualizado com sucesso.");
            return true;
        } catch (err) {
            if (err instanceof TytApiError) {
                setError(parseApiErrorMessage(err.body));
            } else if (err instanceof Error && err.message) {
                setError(err.message);
            } else {
                setError("Ocorreu um erro. Tente novamente.");
            }
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, message, error, update };
}

export function formatAvailabilitySlot(slot: { morning: boolean; afternoon: boolean; night: boolean }): string {
    const parts: string[] = [];
    if (slot.morning) parts.push("Manhã");
    if (slot.afternoon) parts.push("Tarde");
    if (slot.night) parts.push("Noite");
    return parts.length > 0 ? parts.join(", ") : "—";
}

export function formatAvailabilityDayLabel(day: string): string {
    return formatDayLabel(day);
}

export function formatServiceChipLabel(value: string): string {
    return formatServiceLabel(value);
}
