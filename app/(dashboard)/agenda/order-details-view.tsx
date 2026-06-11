"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Edit02, Mail01, Plus, ReceiptCheck, Trash01, X as CloseIcon } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { toast } from "sonner";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { Table, TableCard } from "@/components/application/table/table";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import { getKitchenOrderByCode, putKitchenOrderAssignChef, putKitchenOrderCancel, putKitchenOrderSpecialServiceProposal } from "@/lib/tyt-api/kitchen-orders";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { getChefs } from "@/lib/tyt-api/users";
import { cx } from "@/utils/cx";
import { ChefHat } from "lucide-react";

const playfair = Playfair_Display({
    subsets: ["latin"],
    weight: ["600"],
    display: "swap",
});

type KitchenOrderDetails = {
    id: number | null;
    code: string;
    type: string;
    status: string;
    eventDate: string | null;
    eventTime: string | null;
    peopleQuantity: number | null;
    city: string | null;
    address: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    observations: string | null;
    clientRequest: string | null;
    dishes: Array<{
        id: number | null;
        name: string;
        quantity: number | null;
        category: string | null;
        observations: string | null;
        mainIngredients: string[];
        cuisineTypes: string[];
        themes: string[];
    }>;
    proposalStatus: string | null;
    proposalItems: { description: string; price: number }[];
    cliente: { id: number; nome: string; email: string | null; whatsapp: string | null } | null;
    chef: { id: number; nome: string; foto: string | null } | null;
    themes: string[];
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

function getStringValue(obj: Record<string, unknown> | null | undefined, keys: string[]): string | null {
    if (!obj) return null;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim().length > 0) return v;
    }
    return null;
}

function getNumberValue(obj: Record<string, unknown> | null | undefined, keys: string[]): number | null {
    if (!obj) return null;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string" && v.trim().length > 0) {
            const n = Number(v);
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
}

function normalizeDetailsResponse(raw: unknown): Record<string, unknown> | null {
    const obj = getRecord(raw);
    if (!obj) return null;
    const inner = obj.data;
    const innerObj = getRecord(inner);
    return innerObj ?? obj;
}

function formatDatePtBr(dateIso: string | null): string {
    if (!dateIso) return "—";
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
}

