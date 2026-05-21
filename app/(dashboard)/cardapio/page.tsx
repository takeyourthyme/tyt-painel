"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download02, Edit02, Eye, FilterLines, Plus, SearchLg, Trash01, UploadCloud02 } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import type { Key } from "react-aria-components";
import type { Selection } from "react-aria-components";
import { toast } from "sonner";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Table, TableCard } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { Badge } from "@/components/base/badges/badges";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import { deleteIngrediente, getIngredienteById, getIngredientes, postIngrediente, postIngredientesUpload, putIngrediente } from "@/lib/tyt-api/ingredientes";
import type { IngredienteCreateBody, IngredienteUpdateBody } from "@/lib/tyt-api/ingredientes";
import { ingredientesCategoriasApi } from "@/lib/tyt-api/ingredientes-categorias";
import { getPratos } from "@/lib/tyt-api/pratos";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { cx } from "@/utils/cx";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

type TabId = "dishes" | "ingredients" | "classifications";

type DishCard = {
    id: string;
    title: string;
    description: string;
    imageUrl: string | null;
    categoryBadges: Array<{ label: string; color: BadgeColors }>;
    serviceBadges: string[];
};

type IngredientRow = {
    id: string;
    name: string;
    categoryLabel: string;
    categoryColor: BadgeColors;
    unitLabel: string;
    unitPriceLabel: string;
    lastQuoteLabel: string;
};

type IngredienteCategoria = { id: number; descricao: string };

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

function coerceBool(raw: unknown): boolean {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw === 1;
    if (typeof raw === "string") return ["true", "1", "yes", "sim"].includes(raw.trim().toLowerCase());
    return false;
}

function badgeColorByIndex(index: number): BadgeColors {
    const colors: BadgeColors[] = ["orange", "blue", "purple", "pink", "success", "indigo", "gray-blue"];
    return colors[index % colors.length];
}

function getRecord(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object") return null;
    return raw as Record<string, unknown>;
}

function getStringValue(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim().length > 0) return v.trim();
    }
    return null;
}

