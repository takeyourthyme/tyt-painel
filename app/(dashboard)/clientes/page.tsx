"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Download02, Eye, FilterLines, SearchLg, Users01 } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
import { toast } from "sonner";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Table, TableCard } from "@/components/application/table/table";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { getClientes, getUserById, putUserToggleStatus } from "@/lib/tyt-api/users";

type ClienteRow = {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    email: string | null;
    whatsapp: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    ordersCount: number | null;
};

type ClienteDetails = {
    id: string;
    name: string;
    cpf: string | null;
    birthDate: string | null;
    email: string | null;
    whatsapp: string | null;
    isActive: boolean;
    cep: string | null;
    address: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    avatarUrl: string | null;
    proofAddressUrl: string | null;
    createdAt: string | null;
};

function cleanUrl(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const cleaned = raw.replace(/`/g, "").trim();
    return cleaned || null;
}

function getRecord(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object") return null;
    return raw as Record<string, unknown>;
}

function getStringValue(obj: Record<string, unknown> | null, keys: string[]): string | null {
    if (!obj) return null;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return v;
    }
    return null;
}

function getNumberValue(obj: Record<string, unknown> | null, keys: string[]): number | null {
    if (!obj) return null;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string" && v.trim()) {
            const n = Number(v);
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
}

function coerceBool(raw: unknown, fallback: boolean): boolean {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        if (s === "true" || s === "1") return true;
        if (s === "false" || s === "0") return false;
    }
    return fallback;
}

function normalizeList<T>(json: unknown): T[] {
    if (Array.isArray(json)) return json as T[];
    const record = getRecord(json);
    const data = record ? record.data : null;
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === "object") {
        const items = (data as Record<string, unknown>).items;
        if (Array.isArray(items)) return items as T[];
    }
    const items = record ? record.items : null;
    if (Array.isArray(items)) return items as T[];
    return [];
}

function formatDatePtBr(dateIso: string | null): string {
    if (!dateIso) return "—";
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
}

function DataRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-quaternary">{label}</p>
            <p className="text-sm font-semibold text-primary">{value}</p>
        </div>
    );
}

export default function ClientesPage() {
    const [query, setQuery] = useState("");
    const [rows, setRows] = useState<ClienteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [drawer, setDrawer] = useState<{ type: "details"; id: string } | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [details, setDetails] = useState<ClienteDetails | null>(null);
    const [toggleStatusLoading, setToggleStatusLoading] = useState(false);

    const requestIdRef = useRef(0);

    const loadClientes = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        const token = getTytAccessToken();
        if (!token) {
            setRows([]);
            setError("Sessão expirada. Faça login novamente.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await getClientes(token);
            const json = await parseJsonOrThrow<unknown>(res);
            if (requestId !== requestIdRef.current) return;

            const list = normalizeList<Record<string, unknown>>(json);
            const mapped = list
                .map((x) => {
                    const r = getRecord(x);
                    if (!r) return null;
                    const id = getNumberValue(r, ["id"]);
                    const name = getStringValue(r, ["nome", "name"]);
                    if (!id || !name) return null;
                    const city = getStringValue(r, ["cidade", "city"]);
                    const state = getStringValue(r, ["estado", "state"]);
                    const email = getStringValue(r, ["email"]);
                    const whatsapp = getStringValue(r, ["whatsapp", "telefone", "phone"]);
                    const avatarUrl = cleanUrl(getStringValue(r, ["foto", "avatar", "avatarUrl"]));
                    const isActive = coerceBool(r.ativo, true);
                    const ordersCount = getNumberValue(r, ["pedidos_realizados", "orders_count", "ordersCount", "orders"]);
                    return { id: String(id), name, city, state, email, whatsapp, avatarUrl, isActive, ordersCount } satisfies ClienteRow;
                })
                .filter(Boolean) as ClienteRow[];

            setRows(mapped);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            if (err instanceof TytApiError) setError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setError(err.message);
            else setError("Ocorreu um erro. Tente novamente.");
            setRows([]);
        } finally {
            if (requestId !== requestIdRef.current) return;
            setLoading(false);
        }
    }, []);

    const loadClienteDetails = useCallback(async (id: string) => {
        const token = getTytAccessToken();
        if (!token) return;
        setDetailsLoading(true);
        setDetailsError(null);
        try {
            const res = await getUserById(id, token);
            const json = await parseJsonOrThrow<unknown>(res);
            const record = getRecord(json) ?? null;
            const obj = getRecord(record?.data) ?? record ?? null;
            if (!obj) throw new Error("Resposta inválida.");

            const clienteNested = getRecord(obj.cliente) ?? getRecord(obj.usuario_cliente) ?? getRecord(obj.usuarioCliente);
            const proofAddressUrl = cleanUrl(getStringValue(clienteNested, ["comprovante_end", "comprovanteEnd"]));

            const detail: ClienteDetails = {
                id: String(getNumberValue(obj, ["id"]) ?? id),
                name: getStringValue(obj, ["nome", "name"]) ?? "—",
                cpf: getStringValue(obj, ["cpf"]),
                birthDate: getStringValue(obj, ["data_nascimento", "birth_date", "birthDate"]),
                email: getStringValue(obj, ["email"]),
                whatsapp: getStringValue(obj, ["whatsapp", "telefone", "phone"]),
                isActive: coerceBool(obj.is_active, true),
                cep: getStringValue(obj, ["cep"]),
                address: getStringValue(obj, ["endereco", "endereço", "address"]),
                number: getStringValue(obj, ["numero", "number"]),
                complement: getStringValue(obj, ["complemento", "complement", "complemento_endereco"]),
                district: getStringValue(obj, ["bairro", "district"]),
                city: getStringValue(obj, ["cidade", "city"]),
                state: getStringValue(obj, ["estado", "state"]),
                avatarUrl: cleanUrl(getStringValue(obj, ["foto", "avatar", "avatarUrl"])),
                proofAddressUrl,
                createdAt: getStringValue(obj, ["createdAt", "created_at"]),
            };

            setDetails(detail);
        } catch (err) {
            if (err instanceof TytApiError) setDetailsError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setDetailsError(err.message);
            else setDetailsError("Ocorreu um erro. Tente novamente.");
            setDetails(null);
        } finally {
            setDetailsLoading(false);
        }
    }, []);

    const toggleClienteStatus = useCallback(async () => {
        if (!details?.id) return;
        const token = getTytAccessToken();
        if (!token) {
            toast.error("Sessão expirada. Faça login novamente.");
            return;
        }
        setToggleStatusLoading(true);
        try {
            const res = await putUserToggleStatus(details.id, token);
            const json = await parseJsonOrThrow<unknown>(res);
            const record = getRecord(json) ?? null;
            const obj = getRecord(record?.data) ?? record ?? null;
            const nextActive = obj ? coerceBool(obj.ativo, !details.isActive) : !details.isActive;

            setDetails((prev) => (prev ? { ...prev, isActive: nextActive } : prev));
            setRows((prev) => prev.map((r) => (r.id === details.id ? { ...r, isActive: nextActive } : r)));
            toast.success(nextActive ? "Cliente ativado com sucesso!" : "Cliente desativado com sucesso!");
        } catch (err) {
            if (err instanceof TytApiError) toast.error("Não foi possível alterar o status do cliente.", { description: parseApiErrorMessage(err.body) });
            else toast.error("Não foi possível alterar o status do cliente.");
        } finally {
            setToggleStatusLoading(false);
        }
    }, [details]);

    useEffect(() => {
        void loadClientes();
    }, [loadClientes]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => `${r.name} ${r.email ?? ""} ${r.whatsapp ?? ""} ${r.city ?? ""} ${r.state ?? ""}`.toLowerCase().includes(q));
    }, [query, rows]);

    const totalCount = rows.length;
    const activeCount = rows.filter((r) => r.isActive).length;

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h1 className={`${playfair.className} text-display-xs font-semibold text-primary`}>Clientes</h1>
                        {loading ? <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." /> : null}
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar os clientes.</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void loadClientes()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                <section className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-utility-brand-50">
                                    <Users01 className="size-5 text-utility-brand-600" aria-hidden />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Total de clientes na base</p>
                                    <p className="mt-4 text-display-sm font-semibold text-primary">{totalCount}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-utility-success-50">
                                    <CheckCircle className="size-5 text-utility-success-600" aria-hidden />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Clientes ativos (usando o produto)</p>
                                    <p className="mt-4 text-display-sm font-semibold text-primary">{activeCount}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="flex flex-col gap-4">
                    <div>
                        <p className="text-md font-semibold text-primary">Total de clientes</p>
                        <p className="mt-1 text-sm text-tertiary">Acompanhe os clientes cadastrados e seus dados principais.</p>
                    </div>

                    <TableCard.Root>
                        <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                            <Input
                                placeholder="Pesquisar cliente..."
                                icon={SearchLg}
                                value={query}
                                onChange={setQuery}
                                className="w-full md:max-w-md"
                            />
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button color="secondary" size="md" iconLeading={Download02} isDisabled>
                                        Exportar dados
                                    </Button>
                                    <Button color="primary" size="md" iconLeading={FilterLines} isDisabled>
                                        Filtrar
                                    </Button>
                                </div>
                            </div>

                            <Table aria-label="Clientes" selectionMode="none">
                                <Table.Header>
                                    <Table.Head id="name" label="Nome" isRowHeader className="min-w-[280px]" />
                                    <Table.Head id="status" label="Status" className="min-w-[140px]" />
                                    <Table.Head id="location" label="Localização" className="min-w-[180px]" />
                                    <Table.Head id="orders" label="Pedidos realizado" className="min-w-[160px]" />
                                    <Table.Head id="actions" label="" className="w-[56px]" />
                                </Table.Header>
                                <Table.Body items={filtered}>
                                    {(row) => (
                                        <Table.Row id={row.id}>
                                            <Table.Cell className="whitespace-nowrap text-sm font-semibold text-primary">{row.name}</Table.Cell>
                                            <Table.Cell>
                                                <Badge size="sm" type="pill-color" color={row.isActive ? "success" : "warning"}>
                                                    {row.isActive ? "Ativo" : "Inativo"}
                                                </Badge>
                                            </Table.Cell>
                                            <Table.Cell className="whitespace-nowrap text-sm text-tertiary">
                                                {row.city ? `${row.city}${row.state ? ` - ${row.state}` : ""}` : "—"}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Badge size="sm" type="pill-color" color="gray">
                                                    {row.ordersCount !== null ? String(row.ordersCount) : "—"}
                                                </Badge>
                                            </Table.Cell>
                                            <Table.Cell className="!px-4">
                                                <div className="flex justify-end">
                                                    <ButtonUtility
                                                        size="sm"
                                                        color="tertiary"
                                                        icon={Eye}
                                                        tooltip="Detalhes"
                                                        onClick={() => {
                                                            setDrawer({ type: "details", id: row.id });
                                                            void loadClienteDetails(row.id);
                                                        }}
                                                    />
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        </TableCard.Root>
                </section>
            </div>

            <SlideoutMenu isOpen={drawer !== null} isDismissable onOpenChange={(open) => (!open ? setDrawer(null) : undefined)}>
                {({ close }) => {
                    const closeAll = () => {
                        close();
                        setDrawer(null);
                        setDetails(null);
                        setDetailsError(null);
                        setDetailsLoading(false);
                    };

                    return (
                        <>
                            <SlideoutMenu.Header onClose={closeAll}>
                                <div className="flex flex-col gap-1 pr-10">
                                    <p className="text-md font-semibold text-primary">Informações do cliente</p>
                                    <p className="text-sm text-tertiary">Informações completas do cliente</p>
                                </div>
                            </SlideoutMenu.Header>

                            <SlideoutMenu.Content>
                                {detailsError ? <p className="text-sm text-error-primary">{detailsError}</p> : null}

                                {detailsLoading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." />
                                    </div>
                                ) : details ? (
                                    <div className="flex flex-col gap-4">
                                        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                            <p className="text-md font-semibold text-primary">Dados básicos</p>
                                            <div className="mt-4 grid gap-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar size="md" src={details.avatarUrl} alt={details.name} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="truncate text-sm font-semibold text-primary">{details.name}</p>
                                                            {details.createdAt ? (
                                                                <Badge size="sm" type="pill-color" color="gray">
                                                                    Cadastrado em {formatDatePtBr(details.createdAt)}
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <p className="mt-1 truncate text-sm text-tertiary">{details.email ?? "—"}</p>
                                                        <p className="mt-0.5 truncate text-sm text-tertiary">{details.whatsapp ?? "—"}</p>
                                                    </div>
                                                </div>

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <DataRow label="CPF" value={details.cpf ?? "—"} />
                                                    <DataRow label="Data de nascimento" value={formatDatePtBr(details.birthDate)} />
                                                </div>

                                                <Toggle
                                                    size="sm"
                                                    isSelected={details.isActive}
                                                    onChange={() => void toggleClienteStatus()}
                                                    isDisabled={toggleStatusLoading}
                                                    label="Cliente ativo"
                                                    hint="Status exibido conforme cadastro do cliente."
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                            <p className="text-md font-semibold text-primary">Endereço</p>
                                            <div className="mt-4 grid gap-4 sm:grid-cols-1">
                                                <DataRow label="CEP" value={details.cep ?? "—"} />
                                                <DataRow label="Logradouro" value={details.address ?? "—"} />
                                                <DataRow label="Número" value={details.number ?? "—"} />
                                                <DataRow label="Complemento" value={details.complement ?? "—"} />
                                                <DataRow label="Bairro" value={details.district ?? "—"} />
                                                <DataRow label="Cidade" value={details.city ?? "—"} />
                                                <DataRow label="Estado" value={details.state ?? "—"} />
                                            </div>

                                            {details.proofAddressUrl ? (
                                                <div className="mt-4">
                                                    <a
                                                        href={details.proofAddressUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-brand-solid text-sm font-semibold"
                                                    >
                                                        Abrir comprovante de endereço
                                                    </a>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-tertiary">—</p>
                                )}
                            </SlideoutMenu.Content>
                        </>
                    );
                }}
            </SlideoutMenu>
        </main>
    );
}