function formatTimeLabel(raw: string | null): string {
    if (!raw) return "—";
    const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return raw;
    return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function formatServiceLabel(typeRaw: string): string {
    const t = typeRaw.trim().replace(/_/g, " ").toLowerCase();
    return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value: number | null): string {
    if (value === null) return "—";
    try {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch {
        return "—";
    }
}

function parsePriceValue(raw: string): number | null {
    const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return n;
}

function statusBadge(
    statusRaw: string,
    typeRaw: string,
): { label: string; color: "success" | "warning" | "error" | "gray" | "blue" | "brand" } {
    const status = statusRaw.trim().toUpperCase();
    if (!status) return { label: "—", color: "gray" };
    const type = typeRaw.trim().toUpperCase();
    const isSpecial = type.includes("SPECIAL");
    if (status === "PENDING") return { label: "Aguardando match", color: "blue" };
    if (status === "IN_REVIEW") return { label: isSpecial ? "Em análise" : "Aguardando chef", color: "warning" };
    if (status === "CONFIRMED") return { label: "Confirmado", color: "brand" };
    if (status === "COMPLETED") return { label: "Concluído", color: "success" };
    if (status === "FINALIZED") return { label: "Concluído", color: "success" };
    if (status === "DECLINED") return { label: "Chef recusou", color: "error" };
    if (status === "CANCELLED") return { label: "Cancelado", color: "error" };
    if (status === "CANCELLATION_REQUESTED") return { label: "Cancelamento solicitado", color: "error" };
    return { label: statusRaw, color: "gray" };
}

function proposalBadge(statusRaw: string | null): { label: string; color: "success" | "warning" | "error" | "gray" } {
    const status = (statusRaw ?? "").trim().toUpperCase();
    if (!status) return { label: "—", color: "gray" };
    if (status === "AWAITING_CLIENT") return { label: "Aguardando cliente", color: "warning" };
    if (status === "ACCEPTED") return { label: "Proposta aprovada", color: "success" };
    if (status === "DECLINED") return { label: "Proposta recusada", color: "error" };
    return { label: statusRaw ?? "—", color: "gray" };
}

function isSpecialService(typeRaw: string): boolean {
    return typeRaw.trim().toUpperCase().includes("SPECIAL");
}

function getDishObservation(dishName: string, orderObservations: string | null): string | null {
    if (!orderObservations) return null;
    const lines = orderObservations.split("\n");
    for (const line of lines) {
        const parts = line.split(":");
        if (parts.length >= 2) {
            const namePart = parts[0].trim().toLowerCase();
            const notePart = parts.slice(1).join(":").trim();
            if (dishName.toLowerCase().includes(namePart) || namePart.includes(dishName.toLowerCase())) {
                return notePart;
            }
        }
        const partsHyphen = line.split("-");
        if (partsHyphen.length >= 2) {
            const namePart = partsHyphen[0].trim().toLowerCase();
            const notePart = partsHyphen.slice(1).join("-").trim();
            if (dishName.toLowerCase().includes(namePart) || namePart.includes(dishName.toLowerCase())) {
                return notePart;
            }
        }
    }
    return null;
}

function mapKitchenOrderDetails(raw: unknown): KitchenOrderDetails {
    const obj = normalizeDetailsResponse(raw) ?? {};
    const id = getNumberValue(obj, ["id"]);
    const code = getStringValue(obj, ["code"]) ?? "—";
    const type = getStringValue(obj, ["type"]) ?? "—";
    const status = getStringValue(obj, ["status"]) ?? "—";
    const eventDate = getStringValue(obj, ["event_date", "eventDate"]);
    const eventTime = getStringValue(obj, ["event_time", "eventTime"]);
    const peopleQuantity = getNumberValue(obj, ["people_quantity", "peopleQuantity"]);
    const city = getStringValue(obj, ["city", "cidade"]);
    const address = getStringValue(obj, ["address", "endereco", "endereço"]);
    const number = getStringValue(obj, ["number", "numero"]);
    const complement = getStringValue(obj, ["complement", "complemento"]);
    const district = getStringValue(obj, ["district", "bairro"]);
    const observations = getStringValue(obj, ["observations", "observacao", "observação"]);
    const clientRequest = getStringValue(obj, ["client_request", "clientRequest", "solicitacao_cliente", "solicitacao", "pedido_cliente"]);

    const dishesRaw = (obj.dishes ?? obj.pratos ?? obj.menu) as unknown;
    const dishesList = Array.isArray(dishesRaw) ? dishesRaw : [];
    const dishes = dishesList
        .map((x) => {
            const r = getRecord(x);
            if (!r) return null;
            const dish = getRecord(r.dish) ?? getRecord(r.prato);
            const name =
                getStringValue(dish ?? r, ["nome_prato", "descricao", "nome", "name", "title"]) ??
                getStringValue(r, ["descricao", "nome", "name", "title"]) ??
                null;
            if (!name) return null;
            const id = getNumberValue(dish ?? r, ["id", "dish_id", "prato_id"]);
            const quantity = getNumberValue(r, ["quantity", "quantidade"]);

            // Categorias
            const catsList = (dish?.pratos_categorias ?? dish?.categorias) as unknown[];
            const category = Array.isArray(catsList) && catsList.length > 0
                ? getStringValue(getRecord(getRecord(catsList[0])?.categoria), ["descricao"])
                : null;

            // Ingredientes principais
            const mainIngsList = (dish?.pratos_ingredientes_principais ?? dish?.ingredientes_principais) as unknown[];
            const mainIngredients = Array.isArray(mainIngsList)
                ? (mainIngsList.map(item => getStringValue(getRecord(getRecord(item)?.ingrediente_principal), ["descricao"])).filter(Boolean) as string[])
                : [];

            // Tipos de cozinha
            const cuisinesList = (dish?.pratos_tipos_cozinha ?? dish?.tipos_cozinha) as unknown[];
            const cuisineTypes = Array.isArray(cuisinesList)
                ? (cuisinesList.map(item => getStringValue(getRecord(getRecord(item)?.tipo_cozinha), ["descricao"])).filter(Boolean) as string[])
                : [];

            // Temas
            const themesList = (dish?.pratos_temas ?? dish?.temas) as unknown[];
            const themes = Array.isArray(themesList)
                ? (themesList.map(item => getStringValue(getRecord(getRecord(item)?.tema), ["nome", "descricao"])).filter(Boolean) as string[])
                : [];

            // Observações/restrições
            const localObs =
                getStringValue(r, ["notes", "observations", "observacao", "observação", "personalizacao"]) ??
                getDishObservation(name, observations);

            return {
                id,
                name,
                quantity,
                category,
                observations: localObs,
                mainIngredients,
                cuisineTypes,
                themes,
            };
        })
        .filter(Boolean) as Array<{
            id: number | null;
            name: string;
            quantity: number | null;
            category: string | null;
            observations: string | null;
            mainIngredients: string[];
            cuisineTypes: string[];
            themes: string[];
        }>;

    const clienteRaw = getRecord(obj.cliente) ?? getRecord(obj.client);
    const cliente = clienteRaw
        ? {
            id: getNumberValue(clienteRaw, ["id"]) ?? 0,
            nome: getStringValue(clienteRaw, ["nome", "name"]) ?? "—",
            email: getStringValue(clienteRaw, ["email"]),
            whatsapp: getStringValue(clienteRaw, ["whatsapp", "telefone", "phone"]),
        }
        : null;

    const chefRaw = getRecord(obj.chef);
    const chef = chefRaw
        ? {
            id: getNumberValue(chefRaw, ["id"]) ?? 0,
            nome: getStringValue(chefRaw, ["nome", "name"]) ?? "—",
            foto: cleanUrl(getStringValue(chefRaw, ["foto", "avatar", "avatarUrl"])),
        }
        : null;

    const proposalRaw =
        getRecord(obj.special_service_proposal) ??
        getRecord(obj.specialServiceProposal) ??
        getRecord(obj.proposal) ??
        getRecord(obj.proposta_servico) ??
        getRecord(obj.proposta);
    const proposalStatus = proposalRaw ? getStringValue(proposalRaw, ["status", "proposal_status", "proposalStatus"]) : null;
    const proposalItemsRaw = (proposalRaw?.items ?? proposalRaw?.itens ?? obj.special_service_proposal_items ?? obj.proposal_items) as unknown;
    const proposalItemsList = Array.isArray(proposalItemsRaw) ? proposalItemsRaw : [];
    const proposalItemsFromProposal = proposalItemsList
        .map((x) => {
            const r = getRecord(x);
            if (!r) return null;
            const description = getStringValue(r, ["description", "descricao", "item", "nome"]);
            const price = getNumberValue(r, ["price", "valor"]);
            if (!description || price === null) return null;
            return { description, price };
        })
        .filter(Boolean) as { description: string; price: number }[];

    const proposalsRaw = obj.proposals as unknown;
    const proposalsList = Array.isArray(proposalsRaw) ? proposalsRaw : [];
    const proposalItemsFromProposals = proposalsList
        .map((x) => {
            const r = getRecord(x);
            if (!r) return null;
            const description = getStringValue(r, ["item", "description", "descricao", "nome"]);
            const price = getNumberValue(r, ["value", "valor", "price"]);
            if (!description || price === null) return null;
            return { description, price };
        })
        .filter(Boolean) as { description: string; price: number }[];

    const proposalItems = proposalItemsFromProposal.length ? proposalItemsFromProposal : proposalItemsFromProposals;
    const proposalStatusFromProposals = proposalItemsFromProposals.length > 0 ? "AWAITING_CLIENT" : null;

    const rootThemesRaw = obj.temas as unknown;
    const rootThemesList = Array.isArray(rootThemesRaw) ? rootThemesRaw : [];
    const rootThemes = rootThemesList
        .map((t) => getStringValue(getRecord(t), ["nome", "descricao"]))
        .filter(Boolean) as string[];

    return {
        id,
        code,
        type,
        status,
        eventDate,
        eventTime,
        peopleQuantity,
        city,
        address,
        number,
        complement,
        district,
        observations,
        clientRequest,
        dishes,
        proposalStatus: proposalStatus ?? proposalStatusFromProposals,
        proposalItems,
        cliente,
        chef,
        themes: rootThemes,
    };
}

type ChefOption = { id: string; label: string; avatarUrl?: string };

function DataRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-quaternary">{label}</p>
            <p className="text-sm font-semibold text-primary">{value}</p>
        </div>
    );
}