function getNumberValue(obj: Record<string, unknown>, keys: string[]): number | null {
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

function parseMoneyValue(raw: string): number | null {
    const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return n;
}

function parseDecimalValue(raw: string): number | null {
    const cleaned = raw.replace(/[^\d,.-]/g, "").replace(",", ".").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return n;
}

export default function CardapioPage() {
    const [selectedTab, setSelectedTab] = useState<Key>("dishes");

    const [dishQuery, setDishQuery] = useState("");
    const [ingredientQuery, setIngredientQuery] = useState("");

    const [dishes, setDishes] = useState<DishCard[]>([]);
    const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
    const [categories, setCategories] = useState<IngredienteCategoria[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    type IngredientDrawerView =
        | { type: "create-pick" }
        | { type: "create-single" }
        | { type: "create-batch" }
        | { type: "details"; id: string }
        | { type: "edit"; id: string };

    const [ingredientDrawer, setIngredientDrawer] = useState<IngredientDrawerView | null>(null);
    const [pickCreateMode, setPickCreateMode] = useState<"single" | "batch">("single");

    const [batchFile, setBatchFile] = useState<File | null>(null);

    const [ingredientLoading, setIngredientLoading] = useState(false);
    const [ingredientError, setIngredientError] = useState<string | null>(null);
    const [ingredientDetails, setIngredientDetails] = useState<Record<string, unknown> | null>(null);

    const [categorySelection, setCategorySelection] = useState<Selection>(new Set());
    const [ingredientForm, setIngredientForm] = useState<{
        descricao: string;
        marca_pref: string;
        fornecedor: string;
        volume_peso: string;
        unidade_medida: string;
        quantidade: string;
        unidade: string;
        valor: string;
    }>({
        descricao: "",
        marca_pref: "",
        fornecedor: "",
        volume_peso: "",
        unidade_medida: "g",
        quantidade: "1",
        unidade: "g",
        valor: "",
    });

    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);

    const requestIdRef = useRef(0);

    const reload = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        const token = getTytAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const [pratosRes, ingredientesRes, categoriasRes] = await Promise.all([
                getPratos(token),
                getIngredientes(token),
                ingredientesCategoriasApi.getAll(token),
            ]);

            const [pratosJson, ingredientesJson, categoriasJson] = await Promise.all([
                parseJsonOrThrow<unknown>(pratosRes),
                parseJsonOrThrow<unknown>(ingredientesRes),
                parseJsonOrThrow<unknown>(categoriasRes),
            ]);

            if (requestId !== requestIdRef.current) return;

            const categoriasList = normalizeList<unknown>(categoriasJson)
                .map((x) => {
                    if (!x || typeof x !== "object") return null;
                    const r = x as Record<string, unknown>;
                    const id = typeof r.id === "number" ? r.id : Number(r.id);
                    const descricao = typeof r.descricao === "string" ? r.descricao : null;
                    if (!Number.isFinite(id) || !descricao) return null;
                    return { id, descricao };
                })
                .filter(Boolean) as IngredienteCategoria[];
            setCategories(categoriasList);

            const pratosList = normalizeList<unknown>(pratosJson).map((x, idx) => {
                const r = (x && typeof x === "object" ? (x as Record<string, unknown>) : {}) as Record<string, unknown>;
                const id = r.id !== undefined ? String(r.id) : String(idx);
                const title = typeof r.descricao === "string" ? r.descricao : typeof r.title === "string" ? r.title : "—";
                const description =
                    typeof r.receita === "string"
                        ? r.receita
                        : typeof r.description === "string"
                            ? r.description
                            : typeof r.resumo === "string"
                                ? r.resumo
                                : "";

                const imageUrl = cleanUrl(r.foto1) ?? cleanUrl(r.imageUrl) ?? cleanUrl(r.foto) ?? null;

                const prefsRaw = (r.pref_culinarias ?? r.categorias ?? r.tags) as unknown;
                const prefs = Array.isArray(prefsRaw) ? prefsRaw : [];
                const categoryBadges = prefs
                    .map((p, i) => {
                        if (typeof p === "string") return { label: p, color: badgeColorByIndex(i) };
                        if (!p || typeof p !== "object") return null;
                        const pr = p as Record<string, unknown>;
                        const label = typeof pr.descricao === "string" ? pr.descricao : typeof pr.nome === "string" ? pr.nome : null;
                        if (!label) return null;
                        return { label, color: badgeColorByIndex(i) };
                    })
                    .filter(Boolean) as Array<{ label: string; color: BadgeColors }>;

                const serviceBadges: string[] = [];
                if (coerceBool(r.meal_preap ?? r.meal_prep)) serviceBadges.push("Meal Prep");
                if (coerceBool(r.get_togheter ?? r.get_together)) serviceBadges.push("Get Together");

                return { id, title, description, imageUrl, categoryBadges, serviceBadges } satisfies DishCard;
            });
            setDishes(pratosList);

            const categoriasById = new Map(categoriasList.map((c) => [c.id, c.descricao]));
            const ingredientesList = normalizeList<unknown>(ingredientesJson).map((x, idx) => {
                const r = (x && typeof x === "object" ? (x as Record<string, unknown>) : {}) as Record<string, unknown>;
                const id = r.id !== undefined ? String(r.id) : String(idx);
                const name =
                    typeof r.descricao === "string"
                        ? r.descricao
                        : typeof r.nome === "string"
                            ? r.nome
                            : typeof r.name === "string"
                                ? r.name
                                : "—";
                const idCategoria = typeof r.id_categoria === "number" ? r.id_categoria : Number(r.id_categoria);
                const categoriaObj = getRecord(r.categoria);
                const categoryLabel =
                    categoriasById.get(idCategoria) ?? (categoriaObj ? getStringValue(categoriaObj, ["descricao"]) : null) ?? (typeof r.categoria === "string" ? r.categoria : "—");
                const categoryColor = badgeColorByIndex(Math.abs(idCategoria || idx));
                const unidade = typeof r.unidade === "string" ? r.unidade : "—";
                const unidadeMedida = typeof r.unidade_medida === "string" ? r.unidade_medida : null;
                const volumePeso = typeof r.volume_peso === "string" ? r.volume_peso : typeof r.volume_peso === "number" ? String(r.volume_peso) : null;
                const unitLabel = volumePeso ? `${volumePeso} ${unidadeMedida ?? unidade}` : unidadeMedida ?? unidade;
                const valor = typeof r.valor === "number" ? r.valor : typeof r.valor === "string" ? Number(r.valor) : null;
                const unitPriceLabel = formatCurrency(Number.isFinite(valor as number) ? (valor as number) : null);
                const lastQuoteLabel =
                    typeof r.updatedAt === "string"
                        ? formatDatePtBr(r.updatedAt)
                        : typeof r.updated_at === "string"
                            ? formatDatePtBr(r.updated_at)
                            : "—";
                return { id, name, categoryLabel, categoryColor, unitLabel, unitPriceLabel, lastQuoteLabel } satisfies IngredientRow;
            });
            setIngredients(ingredientesList);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            if (err instanceof TytApiError) setError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setError(err.message);
            else setError("Ocorreu um erro. Tente novamente.");
        } finally {
            if (requestId !== requestIdRef.current) return;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const dishItems = useMemo(() => {
        const q = dishQuery.trim().toLowerCase();
        if (!q) return dishes;
        return dishes.filter((d) => `${d.title} ${d.description}`.toLowerCase().includes(q));
    }, [dishes, dishQuery]);

    const ingredientItems = useMemo(() => {
        const q = ingredientQuery.trim().toLowerCase();
        if (!q) return ingredients;
        return ingredients.filter((i) => `${i.name} ${i.categoryLabel}`.toLowerCase().includes(q));
    }, [ingredients, ingredientQuery]);

    const tabItems = useMemo(() => {
        return [
            { id: "dishes", label: "Pratos", badge: dishes.length },
            { id: "ingredients", label: "Ingredientes" },
            { id: "classifications", label: "Classificações" },
        ] satisfies Array<{ id: TabId; label: string; badge?: number }>;
    }, [dishes.length]);

    const closeIngredientDrawer = useCallback(() => {
        setBatchFile(null);
        setIngredientDrawer(null);
        setIngredientDetails(null);
        setIngredientError(null);
        setOpenDeleteConfirm(false);
        setIngredientLoading(false);
    }, []);

    const loadIngredientDetails = useCallback(async (id: string) => {
        const token = getTytAccessToken();
        if (!token) return;
        setIngredientLoading(true);
        setIngredientError(null);
        try {
            const res = await getIngredienteById(id, token);
            const json = await parseJsonOrThrow<unknown>(res);
            const record = getRecord(json) ?? getRecord((json as Record<string, unknown>)?.data) ?? null;
            setIngredientDetails(record);
        } catch (err) {
            if (err instanceof TytApiError) setIngredientError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setIngredientError(err.message);
            else setIngredientError("Ocorreu um erro. Tente novamente.");
        } finally {
            setIngredientLoading(false);
        }
    }, []);

    const selectedCategoryId = useMemo(() => {
        if (!(categorySelection instanceof Set)) return null;
        const first = categorySelection.values().next().value;
        if (!first) return null;
        const n = Number(first);
        return Number.isFinite(n) ? n : null;
    }, [categorySelection]);

    const ingredientView = useMemo(() => {
        const record = ingredientDetails;
        if (!record) return null;
        const id = getStringValue(record, ["id"]) ?? null;
        const name = getStringValue(record, ["descricao", "nome", "name"]) ?? "—";
        const idCategoria =
            getNumberValue(record, ["id_categoria", "categoria_id"]) ??
            (getRecord(record.categoria) ? getNumberValue(getRecord(record.categoria)!, ["id"]) : null);
        const categoryLabel =
            (idCategoria ? categories.find((c) => c.id === idCategoria)?.descricao : null) ??
            (getRecord(record.categoria) ? getStringValue(getRecord(record.categoria)!, ["descricao", "nome"]) : null) ??
            "—";
        const unidade = getStringValue(record, ["unidade"]) ?? "—";
        const volumePesoRaw = getStringValue(record, ["volume_peso"]) ?? null;
        const volumePeso = volumePesoRaw ?? (getNumberValue(record, ["volume_peso"]) !== null ? String(getNumberValue(record, ["volume_peso"])!) : null);
        const unitPrice = getNumberValue(record, ["valor", "custo_unitario"]) ?? null;
        const updatedAt =
            getStringValue(record, ["updatedAt", "updated_at", "updated"]) ?? getStringValue(record, ["createdAt", "created_at"]) ?? null;

        return {
            id,
            name,
            idCategoria,
            categoryLabel,
            volumePeso,
            unidade,
            unitPrice,
            updatedAt,
        };
    }, [ingredientDetails, categories]);

    const actionButton =
        selectedTab === "dishes" ? (
            <Button color="primary" size="md" iconLeading={Plus} isDisabled>
                Adicionar prato
            </Button>
        ) : selectedTab === "ingredients" ? (
            <Button
                color="primary"
                size="md"
                iconLeading={Plus}
                onClick={() => {
                    setPickCreateMode("single");
                    setCategorySelection(new Set());
                    setIngredientForm({
                        descricao: "",
                        marca_pref: "",
                        fornecedor: "",
                        volume_peso: "",
                        unidade_medida: "g",
                        quantidade: "1",
                        unidade: "g",
                        valor: "",
                    });
                    setIngredientError(null);
                    setIngredientDetails(null);
                    setIngredientDrawer({ type: "create-pick" });
                }}
            >
                Novo ingrediente
            </Button>
        ) : null;

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h1 className={cx(playfair.className, "text-display-md font-normal text-primary lg:text-display-lg")}>Cardápio</h1>
                        <div className="flex items-center gap-3">
                            {loading ? <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." /> : null}
                            {actionButton}
                        </div>
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar o cardápio.</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void reload()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} className="flex w-full flex-col gap-6">
                    <Tabs.List type="underline" size="md" items={tabItems} className="w-full">
                        {(tab) => <Tabs.Item {...tab} id={tab.id} />}
                    </Tabs.List>

                    <Tabs.Panel id="dishes" className="flex flex-col gap-4 outline-hidden">
                        <section className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-md font-semibold text-primary">Pratos</p>
                                        <Badge size="sm" type="pill-color" color="gray">
                                            {dishes.length}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-tertiary">Gerencie os pratos disponíveis para os serviços</p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                                    <Input
                                        placeholder="Buscar por prato"
                                        icon={SearchLg}
                                        value={dishQuery}
                                        onChange={setDishQuery}
                                        className="w-full sm:w-[320px]"
                                    />
                                    <Button color="secondary" size="md" iconLeading={Download02}>
                                        Exportar dados
                                    </Button>
                                    <Button color="primary" size="md" iconLeading={FilterLines}>
                                        Filtrar
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {dishItems.map((dish) => (
                                    <article key={dish.id} className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                        <div className="relative aspect-[16/9] w-full bg-secondary">
                                            {dish.imageUrl ? (
                                                <img src={dish.imageUrl} alt={dish.title} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-sm text-tertiary">Sem imagem</div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-3 px-4 py-4">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-primary">{dish.title}</p>
                                                <p className="mt-1 line-clamp-2 text-sm text-tertiary">{dish.description || "—"}</p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                {dish.categoryBadges.slice(0, 2).map((b) => (
                                                    <Badge key={b.label} size="sm" type="pill-color" color={b.color}>
                                                        {b.label}
                                                    </Badge>
                                                ))}
                                                {dish.serviceBadges.map((s) => (
                                                    <Badge key={s} size="sm" type="pill-color" color="gray">
                                                        {s}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end border-t border-secondary px-4 py-3">
                                            <Button color="secondary" size="sm" isDisabled>
                                                Editar
                                            </Button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </Tabs.Panel>

                    <Tabs.Panel id="ingredients" className="flex flex-col gap-4 outline-hidden">
                        <section className="flex flex-col gap-4">
                            <div>
                                <p className="text-md font-semibold text-primary">Ingredientes</p>
                                <p className="mt-1 text-sm text-tertiary">
                                    Controle o valor de mercado e a disponibilidade regional dos ingredientes base.
                                </p>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                <TableCard.Root>
                                    <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                                        <Input
                                            placeholder="Pesquisar ingrediente..."
                                            icon={SearchLg}
                                            value={ingredientQuery}
                                            onChange={setIngredientQuery}
                                            className="min-w-0 md:max-w-md md:flex-1"
                                        />
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Button color="secondary" size="md" iconLeading={Download02}>
                                                Exportar dados
                                            </Button>
                                            <Button color="primary" size="md" iconLeading={FilterLines}>
                                                Filtrar
                                            </Button>
                                        </div>
                                    </div>

                                    <Table aria-label="Ingredientes" selectionMode="none">
                                        <Table.Header>
                                            <Table.Head id="ingredient" label="Ingrediente" isRowHeader className="min-w-[240px]" />
                                            <Table.Head id="category" label="Categoria" className="min-w-[160px]" />
                                            <Table.Head id="unit" label="Peso/Volume" className="min-w-[140px]" />
                                            <Table.Head id="price" label="Preço Uni." className="min-w-[140px]" />
                                            <Table.Head id="last" label="Última cotação" className="min-w-[140px]" />
                                            <Table.Head id="actions" label="" className="w-[56px]" />
                                        </Table.Header>
                                        <Table.Body items={ingredientItems}>
                                            {(row) => (
                                                <Table.Row id={row.id}>
                                                    <Table.Cell className="whitespace-nowrap text-sm font-semibold text-primary">{row.name}</Table.Cell>
                                                    <Table.Cell>
                                                        <Badge size="sm" type="pill-color" color={row.categoryColor}>
                                                            {row.categoryLabel}
                                                        </Badge>
                                                    </Table.Cell>
                                                    <Table.Cell className="whitespace-nowrap text-sm text-tertiary">{row.unitLabel}</Table.Cell>
                                                    <Table.Cell className="whitespace-nowrap text-sm text-tertiary">{row.unitPriceLabel}</Table.Cell>
                                                    <Table.Cell className="whitespace-nowrap text-sm text-tertiary">{row.lastQuoteLabel}</Table.Cell>
                                                    <Table.Cell className="!px-4">
                                                        <div className="flex justify-end">
                                                            <ButtonUtility
                                                                size="sm"
                                                                color="tertiary"
                                                                icon={Eye}
                                                                tooltip="Detalhes"
                                                                onClick={() => {
                                                                    setIngredientDrawer({ type: "details", id: row.id });
                                                                    void loadIngredientDetails(row.id);
                                                                }}
                                                            />
                                                        </div>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table>
                                </TableCard.Root>
                            </div>
                        </section>
                    </Tabs.Panel>

                    <Tabs.Panel id="classifications" className="flex flex-col gap-4 outline-hidden">
                        <div className="rounded-xl bg-primary p-6 shadow-xs ring-1 ring-secondary ring-inset">
                            <p className="text-sm text-tertiary">Em breve.</p>
                        </div>
                    </Tabs.Panel>
                </Tabs>
            </div>

            <SlideoutMenu isOpen={ingredientDrawer !== null} isDismissable onOpenChange={(open) => (!open ? closeIngredientDrawer() : undefined)}>
                {({ close }) => {
                    const type = ingredientDrawer?.type ?? null;
                    const closeAll = () => {
                        close();
                        closeIngredientDrawer();
                    };

                    const title =
                        type === "create-single"
                            ? "Novo ingrediente"
                            : type === "create-batch"
                                ? "Adicionar ingrediente em lote"
                                : type === "details"
                                    ? "Detalhes do ingrediente"
                                    : type === "edit"
                                        ? "Editar ingrediente"
                                        : "Adicionar ingrediente";

                    const description =
                        type === "create-single"
                            ? "Cadastre os detalhes do ingrediente para calcular seus custos."
                            : type === "create-batch"
                                ? "Adicione sua planilha"
                                : type === "details"
                                    ? "Informações completas para controle de custo e uso nas receitas"
                                    : type === "edit"
                                        ? "Alterações afetam receitas que usam este ingrediente."
                                        : "Escolha como deseja incluir novos itens à sua lista de insumos.";

                    const unitOptions = [
                        { id: "g", label: "g" },
                        { id: "kg", label: "kg" },
                        { id: "ml", label: "ml" },
                        { id: "l", label: "l" },
                        { id: "un", label: "un" },
                    ];

                    return (
                        <>
                            <SlideoutMenu.Header onClose={closeAll}>
                                <div className="flex flex-col gap-1 pr-10">
                                    <p className="text-md font-semibold text-primary">{title}</p>
                                    <p className="text-sm text-tertiary">{description}</p>
                                </div>
                            </SlideoutMenu.Header>

                            <SlideoutMenu.Content>
                                {ingredientError ? <p className="text-sm text-error-primary">{ingredientError}</p> : null}

                                {type === "details" || type === "edit" ? (
                                    ingredientLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." />
                                        </div>
                                    ) : ingredientView ? (
                                        type === "details" ? (
                                            <div className="flex flex-col gap-4">
                                                <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                    <p className="text-sm font-semibold text-primary">Nome do Ingrediente</p>
                                                    <p className="mt-1 text-sm text-tertiary">{ingredientView.name}</p>

                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Categorias</p>
                                                        <div className="mt-2">
                                                            <Badge size="sm" type="pill-color" color={badgeColorByIndex((ingredientView.idCategoria ?? 1) - 1)}>
                                                                {ingredientView.categoryLabel}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Peso/Volume</p>
                                                        <p className="mt-1 text-sm text-tertiary">
                                                            {ingredientView.volumePeso
                                                                ? `${ingredientView.volumePeso} ${getStringValue(ingredientDetails ?? {}, ["unidade_medida"]) ?? ingredientView.unidade}`
                                                                : getStringValue(ingredientDetails ?? {}, ["unidade_medida"]) ?? ingredientView.unidade}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Marca preferida</p>
                                                        <p className="mt-1 text-sm text-tertiary">
                                                            {getStringValue(ingredientDetails ?? {}, ["marca_pref"]) ?? "—"}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Fornecedor</p>
                                                        <p className="mt-1 text-sm text-tertiary">
                                                            {getStringValue(ingredientDetails ?? {}, ["fornecedor"]) ?? "—"}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Quantidade</p>
                                                        <p className="mt-1 text-sm text-tertiary">
                                                            {(() => {
                                                                const n = getNumberValue(ingredientDetails ?? {}, ["quantidade"]);
                                                                return n !== null ? String(n) : "—";
                                                            })()}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Custo unitário</p>
                                                        <p className="mt-1 text-sm text-tertiary">{formatCurrency(ingredientView.unitPrice)}</p>
                                                    </div>

                                                    <p className="mt-4 text-xs text-tertiary">Atualizado em {formatDatePtBr(ingredientView.updatedAt)}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-4">
                                                <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                    <p className="text-sm font-semibold text-primary">Identificação</p>
                                                    <div className="mt-4 flex flex-col gap-4">
                                                        <Input
                                                            label="Nome do Ingrediente"
                                                            value={ingredientForm.descricao}
                                                            onChange={(v) => setIngredientForm((p) => ({ ...p, descricao: v }))}
                                                            isRequired
                                                        />

                                                        <div className="flex flex-col gap-2">
                                                            <p className="text-sm font-medium text-secondary">Categorias *</p>
                                                            <TagGroup
                                                                label="Categorias"
                                                                size="md"
                                                                selectionMode="single"
                                                                selectedKeys={categorySelection}
                                                                onSelectionChange={setCategorySelection}
                                                            >
                                                                <TagList className="flex flex-wrap gap-2">
                                                                    {categories.map((c) => (
                                                                        <Tag key={c.id} id={String(c.id)}>
                                                                            {c.descricao}
                                                                        </Tag>
                                                                    ))}
                                                                </TagList>
                                                            </TagGroup>
                                                        </div>

                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <Select
                                                                aria-label="Unidade"
                                                                label="Unidade"
                                                                size="md"
                                                                items={unitOptions}
                                                                selectedKey={ingredientForm.unidade}
                                                                onSelectionChange={(key) =>
                                                                    setIngredientForm((p) => ({ ...p, unidade: key ? String(key) : "g" }))
                                                                }
                                                            >
                                                                {(item) => <Select.Item {...item} />}
                                                            </Select>
                                                            <Input
                                                                label="Custo unitário"
                                                                value={ingredientForm.valor}
                                                                onChange={(v) => setIngredientForm((p) => ({ ...p, valor: v }))}
                                                                isRequired
                                                            />
                                                        </div>

                                                        <Input
                                                            label="Marca preferida"
                                                            value={ingredientForm.marca_pref}
                                                            onChange={(v) => setIngredientForm((p) => ({ ...p, marca_pref: v }))}
                                                        />

                                                        <Input
                                                            label="Fornecedor"
                                                            value={ingredientForm.fornecedor}
                                                            onChange={(v) => setIngredientForm((p) => ({ ...p, fornecedor: v }))}
                                                        />

                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <Input
                                                                label="Volume/Peso"
                                                                value={ingredientForm.volume_peso}
                                                                onChange={(v) => setIngredientForm((p) => ({ ...p, volume_peso: v }))}
                                                            />
                                                            <Select
                                                                aria-label="Unidade de medida"
                                                                label="Unidade de medida"
                                                                size="md"
                                                                items={unitOptions}
                                                                selectedKey={ingredientForm.unidade_medida}
                                                                onSelectionChange={(key) =>
                                                                    setIngredientForm((p) => ({ ...p, unidade_medida: key ? String(key) : "g" }))
                                                                }
                                                            >
                                                                {(item) => <Select.Item {...item} />}
                                                            </Select>
                                                        </div>

                                                        <Input
                                                            label="Quantidade"
                                                            value={ingredientForm.quantidade}
                                                            onChange={(v) => setIngredientForm((p) => ({ ...p, quantidade: v }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-sm text-tertiary">Não foi possível carregar os detalhes.</p>
                                    )
                                ) : type === "create-batch" ? (
                                    <div className="flex flex-col gap-3">
                                        <FileUploadDropZone
                                            accept=".xlsx,.xls"
                                            allowsMultiple={false}
                                            hint="XLSX ou XLS"
                                            onDropFiles={(files) => {
                                                const first = files.item(0);
                                                setBatchFile(first ? (first as File) : null);
                                            }}
                                        />
                                        {batchFile ? <p className="text-sm text-tertiary">{batchFile.name}</p> : null}
                                    </div>
                                ) : type === "create-single" ? (
                                    <div className="flex flex-col gap-4">
                                        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                            <p className="text-sm font-semibold text-primary">Identificação</p>
                                            <div className="mt-4 flex flex-col gap-4">
                                                <Input
                                                    label="Nome do Ingrediente"
                                                    value={ingredientForm.descricao}
                                                    onChange={(v) => setIngredientForm((p) => ({ ...p, descricao: v }))}
                                                    isRequired
                                                />

                                                <div className="flex flex-col gap-2">
                                                    <p className="text-sm font-medium text-secondary">Categorias *</p>
                                                    <TagGroup
                                                        label="Categorias"
                                                        size="md"
                                                        selectionMode="single"
                                                        selectedKeys={categorySelection}
                                                        onSelectionChange={setCategorySelection}
                                                    >
                                                        <TagList className="flex flex-wrap gap-2">
                                                            {categories.map((c) => (
                                                                <Tag key={c.id} id={String(c.id)}>
                                                                    {c.descricao}
                                                                </Tag>
                                                            ))}
                                                        </TagList>
                                                    </TagGroup>
                                                </div>

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <Select
                                                        aria-label="Unidade"
                                                        label="Unidade"
                                                        size="md"
                                                        items={unitOptions}
                                                        selectedKey={ingredientForm.unidade}
                                                        onSelectionChange={(key) =>
                                                            setIngredientForm((p) => ({ ...p, unidade: key ? String(key) : "g" }))
                                                        }
                                                    >
                                                        {(item) => <Select.Item {...item} />}
                                                    </Select>
                                                    <Input
                                                        label="Custo unitário"
                                                        value={ingredientForm.valor}
                                                        onChange={(v) => setIngredientForm((p) => ({ ...p, valor: v }))}
                                                        isRequired
                                                    />
                                                </div>

                                                <Input
                                                    label="Marca preferida"
                                                    value={ingredientForm.marca_pref}
                                                    onChange={(v) => setIngredientForm((p) => ({ ...p, marca_pref: v }))}
                                                />

                                                <Input
                                                    label="Fornecedor"
                                                    value={ingredientForm.fornecedor}
                                                    onChange={(v) => setIngredientForm((p) => ({ ...p, fornecedor: v }))}
                                                />

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <Input
                                                        label="Volume/Peso"
                                                        value={ingredientForm.volume_peso}
                                                        onChange={(v) => setIngredientForm((p) => ({ ...p, volume_peso: v }))}
                                                    />
                                                    <Select
                                                        aria-label="Unidade de medida"
                                                        label="Unidade de medida"
                                                        size="md"
                                                        items={unitOptions}
                                                        selectedKey={ingredientForm.unidade_medida}
                                                        onSelectionChange={(key) =>
                                                            setIngredientForm((p) => ({ ...p, unidade_medida: key ? String(key) : "g" }))
                                                        }
                                                    >
                                                        {(item) => <Select.Item {...item} />}
                                                    </Select>
                                                </div>

                                                <Input
                                                    label="Quantidade"
                                                    value={ingredientForm.quantidade}
                                                    onChange={(v) => setIngredientForm((p) => ({ ...p, quantidade: v }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setPickCreateMode("single")}
                                            className={cx(
                                                "flex w-full items-center justify-between gap-4 rounded-xl border bg-primary px-4 py-4 text-left shadow-xs",
                                                pickCreateMode === "single" ? "border-brand ring-1 ring-brand" : "border-secondary",
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-tertiary">
                                                    <Plus className="size-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">Unitário</p>
                                                    <p className="mt-1 text-sm text-tertiary">Cadastrar manualmente</p>
                                                </div>
                                            </div>
                                            <div
                                                className={cx(
                                                    "size-5 rounded-md border",
                                                    pickCreateMode === "single" ? "border-brand bg-brand" : "border-secondary",
                                                )}
                                            />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPickCreateMode("batch")}
                                            className={cx(
                                                "flex w-full items-center justify-between gap-4 rounded-xl border bg-primary px-4 py-4 text-left shadow-xs",
                                                pickCreateMode === "batch" ? "border-brand ring-1 ring-brand" : "border-secondary",
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-tertiary">
                                                    <UploadCloud02 className="size-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">Em lote</p>
                                                    <p className="mt-1 text-sm text-tertiary">Importar planilha</p>
                                                </div>
                                            </div>
                                            <div
                                                className={cx(
                                                    "size-5 rounded-md border",
                                                    pickCreateMode === "batch" ? "border-brand bg-brand" : "border-secondary",
                                                )}
                                            />
                                        </button>
                                    </div>
                                )}
                            </SlideoutMenu.Content>

                            <SlideoutMenu.Footer>
                                {type === "details" ? (
                                    <div className="flex justify-end">
                                        <Button
                                            color="secondary"
                                            size="md"
                                            iconTrailing={Edit02}
                                            onClick={() => {
                                                if (ingredientDrawer?.type !== "details") return;
                                                if (!ingredientView) return;
                                                setIngredientError(null);
                                                setOpenDeleteConfirm(false);
                                                setCategorySelection(ingredientView.idCategoria ? new Set([String(ingredientView.idCategoria)]) : new Set());
                                                setIngredientForm({
                                                    descricao: ingredientView.name === "—" ? "" : ingredientView.name,
                                                    marca_pref:
                                                        getStringValue(ingredientDetails ?? {}, ["marca_pref"]) ??
                                                        getStringValue(getRecord((ingredientDetails ?? {}).categoria) ?? {}, ["marca_pref"]) ??
                                                        "",
                                                    fornecedor: getStringValue(ingredientDetails ?? {}, ["fornecedor"]) ?? "",
                                                    volume_peso: getStringValue(ingredientDetails ?? {}, ["volume_peso"]) ?? "",
                                                    unidade_medida: (getStringValue(ingredientDetails ?? {}, ["unidade_medida"]) ?? "g").toLowerCase(),
                                                    quantidade: (() => {
                                                        const n = getNumberValue(ingredientDetails ?? {}, ["quantidade"]);
                                                        return n !== null ? String(n) : "1";
                                                    })(),
                                                    unidade: ingredientView.unidade === "—" ? "g" : ingredientView.unidade.toLowerCase(),
                                                    valor: ingredientView.unitPrice !== null ? String(ingredientView.unitPrice).replace(".", ",") : "",
                                                });
                                                setIngredientDrawer({ type: "edit", id: ingredientDrawer.id });
                                            }}
                                        >
                                            Editar
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex gap-3">
                                        {type === "edit" ? (
                                            <Button
                                                color="secondary-destructive"
                                                size="md"
                                                className="flex-1"
                                                iconLeading={Trash01}
                                                onClick={() => setOpenDeleteConfirm(true)}
                                            >
                                                Excluir
                                            </Button>
                                        ) : null}

                                        <Button color="secondary" size="md" className="flex-1" isDisabled={loading || ingredientLoading} onClick={closeAll}>
                                            Cancelar
                                        </Button>

                                        {type === "create-batch" ? (
                                            <Button
                                                color="primary"
                                                size="md"
                                                className="flex-1"
                                                isLoading={loading}
                                                isDisabled={!batchFile}
                                                onClick={async () => {
                                                    const token = getTytAccessToken();
                                                    if (!token || !batchFile) return;
                                                    try {
                                                        const res = await postIngredientesUpload({ file: batchFile }, token);
                                                        await parseJsonOrThrow<unknown>(res);
                                                        toast.success("Ingredientes importados com sucesso!");
                                                        closeAll();
                                                        await reload();
                                                    } catch (err) {
                                                        if (err instanceof TytApiError)
                                                            toast.error("Não foi possível importar a planilha.", { description: parseApiErrorMessage(err.body) });
                                                        else toast.error("Não foi possível importar a planilha.");
                                                    }
                                                }}
                                            >
                                                Confirmar
                                            </Button>
                                        ) : type === "create-single" ? (
                                            <Button
                                                color="primary"
                                                size="md"
                                                className="flex-1"
                                                isLoading={loading}
                                                onClick={async () => {
                                                    const token = getTytAccessToken();
                                                    if (!token) return;

                                                    const descricao = ingredientForm.descricao.trim();
                                                    const idCategoria = selectedCategoryId;
                                                    const unidade = ingredientForm.unidade.trim();
                                                    const valor = parseMoneyValue(ingredientForm.valor);
                                                    const marcaPref = ingredientForm.marca_pref.trim();
                                                    const fornecedor = ingredientForm.fornecedor.trim();
                                                    const volumePeso = parseDecimalValue(ingredientForm.volume_peso);
                                                    const unidadeMedida = ingredientForm.unidade_medida.trim();
                                                    const quantidade = parseDecimalValue(ingredientForm.quantidade);

                                                    if (!descricao || !idCategoria || !unidade || valor === null) {
                                                        toast.error("Preencha todos os campos obrigatórios.");
                                                        return;
                                                    }

                                                    try {
                                                        const body: IngredienteCreateBody = {
                                                            descricao,
                                                            id_categoria: idCategoria,
                                                            unidade,
                                                            valor,
                                                            marca_pref: marcaPref || null,
                                                            fornecedor: fornecedor || null,
                                                        };
                                                        if (volumePeso !== null) body.volume_peso = volumePeso;
                                                        if (unidadeMedida) body.unidade_medida = unidadeMedida;
                                                        if (quantidade !== null) body.quantidade = quantidade;

                                                        const res = await postIngrediente(
                                                            body,
                                                            token,
                                                        );
                                                        await parseJsonOrThrow<unknown>(res);
                                                        toast.success("Ingrediente criado com sucesso!");
                                                        closeAll();
                                                        await reload();
                                                    } catch (err) {
                                                        if (err instanceof TytApiError)
                                                            toast.error("Não foi possível criar o ingrediente.", { description: parseApiErrorMessage(err.body) });
                                                        else toast.error("Não foi possível criar o ingrediente.");
                                                    }
                                                }}
                                            >
                                                Salvar
                                            </Button>
                                        ) : type === "edit" ? (
                                            <Button
                                                color="primary"
                                                size="md"
                                                className="flex-1"
                                                isLoading={loading}
                                                onClick={async () => {
                                                    const token = getTytAccessToken();
                                                    if (!token || ingredientDrawer?.type !== "edit") return;

                                                    const descricao = ingredientForm.descricao.trim();
                                                    const idCategoria = selectedCategoryId;
                                                    const unidade = ingredientForm.unidade.trim();
                                                    const valor = parseMoneyValue(ingredientForm.valor);
                                                    const marcaPref = ingredientForm.marca_pref.trim();
                                                    const fornecedor = ingredientForm.fornecedor.trim();
                                                    const volumePeso = parseDecimalValue(ingredientForm.volume_peso);
                                                    const unidadeMedida = ingredientForm.unidade_medida.trim();
                                                    const quantidade = parseDecimalValue(ingredientForm.quantidade);

                                                    if (!descricao || !idCategoria || !unidade || valor === null) {
                                                        toast.error("Preencha todos os campos obrigatórios.");
                                                        return;
                                                    }

                                                    try {
                                                        const body: IngredienteUpdateBody = {
                                                            descricao,
                                                            valor,
                                                            unidade,
                                                            id_categoria: idCategoria,
                                                            marca_pref: marcaPref || null,
                                                            fornecedor: fornecedor || null,
                                                        };
                                                        if (volumePeso !== null) body.volume_peso = volumePeso;
                                                        if (unidadeMedida) body.unidade_medida = unidadeMedida;
                                                        if (quantidade !== null) body.quantidade = quantidade;

                                                        const res = await putIngrediente(
                                                            ingredientDrawer.id,
                                                            body,
                                                            token,
                                                        );
                                                        await parseJsonOrThrow<unknown>(res);
                                                        toast.success("Ingrediente atualizado com sucesso!");
                                                        closeAll();
                                                        await reload();
                                                    } catch (err) {
                                                        if (err instanceof TytApiError)
                                                            toast.error("Não foi possível atualizar o ingrediente.", { description: parseApiErrorMessage(err.body) });
                                                        else toast.error("Não foi possível atualizar o ingrediente.");
                                                    }
                                                }}
                                            >
                                                Salvar
                                            </Button>
                                        ) : (
                                            <Button
                                                color="primary"
                                                size="md"
                                                className="flex-1"
                                                onClick={() => setIngredientDrawer({ type: pickCreateMode === "single" ? "create-single" : "create-batch" })}
                                            >
                                                Confirmar
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </SlideoutMenu.Footer>
                        </>
                    );
                }}
            </SlideoutMenu>

            <ModalOverlay isOpen={openDeleteConfirm} isDismissable onOpenChange={setOpenDeleteConfirm}>
                <Modal>
                    <Dialog>
                        <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                            <div className="flex items-start justify-between gap-4 border-b border-secondary px-6 py-5">
                                <div className="min-w-0">
                                    <p className="text-md font-semibold text-primary">
                                        Excluir ingrediente {ingredientView?.name && ingredientView.name !== "—" ? `${ingredientView.name}?` : "?"}
                                    </p>
                                    <p className="mt-1 text-sm text-tertiary">
                                        Você tem certeza que deseja remover este ingrediente? Esta ação não poderá ser desfeita e pode afetar pratos que utilizam este
                                        insumo.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 px-6 py-5">
                                <Button color="secondary" size="md" className="flex-1" onClick={() => setOpenDeleteConfirm(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    size="md"
                                    className="flex-1"
                                    onClick={async () => {
                                        const token = getTytAccessToken();
                                        if (!token || ingredientDrawer?.type !== "edit") return;
                                        try {
                                            const res = await deleteIngrediente(ingredientDrawer.id, token);
                                            await parseJsonOrThrow<unknown>(res);
                                            toast.success("Ingrediente excluído com sucesso!");
                                            setOpenDeleteConfirm(false);
                                            closeIngredientDrawer();
                                            await reload();
                                        } catch (err) {
                                            if (err instanceof TytApiError)
                                                toast.error("Não foi possível excluir o ingrediente.", { description: parseApiErrorMessage(err.body) });
                                            else toast.error("Não foi possível excluir o ingrediente.");
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