export function OrderDetailsView({ code, backHref }: { code: string; backHref: string }) {
    const router = useRouter();
    const [order, setOrder] = useState<KitchenOrderDetails | null>(null);
    const [chefs, setChefs] = useState<ChefOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openCancel, setOpenCancel] = useState(false);
    const [openProposal, setOpenProposal] = useState(false);
    const [openProposalSendConfirm, setOpenProposalSendConfirm] = useState(false);
    const [proposalDraft, setProposalDraft] = useState<Array<{ description: string; price: string }>>([]);
    const [proposalPreviewItems, setProposalPreviewItems] = useState<Array<{ description: string; price: number }>>([]);
    const requestIdRef = useRef(0);

    const load = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        const token = getTytAccessToken();
        if (!token) {
            setError("Sessão expirada. Faça login novamente.");
            setOrder(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await getKitchenOrderByCode(code, token);
            const json = await parseJsonOrThrow<unknown>(res);
            if (requestId !== requestIdRef.current) return;
            setOrder(mapKitchenOrderDetails(json));

            const chefsRes = await getChefs(token);
            const chefsJson = await parseJsonOrThrow<unknown>(chefsRes);
            if (requestId !== requestIdRef.current) return;

            const list = Array.isArray((chefsJson as any)?.data) ? ((chefsJson as any).data as unknown[]) : (chefsJson as any);
            const normalized = Array.isArray(list) ? list : [];
            const options = normalized
                .map((x) => {
                    const r = getRecord(x);
                    if (!r) return null;
                    const id = getNumberValue(r, ["id"]);
                    const nome = getStringValue(r, ["nome", "name"]);
                    if (!id || !nome) return null;
                    const avatarUrl = cleanUrl(getStringValue(r, ["foto", "avatar", "avatarUrl"]));
                    return { id: String(id), label: nome, avatarUrl: avatarUrl ?? undefined } satisfies ChefOption;
                })
                .filter(Boolean) as ChefOption[];
            setChefs(options);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            if (err instanceof TytApiError) setError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setError(err.message);
            else setError("Ocorreu um erro. Tente novamente.");
            setOrder(null);
        } finally {
            if (requestId !== requestIdRef.current) return;
            setLoading(false);
        }
    }, [code]);

    useEffect(() => {
        void load();
    }, [load]);

    const badge = useMemo(() => statusBadge(order?.status ?? "", order?.type ?? ""), [order?.status, order?.type]);
    const proposal = useMemo(() => proposalBadge(order?.proposalStatus ?? null), [order?.proposalStatus]);
    const chefSelectedKey = order?.chef?.id ? String(order.chef.id) : null;
    const isSpecial = order ? isSpecialService(order.type) : false;
    const canSendProposal = isSpecial && !!order?.id ? order.proposalItems.length === 0 || (order.proposalStatus ?? "").trim().toUpperCase() === "DECLINED" : false;
    const proposalItems = order?.proposalItems?.length ? order.proposalItems : proposalPreviewItems;
    const canConfirmSendProposal = canSendProposal && proposalItems.length > 0;

    const isGetTogether = useMemo(() => {
        if (!order) return false;
        return order.type.trim().toUpperCase().includes("TOGETHER") || order.type.trim().toUpperCase().includes("TOGHETER");
    }, [order]);

    const groupedCategories = useMemo(() => {
        if (!order || !order.dishes) return [];
        const groups: Record<string, typeof order.dishes> = {};

        order.dishes.forEach((d) => {
            const cat = d.category || "Outros";
            let groupName = cat;
            if (cat.toLowerCase() === "entradas" || cat.toLowerCase() === "entrada") {
                groupName = "Entrada";
            } else if (cat.toLowerCase() === "saladas" || cat.toLowerCase() === "salada") {
                groupName = "Saladas";
            } else if (cat.toLowerCase() === "pratos principais" || cat.toLowerCase() === "prato principal" || cat.toLowerCase() === "pratos_principais" || cat.toLowerCase() === "principais" || cat.toLowerCase() === "principal") {
                groupName = "Pratos principais";
            } else if (cat.toLowerCase() === "sobremesas" || cat.toLowerCase() === "sobremesa") {
                groupName = "Sobremesas";
            } else {
                groupName = cat.charAt(0).toUpperCase() + cat.slice(1);
            }

            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(d);
        });

        const orderOfCats = ["Entrada", "Saladas", "Pratos principais", "Sobremesas"];
        return Object.entries(groups).sort((a, b) => {
            const idxA = orderOfCats.indexOf(a[0]);
            const idxB = orderOfCats.indexOf(b[0]);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a[0].localeCompare(b[0]);
        });
    }, [order]);

    const { mainIngredientsLabel, cuisineTypesLabel, themesLabel, serviceLevelLabel } = useMemo(() => {
        if (!order || !order.dishes) {
            return {
                mainIngredientsLabel: "—",
                cuisineTypesLabel: "—",
                themesLabel: "—",
                serviceLevelLabel: "—",
            };
        }
        const uniqueMainIngredients = Array.from(new Set(order.dishes.flatMap(d => d.mainIngredients)));
        const uniqueCuisineTypes = Array.from(new Set(order.dishes.flatMap(d => d.cuisineTypes)));
        const uniqueThemes = Array.from(new Set([...(order.themes ?? []), ...order.dishes.flatMap(d => d.themes)]));

        return {
            mainIngredientsLabel: uniqueMainIngredients.length > 0 ? uniqueMainIngredients.join(", ") : "—",
            cuisineTypesLabel: uniqueCuisineTypes.length > 0 ? uniqueCuisineTypes.join(", ") : "—",
            themesLabel: uniqueThemes.length > 0 ? uniqueThemes.join(", ") : "—",
            serviceLevelLabel: order.dishes.length > 5 ? "Banquete" : "Clássico",
        };
    }, [order]);

    return (
        <main className="min-h-0 flex-1 bg-primary px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                        <Link href="/agenda" className="font-medium hover:text-tertiary_hover">
                            Agenda serviços
                        </Link>
                        <span className="text-quaternary">›</span>
                        <Link href={backHref} className="font-medium hover:text-tertiary_hover">
                            {backHref.includes("servicos-agendados") ? "Serviços agendados" : "Solicitações"}
                        </Link>
                        <span className="text-quaternary">›</span>
                        <span className="font-medium text-secondary">{order?.code}</span>
                    </nav>

                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>Ordem</h1>
                            <p className="mt-1 text-sm text-tertiary">Acompanhe o status e os detalhes da solicitação.</p>
                        </div>
                        {order && !["CANCELLED", "FINALIZED", "COMPLETED"].includes(order.status?.trim().toUpperCase()) && (
                            <Button color="primary" size="md" iconLeading={CloseIcon} onClick={() => setOpenCancel(true)} isDisabled={loading}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar a ordem.</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void load()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                {order ? (
                    <>
                        <section className="overflow-hidden rounded-xl border border-secondary bg-secondary_alt shadow-xs">
                            <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    <FeaturedIcon color="gray" icon={ChefHat} theme="light" size="md" className="bg-secondary_alt" />
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-primary">{formatServiceLabel(order.type)}</p>
                                            <Badge size="sm" type="pill-color" color={badge.color}>
                                                {badge.label}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-sm text-tertiary">#{order.code}</p>
                                    </div>
                                </div>

                                <div className="w-full md:w-[360px]">
                                    <p className="text-sm font-medium text-secondary">
                                        Chef Responsável<span className="text-error-primary">*</span>
                                    </p>
                                    <div className="mt-2">
                                        <Select
                                            aria-label="Chef Responsável"
                                            size="md"
                                            items={chefs}
                                            selectedKey={chefSelectedKey ?? undefined}
                                            placeholder="Escolher chef..."
                                            isDisabled={loading}
                                            onSelectionChange={async (key) => {
                                                if (key === null) return;
                                                const token = getTytAccessToken();
                                                if (!token) {
                                                    toast.error("Sessão expirada. Faça login novamente.");
                                                    return;
                                                }
                                                try {
                                                    const res = await putKitchenOrderAssignChef(code, { id_usuario_chef: Number(key) }, token);
                                                    await parseJsonOrThrow<unknown>(res);
                                                    toast.success("Chef associado com sucesso!");
                                                    await load();
                                                } catch (err) {
                                                    if (err instanceof TytApiError) toast.error("Não foi possível associar o chef.", { description: parseApiErrorMessage(err.body) });
                                                    else toast.error("Não foi possível associar o chef.");
                                                }
                                            }}
                                        >
                                            {(item) => <Select.Item {...item} />}
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                            <div className="border-b border-secondary px-6 py-5">
                                <p className="text-sm font-semibold text-primary">Detalhes atendimento</p>
                            </div>
                            <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
                                <DataRow label="Data" value={formatDatePtBr(order.eventDate)} />
                                <DataRow label="Horário" value={formatTimeLabel(order.eventTime)} />
                                <DataRow label="Pessoas" value={order.peopleQuantity !== null ? String(order.peopleQuantity) : "—"} />
                                <DataRow label="Cidade" value={order.city || "—"} />
                                <DataRow label="Endereço" value={order.address || "—"} />
                                <DataRow label="Número" value={order.number || "—"} />
                                <DataRow label="Complemento" value={order.complement || "—"} />
                                <DataRow label="Bairro" value={order.district || "—"} />
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                            {isSpecial ? (
                                <>
                                    <div className="border-b border-secondary px-6 py-5">
                                        <p className="text-sm font-semibold text-primary">Solicitação cliente</p>
                                    </div>
                                    <div className="flex flex-col gap-4 px-6 py-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <p className="text-sm text-tertiary">{order.clientRequest || "—"}</p>
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                isDisabled={!canConfirmSendProposal || loading || !order.id}
                                                onClick={() => setOpenProposalSendConfirm(true)}
                                            >
                                                Enviar proposta
                                            </Button>
                                        </div>

                                        <TableCard.Root className="border border-secondary bg-primary shadow-none ring-0">
                                            <div className="flex items-center justify-between border-b border-secondary px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-primary">Proposta de Serviço</p>
                                                    <Badge size="sm" type="pill-color" color={proposal.color}>
                                                        {proposal.label}
                                                    </Badge>
                                                </div>
                                                <ButtonUtility
                                                    size="sm"
                                                    color="tertiary"
                                                    icon={Edit02}
                                                    tooltip="Editar"
                                                    onClick={() => {
                                                        const existing = proposalItems.map((i) => ({ description: i.description, price: String(i.price) }));
                                                        setProposalDraft(existing.length > 0 ? existing : [{ description: "", price: "" }]);
                                                        setOpenProposal(true);
                                                    }}
                                                />
                                            </div>

                                            {proposalItems.length > 0 ? (
                                                <Table aria-label="Itens da Proposta" selectionMode="none">
                                                    <Table.Header>
                                                        <Table.Head id="description" label="Item" className="min-w-[200px]" isRowHeader />
                                                        <Table.Head id="price" label="Valor" className="min-w-[120px]" />
                                                    </Table.Header>
                                                    <Table.Body items={proposalItems.map((item, idx) => ({ ...item, id: `${idx}-${item.description}` }))}>
                                                        {(item) => (
                                                            <Table.Row id={item.id}>
                                                                <Table.Cell className="text-secondary">{item.description}</Table.Cell>
                                                                <Table.Cell className="text-tertiary">{formatCurrency(item.price)}</Table.Cell>
                                                            </Table.Row>
                                                        )}
                                                    </Table.Body>
                                                </Table>
                                            ) : (
                                                <div className="px-4 py-4">
                                                    <p className="text-sm text-tertiary">Nenhuma proposta criada.</p>
                                                </div>
                                            )}
                                        </TableCard.Root>
                                    </div>
                                </>
                            ) : isGetTogether ? (
                                <>
                                    <div className="flex items-center justify-between border-b border-secondary px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-primary">Menu Planejado</p>
                                            <Badge size="sm" type="pill-color" color="blue">
                                                {order.dishes.length} {order.dishes.length === 1 ? "prato" : "pratos"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-6 px-6 py-5">
                                        {/* Metadata Row */}
                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-medium text-quaternary">Ingrediente Principal</span>
                                                <Badge size="sm" type="pill-color" color="gray" className="w-max">
                                                    {mainIngredientsLabel}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-medium text-quaternary">Tipo de cozinha</span>
                                                <Badge size="sm" type="pill-color" color="gray" className="w-max">
                                                    {cuisineTypesLabel}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-medium text-quaternary">Tema</span>
                                                <Badge size="sm" type="pill-color" color="gray" className="w-max">
                                                    {themesLabel}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-medium text-quaternary">Niver serviço</span>
                                                <Badge size="sm" type="pill-color" color="gray" className="w-max">
                                                    {serviceLevelLabel}
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Grouped Dishes List with Grey Background Container */}
                                        <div className="flex flex-col gap-5 rounded-xl bg-secondary_alt p-5 border border-secondary">
                                            {groupedCategories.map(([categoryName, categoryDishes], catIdx) => (
                                                <div key={categoryName} className="flex flex-col gap-3">
                                                    <span className="text-xs font-semibold text-tertiary uppercase tracking-wider">{categoryName}</span>
                                                    <div className="flex flex-col gap-3 pl-1">
                                                        {categoryDishes.map((d, dishIdx) => (
                                                            <div key={`${d.id ?? "dish"}-${dishIdx}`} className="flex flex-col gap-1">
                                                                <span className="text-sm font-semibold text-primary">{d.name}</span>
                                                                {d.observations && (
                                                                    <span className="inline-flex w-max items-center rounded-md border border-utility-warning-200 bg-utility-warning-50 px-2 py-0.5 text-xs font-medium text-utility-warning-700">
                                                                        {d.observations}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {catIdx < groupedCategories.length - 1 && (
                                                        <div className="h-px bg-border-secondary w-full my-2 animate-none" aria-hidden />
                                                    )}
                                                </div>
                                            ))}
                                            {groupedCategories.length === 0 && (
                                                <p className="text-sm text-tertiary">Nenhum prato no menu planejado.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="border-b border-secondary px-6 py-5">
                                        <p className="text-sm font-semibold text-primary">Menu Planejado</p>
                                    </div>
                                    <div className="flex flex-col gap-5 px-6 py-5">
                                        <div className="flex flex-col rounded-xl bg-secondary_alt p-5 border border-secondary">
                                            {order.dishes.length > 0 ? (
                                                order.dishes.map((d, idx) => (
                                                    <div key={`${d.id ?? "dish"}-${idx}`}>
                                                        <div className="flex flex-col gap-1 py-3">
                                                            <span className="text-sm font-semibold text-primary">{d.name}</span>
                                                            {d.observations && (
                                                                <span className="inline-flex w-max items-center rounded-md border border-utility-warning-200 bg-utility-warning-50 px-2 py-0.5 text-xs font-medium text-utility-warning-700">
                                                                    {d.observations}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {idx < order.dishes.length - 1 && (
                                                            <div className="h-px bg-border-secondary w-full" aria-hidden />
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-tertiary">Nenhum prato no menu planejado.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </section>

                        <section className="grid gap-6 lg:grid-cols-2">
                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                <div className="border-b border-secondary px-6 py-5">
                                    <p className="text-sm font-semibold text-primary">Informações do Cliente</p>
                                </div>
                                <div className="px-6 py-5">
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-primary">{order.cliente?.nome ?? "—"}</p>
                                            <p className="mt-1 truncate text-sm text-tertiary">{order.cliente?.email ?? "—"}</p>
                                            <p className="mt-0.5 truncate text-sm text-tertiary">{order.cliente?.whatsapp ?? "—"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                <div className="flex items-center justify-between border-b border-secondary px-6 py-5">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-primary">Pagamento</p>
                                        <Badge size="sm" type="pill-color" color="warning">
                                            Pendente
                                        </Badge>
                                    </div>
                                    <Button color="secondary" size="sm" iconTrailing={ReceiptCheck} isDisabled>
                                        Acessar recibo
                                    </Button>
                                </div>
                                <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
                                    <DataRow label="Valor do serviço" value="—" />
                                    <DataRow label="Data do pagamento" value="—" />
                                    <DataRow label="Método de Pagamento" value="—" />
                                </div>
                                <div className="border-t border-secondary px-6 py-5">
                                    <Button color="secondary" size="md" className="w-full" iconLeading={Mail01} isDisabled>
                                        Enviar aviso de pagamento
                                    </Button>
                                </div>
                            </div>
                        </section>

                        {order.observations && !isSpecial ? (
                            <section className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                                <p className="text-sm font-semibold text-primary">Observações</p>
                                <p className="mt-1 text-sm text-tertiary">{order.observations}</p>
                            </section>
                        ) : null}
                    </>
                ) : null}
            </div>

            <ModalOverlay isOpen={openProposal} isDismissable onOpenChange={setOpenProposal}>
                <Modal>
                    <Dialog>
                        <div className="w-full max-w-[720px] overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                            <div className="flex items-start justify-between gap-4 border-b border-secondary px-6 py-5">
                                <div className="min-w-0">
                                    <p className="text-md font-semibold text-primary">Proposta de Serviço</p>
                                    <p className="mt-1 text-sm text-tertiary">Adicione os itens e valores para enviar ao cliente.</p>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Fechar"
                                    className="flex size-9 items-center justify-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                    onClick={() => setOpenProposal(false)}
                                >
                                    <CloseIcon className="size-5" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-4 px-6 py-5">
                                {proposalDraft.map((row, idx) => (
                                    <div key={idx} className="grid gap-3 md:grid-cols-[1fr_180px_44px]">
                                        <Input
                                            label={idx === 0 ? "Item" : undefined}
                                            placeholder="Descrição do item"
                                            value={row.description}
                                            onChange={(v) => {
                                                setProposalDraft((prev) => prev.map((p, i) => (i === idx ? { ...p, description: v } : p)));
                                            }}
                                        />
                                        <Input
                                            label={idx === 0 ? "Valor" : undefined}
                                            placeholder="0,00"
                                            value={row.price}
                                            onChange={(v) => {
                                                setProposalDraft((prev) => prev.map((p, i) => (i === idx ? { ...p, price: v } : p)));
                                            }}
                                        />
                                        <div className="flex items-end">
                                            <ButtonUtility
                                                size="sm"
                                                color="tertiary"
                                                icon={Trash01}
                                                tooltip="Remover"
                                                onClick={() => setProposalDraft((prev) => prev.filter((_, i) => i !== idx))}
                                            />
                                        </div>
                                    </div>
                                ))}

                                <div>
                                    <Button
                                        color="link-color"
                                        size="md"
                                        iconLeading={Plus}
                                        onClick={() => setProposalDraft((prev) => [...prev, { description: "", price: "" }])}
                                    >
                                        Adicionar item
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-3 border-t border-secondary px-6 py-5">
                                <Button color="secondary" size="md" className="flex-1" onClick={() => setOpenProposal(false)} isDisabled={loading}>
                                    Cancelar
                                </Button>
                                <Button
                                    color="primary"
                                    size="md"
                                    className="flex-1"
                                    isLoading={loading}
                                    onClick={async () => {
                                        const items = proposalDraft
                                            .map((r) => {
                                                const description = r.description.trim();
                                                const price = parsePriceValue(r.price);
                                                if (!description || price === null) return null;
                                                return { description, price };
                                            })
                                            .filter(Boolean) as { description: string; price: number }[];

                                        if (items.length === 0) {
                                            toast.error("Adicione ao menos um item válido.");
                                            return;
                                        }
                                        setProposalPreviewItems(items);
                                        setOpenProposal(false);
                                    }}
                                >
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            <ModalOverlay isOpen={openProposalSendConfirm} isDismissable onOpenChange={setOpenProposalSendConfirm}>
                <Modal>
                    <Dialog>
                        <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                            <div className="flex items-start gap-4 px-6 pt-6">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-utility-blue-light-200">
                                    <CheckCircle className="size-6 text-utility-blue-600" aria-hidden />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-md font-semibold text-primary">Enviar proposta para o cliente?</p>
                                            <p className="mt-1 text-sm text-tertiary">Confirme para enviar a proposta de serviço ao cliente.</p>
                                        </div>

                                        <button
                                            type="button"
                                            aria-label="Fechar"
                                            className="flex size-9 items-center justify-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                            onClick={() => setOpenProposalSendConfirm(false)}
                                        >
                                            <CloseIcon className="size-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 px-6 pt-6 pb-6">
                                <Button color="secondary" size="md" className="flex-1" onClick={() => setOpenProposalSendConfirm(false)} isDisabled={loading}>
                                    Cancelar
                                </Button>
                                <Button
                                    color="primary"
                                    size="md"
                                    className="flex-1"
                                    isLoading={loading}
                                    isDisabled={!canConfirmSendProposal}
                                    onClick={async () => {
                                        if (!order?.code) {
                                            toast.error("Não foi possível enviar a proposta.");
                                            return;
                                        }

                                        const token = getTytAccessToken();
                                        if (!token) {
                                            toast.error("Sessão expirada. Faça login novamente.");
                                            return;
                                        }

                                        const items = proposalPreviewItems.length > 0 ? proposalPreviewItems : order.proposalItems;
                                        if (items.length === 0) {
                                            toast.error("Crie uma proposta antes de enviar.");
                                            return;
                                        }

                                        try {
                                            const res = await putKitchenOrderSpecialServiceProposal(order.code, { items }, token);
                                            await parseJsonOrThrow<unknown>(res);
                                            toast.success("Proposta enviada com sucesso!");
                                            setOpenProposalSendConfirm(false);
                                            setProposalPreviewItems([]);
                                            await load();
                                        } catch (err) {
                                            if (err instanceof TytApiError) {
                                                toast.error("Não foi possível enviar a proposta.", { description: parseApiErrorMessage(err.body) });
                                            } else {
                                                toast.error("Não foi possível enviar a proposta.");
                                            }
                                        }
                                    }}
                                >
                                    Enviar
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            <ModalOverlay isOpen={openCancel} isDismissable onOpenChange={setOpenCancel}>
                <Modal>
                    <Dialog>
                        <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                            <div className="flex items-start gap-4 px-6 pt-6">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-error-primary">
                                    <Trash01 className="size-6 text-error-solid" aria-hidden />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-md font-semibold text-primary">Deseja cancelar esse serviço?</p>
                                            <p className="mt-1 text-sm text-tertiary">
                                                Você tem certeza que deseja excluir este serviço? Esta ação não poderá ser desfeita.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            aria-label="Fechar"
                                            className="flex size-9 items-center justify-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                            onClick={() => setOpenCancel(false)}
                                        >
                                            <CloseIcon className="size-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 px-6 pt-6 pb-6">
                                <Button color="secondary" size="md" className="flex-1" onClick={() => setOpenCancel(false)} isDisabled={loading}>
                                    Cancelar
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    size="md"
                                    className="flex-1"
                                    isLoading={loading}
                                    onClick={async () => {
                                        const token = getTytAccessToken();
                                        if (!token) {
                                            toast.error("Sessão expirada. Faça login novamente.");
                                            return;
                                        }
                                        try {
                                            const res = await putKitchenOrderCancel(code, token);
                                            await parseJsonOrThrow<unknown>(res);
                                            toast.success("Serviço cancelado");
                                            setOpenCancel(false);
                                            router.push(backHref);
                                            router.refresh();
                                        } catch (err) {
                                            if (err instanceof TytApiError) toast.error("Não foi possível cancelar o serviço.", { description: parseApiErrorMessage(err.body) });
                                            else toast.error("Não foi possível cancelar o serviço.");
                                        }
                                    }}
                                >
                                    Excluir
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </main>
    );
}
