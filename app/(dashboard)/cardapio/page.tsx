"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    Archive,
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle,
    ChevronDown,
    Container,
    Download02,
    Edit02,
    Eye,
    FilterLines,
    LayerSingle,
    LayersThree02,
    LayersTwo01,
    Plus,
    ReceiptCheck,
    SearchLg,
    Settings01,
    Star01,
    Trash01,
    UploadCloud02,
    Zap,
} from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import * as Lucide from "lucide-react";
import { Button as AriaButton, type Key, type Selection } from "react-aria-components";
import { toast } from "sonner";
import { DishesFilterPopover, emptyDishesFilter, type DishesFilterOption, type DishesFilterState } from "./dishes-filter-popover";
import { IngredientsFilterPopover, emptyIngredientsFilter, type IngredientsFilterOption, type IngredientsFilterState } from "./ingredients-filter-popover";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Table, TableCard } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { Badge, BadgeWithIcon } from "@/components/base/badges/badges";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import {
    deleteIngrediente,
    getIngredienteById,
    getIngredientes,
    getIngredientesTemplate,
    postIngrediente,
    postIngredientesUpload,
    putIngrediente,
} from "@/lib/tyt-api/ingredientes";
import type { IngredienteCreateBody, IngredienteUpdateBody } from "@/lib/tyt-api/ingredientes";
import { ingredientesCategoriasApi } from "@/lib/tyt-api/ingredientes-categorias";
import { getPratos } from "@/lib/tyt-api/pratos";
import { ingredientesPrincipaisApi, pratosCategoriasApi, prefCulinariasApi, temasApi, tiposCozinhaApi } from "@/lib/tyt-api/pratos-catalogo";
import type { CatalogoDescricaoBody, IngredientePrincipalBody, PratoCategoriaBody } from "@/lib/tyt-api/pratos-catalogo";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { cx } from "@/utils/cx";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

type TabId = "dishes" | "ingredients" | "classifications";

type DishCard = {
    id: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    categoryBadges: Array<{ label: string; color: BadgeColors }>;
    serviceBadges: string[];
    destaque_site: boolean;
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

type CatalogItem = {
    id: number;
    title: string | null;
    descricao: string | null;
    icone?: string | null;
    updatedAt?: string | null;
};

type ClassificationKind =
    | "dish-categories"
    | "food-preferences"
    | "cuisine-types"
    | "main-ingredients"
    | "ingredient-categories"
    | "themes";

type ClassificationDrawerView =
    | { type: "create"; kind: ClassificationKind }
    | { type: "details"; kind: ClassificationKind; id: number }
    | { type: "edit"; kind: ClassificationKind; id: number };

const ICON_CATALOG: Array<{ id: string; label: string; Icon: ComponentType<{ className?: string }> }> = (() => {
    const processedIds = new Set<string>([
        "alert-circle",
        "archive",
        "arrow-left",
        "arrow-right",
        "check",
        "check-circle",
        "container",
        "layers-two",
        "receipt",
        "settings",
        "star",
        "zap",
    ]);

    const base = [
        { id: "alert-circle", label: "AlertCircle", Icon: AlertCircle },
        { id: "archive", label: "Archive", Icon: Archive },
        { id: "arrow-left", label: "ArrowLeft", Icon: ArrowLeft },
        { id: "arrow-right", label: "ArrowRight", Icon: ArrowRight },
        { id: "check", label: "Check", Icon: Check },
        { id: "check-circle", label: "CheckCircle", Icon: CheckCircle },
        { id: "container", label: "Container", Icon: Container },
        { id: "layers-two", label: "LayersTwo01", Icon: LayersTwo01 },
        { id: "receipt", label: "ReceiptCheck", Icon: ReceiptCheck },
        { id: "settings", label: "Settings01", Icon: Settings01 },
        { id: "star", label: "Star01", Icon: Star01 },
        { id: "zap", label: "Zap", Icon: Zap },
    ];

    const lucideItems = Object.keys(Lucide)
        .filter((key) => {
            const val = (Lucide as any)[key];
            return typeof val === "function" || (val && typeof val === "object" && (val as any).$$typeof);
        })
        .map((key) => {
            const id = key
                .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
                .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
                .toLowerCase();
            return {
                id,
                label: key,
                Icon: (Lucide as any)[key] as ComponentType<{ className?: string }>,
            };
        })
        .filter((item) => {
            if (processedIds.has(item.id)) {
                return false;
            }
            processedIds.add(item.id);
            return true;
        });

    return [...base, ...lucideItems];
})();

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

    const [dishPage, setDishPage] = useState(1);
    const [ingredientPage, setIngredientPage] = useState(1);

    useEffect(() => {
        setDishPage(1);
    }, [dishQuery]);

    useEffect(() => {
        setIngredientPage(1);
    }, [ingredientQuery]);

    const [dishes, setDishes] = useState<DishCard[]>([]);
    const [appliedDishFilter, setAppliedDishFilter] = useState<DishesFilterState>(() => emptyDishesFilter());
    const [appliedIngredientFilter, setAppliedIngredientFilter] = useState<IngredientsFilterState>(() => emptyIngredientsFilter());
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
    const [templateDownloading, setTemplateDownloading] = useState(false);

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

    const [dishCategories, setDishCategories] = useState<CatalogItem[]>([]);
    const [foodPreferences, setFoodPreferences] = useState<CatalogItem[]>([]);
    const [cuisineTypes, setCuisineTypes] = useState<CatalogItem[]>([]);
    const [mainIngredients, setMainIngredients] = useState<CatalogItem[]>([]);
    const [themes, setThemes] = useState<CatalogItem[]>([]);

    const [classificationDrawer, setClassificationDrawer] = useState<ClassificationDrawerView | null>(null);
    const [classificationLoading, setClassificationLoading] = useState(false);
    const [classificationError, setClassificationError] = useState<string | null>(null);
    const [classificationDetails, setClassificationDetails] = useState<Record<string, unknown> | null>(null);
    const [classificationForm, setClassificationForm] = useState<{ descricao: string; icone: string }>({ descricao: "", icone: "" });
    const [iconQuery, setIconQuery] = useState("");
    const [iconPickerOpen, setIconPickerOpen] = useState(false);
    const [openClassificationDeleteConfirm, setOpenClassificationDeleteConfirm] = useState(false);

    const requestIdRef = useRef(0);

    const reload = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        const token = getTytAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const [
                pratosRes,
                ingredientesRes,
                categoriasRes,
                pratosCategoriasRes,
                tiposCozinhaRes,
                temasRes,
                ingredientesPrincipaisRes,
                prefCulinariasRes,
            ] = await Promise.all([
                getPratos(token),
                getIngredientes(token),
                ingredientesCategoriasApi.getAll(token),
                pratosCategoriasApi.getAll(token),
                tiposCozinhaApi.getAll(token),
                temasApi.getAll(token),
                ingredientesPrincipaisApi.getAll(token),
                prefCulinariasApi.getAll(token),
            ]);

            const [
                pratosJson,
                ingredientesJson,
                categoriasJson,
                pratosCategoriasJson,
                tiposCozinhaJson,
                temasJson,
                ingredientesPrincipaisJson,
                prefCulinariasJson,
            ] = await Promise.all([
                parseJsonOrThrow<unknown>(pratosRes),
                parseJsonOrThrow<unknown>(ingredientesRes),
                parseJsonOrThrow<unknown>(categoriasRes),
                parseJsonOrThrow<unknown>(pratosCategoriasRes),
                parseJsonOrThrow<unknown>(tiposCozinhaRes),
                parseJsonOrThrow<unknown>(temasRes),
                parseJsonOrThrow<unknown>(ingredientesPrincipaisRes),
                parseJsonOrThrow<unknown>(prefCulinariasRes),
            ]);

            if (requestId !== requestIdRef.current) return;

            const categoriasList = normalizeList<unknown>(categoriasJson)
                .map((x) => {
                    if (!x || typeof x !== "object") return null;
                    const r = x as Record<string, unknown>;
                    const id = typeof r.id === "number" ? r.id : Number(r.id);
                    const descricao = typeof r.descricao === "string" ? r.descricao : null;
                    if (!Number.isFinite(id) || !descricao) return null;
                    if (typeof r.ativo === "boolean" && r.ativo === false) return null;
                    return { id, descricao };
                })
                .filter(Boolean) as IngredienteCategoria[];
            setCategories(categoriasList);

            const parseCatalogList = (raw: unknown): CatalogItem[] => {
                return normalizeList<unknown>(raw)
                    .map((x) => {
                        if (!x || typeof x !== "object") return null;
                        const r = x as Record<string, unknown>;
                        const id = typeof r.id === "number" ? r.id : Number(r.id);
                        const title = typeof r.nome_prato === "string" ? r.nome_prato : null;
                        const descricao = typeof r.descricao === "string" ? r.descricao : null;
                        if (!Number.isFinite(id) || !descricao) return null;
                        const icone = typeof r.icone === "string" ? r.icone : null;
                        const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : typeof r.updated_at === "string" ? r.updated_at : null;
                        return { id, title, descricao, icone, updatedAt } satisfies CatalogItem;
                    })
                    .filter(Boolean) as CatalogItem[];
            };

            setDishCategories(parseCatalogList(pratosCategoriasJson));
            setCuisineTypes(parseCatalogList(tiposCozinhaJson));
            setThemes(parseCatalogList(temasJson));
            setMainIngredients(parseCatalogList(ingredientesPrincipaisJson));
            setFoodPreferences(parseCatalogList(prefCulinariasJson));

            const pratosList = normalizeList<unknown>(pratosJson).map((x, idx) => {
                const r = (x && typeof x === "object" ? (x as Record<string, unknown>) : {}) as Record<string, unknown>;
                const id = r.id !== undefined ? String(r.id) : String(idx);
                const title = typeof r.nome_prato === "string" ? r.nome_prato : null;
                const description = typeof r.descricao === "string" ? r.descricao : null;

                const imageUrl = cleanUrl(r.foto1) ?? cleanUrl(r.imageUrl) ?? cleanUrl(r.foto) ?? null;

                const prefsRaw = (r.pratos_categorias ?? r.pref_culinarias ?? r.categorias ?? r.tags) as unknown;
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

                const destaque_site = coerceBool(r.destaque_site);

                return { id, title, description, imageUrl, categoryBadges, serviceBadges, destaque_site } satisfies DishCard;
            });
            setDishes(pratosList);

            const categoriasById = new Map(categoriasList.map((c) => [c.id, c.descricao]));
            const ingredientesList = normalizeList<unknown>(ingredientesJson)
                .filter((x) => {
                    if (!x || typeof x !== "object") return true;
                    const r = x as Record<string, unknown>;
                    if (typeof r.ativo === "boolean") return r.ativo;
                    return true;
                })
                .map((x, idx) => {
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
                    const unitLabel = volumePeso ? `${volumePeso}${unidadeMedida ?? unidade}` : unidadeMedida ?? unidade;
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

    const dishCategoryOptions = useMemo<DishesFilterOption[]>(() => {
        const cats = new Set<string>();
        dishes.forEach((d) => {
            d.categoryBadges.forEach((cb) => {
                if (cb.label) cats.add(cb.label);
            });
        });
        return Array.from(cats).map((c) => ({ id: c, label: c }));
    }, [dishes]);

    const ingredientCategoryOptions = useMemo<IngredientsFilterOption[]>(() => {
        const cats = new Set<string>();
        ingredients.forEach((i) => {
            if (i.categoryLabel) cats.add(i.categoryLabel);
        });
        return Array.from(cats).map((c) => ({ id: c, label: c }));
    }, [ingredients]);

    const dishItems = useMemo(() => {
        let list = dishes;
        if (appliedDishFilter.serviceTypes.length > 0) {
            list = list.filter((d) => d.serviceBadges.some((sb) => appliedDishFilter.serviceTypes.includes(sb)));
        }
        if (appliedDishFilter.categories.length > 0) {
            list = list.filter((d) => d.categoryBadges.some((cb) => appliedDishFilter.categories.includes(cb.label)));
        }
        const q = dishQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter((d) => `${d.title} ${d.description}`.toLowerCase().includes(q));
    }, [dishes, dishQuery, appliedDishFilter]);

    const dishLimit = 9;
    const totalDishPages = Math.max(Math.ceil(dishItems.length / dishLimit), 1);
    const paginatedDishItems = useMemo(() => {
        const startIndex = (dishPage - 1) * dishLimit;
        return dishItems.slice(startIndex, startIndex + dishLimit);
    }, [dishItems, dishPage]);

    const ingredientItems = useMemo(() => {
        let list = ingredients;
        if (appliedIngredientFilter.categories.length > 0) {
            list = list.filter((i) => appliedIngredientFilter.categories.includes(i.categoryLabel));
        }
        const q = ingredientQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter((i) => `${i.name} ${i.categoryLabel}`.toLowerCase().includes(q));
    }, [ingredients, ingredientQuery, appliedIngredientFilter]);

    const ingredientLimit = 10;
    const totalIngredientPages = Math.max(Math.ceil(ingredientItems.length / ingredientLimit), 1);
    const paginatedIngredientItems = useMemo(() => {
        const startIndex = (ingredientPage - 1) * ingredientLimit;
        return ingredientItems.slice(startIndex, startIndex + ingredientLimit);
    }, [ingredientItems, ingredientPage]);

    const tabItems = useMemo(() => {
        return [
            { id: "dishes", label: "Pratos" },
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

    const downloadIngredientsTemplate = useCallback(async () => {
        const token = getTytAccessToken();
        if (!token) {
            toast.error("Sessão expirada. Faça login novamente.");
            return;
        }

        setTemplateDownloading(true);
        try {
            const res = await getIngredientesTemplate(token);
            if (!res.ok) {
                let message = "Não foi possível baixar o template.";
                try {
                    const body = await res.json();
                    message = parseApiErrorMessage(body);
                } catch { }
                toast.error(message);
                return;
            }

            const blob = await res.blob();
            const cd = res.headers.get("content-disposition") ?? res.headers.get("Content-Disposition");
            const filename =
                cd?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]?.trim().replace(/^"+|"+$/g, "") ??
                cd?.match(/filename=([^;]+)/i)?.[1]?.trim().replace(/^"+|"+$/g, "") ??
                "template_ingredientes.xlsx";

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = decodeURIComponent(filename);
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            if (err instanceof TytApiError) toast.error("Não foi possível baixar o template.", { description: parseApiErrorMessage(err.body) });
            else toast.error("Não foi possível baixar o template.");
        } finally {
            setTemplateDownloading(false);
        }
    }, []);

    const closeClassificationDrawer = useCallback(() => {
        setClassificationDrawer(null);
        setClassificationError(null);
        setClassificationDetails(null);
        setOpenClassificationDeleteConfirm(false);
        setClassificationLoading(false);
        setIconQuery("");
        setIconPickerOpen(false);
    }, []);

    const loadClassificationDetails = useCallback(async (kind: ClassificationKind, id: number) => {
        const token = getTytAccessToken();
        if (!token) return;
        setClassificationLoading(true);
        setClassificationError(null);
        try {
            const res =
                kind === "dish-categories"
                    ? await pratosCategoriasApi.getById(id, token)
                    : kind === "cuisine-types"
                        ? await tiposCozinhaApi.getById(id, token)
                        : kind === "themes"
                            ? await temasApi.getById(id, token)
                            : kind === "main-ingredients"
                                ? await ingredientesPrincipaisApi.getById(id, token)
                                : kind === "food-preferences"
                                    ? await prefCulinariasApi.getById(id, token)
                                    : await ingredientesCategoriasApi.getById(id, token);

            const json = await parseJsonOrThrow<unknown>(res);
            const record = getRecord(json) ?? getRecord((json as Record<string, unknown>)?.data) ?? null;
            setClassificationDetails(record);
        } catch (err) {
            if (err instanceof TytApiError) setClassificationError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setClassificationError(err.message);
            else setClassificationError("Ocorreu um erro. Tente novamente.");
        } finally {
            setClassificationLoading(false);
        }
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

    const classificationView = useMemo(() => {
        const record = classificationDetails;
        if (!record) return null;
        const id = getNumberValue(record, ["id"]) ?? null;
        const descricao = getStringValue(record, ["descricao", "nome", "name"]) ?? "—";
        const icone = getStringValue(record, ["icone"]) ?? null;
        const updatedAt =
            getStringValue(record, ["updatedAt", "updated_at", "updated"]) ?? getStringValue(record, ["createdAt", "created_at"]) ?? null;
        return { id, descricao, icone, updatedAt };
    }, [classificationDetails]);

    const actionButton =
        selectedTab === "dishes" ? (
            <Button color="primary" size="md" iconLeading={Plus} href="/cardapio/pratos/new">
                Novo prato
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
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-8">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>Cardápio</h1>
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

                <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} className="flex w-full flex-col gap-8">
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
                                    <Button
                                        color="secondary"
                                        size="md"
                                        iconLeading={Download02}
                                        onClick={() => {
                                            toast.success("Exportação de pratos iniciada!");
                                            // TODO: Integrar com a API de exportação de pratos
                                        }}
                                    >
                                        Exportar dados
                                    </Button>
                                    <DishesFilterPopover
                                        applied={appliedDishFilter}
                                        onApply={setAppliedDishFilter}
                                        categoryOptions={dishCategoryOptions}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {paginatedDishItems.map((dish) => (
                                    <article key={dish.id} className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                        <div className="relative aspect-[16/9] w-full bg-secondary">
                                            {dish.destaque_site && (
                                                <div className="absolute top-3 right-3 z-10">
                                                    <BadgeWithIcon size="sm" type="pill-color" color="brand" iconLeading={Star01}>
                                                        Destaque
                                                    </BadgeWithIcon>
                                                </div>
                                            )}
                                            {dish.imageUrl ? (
                                                <img src={dish.imageUrl} alt={dish.title || ""} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-sm text-tertiary">Sem imagem</div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-3 px-4 py-4">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-primary">{dish.title || ""}</p>
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
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                iconLeading={Eye}
                                                href={`/cardapio/pratos/${dish.id}`}
                                            >
                                                Detalhes
                                            </Button>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            {totalDishPages > 1 && (
                                <div className="flex items-center justify-between border-t border-secondary mt-6 pt-4">
                                    <Button
                                        color="secondary"
                                        size="sm"
                                        onClick={() => setDishPage((p) => Math.max(p - 1, 1))}
                                        isDisabled={dishPage === 1}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-tertiary">
                                        Página {dishPage} de {totalDishPages}
                                    </span>
                                    <Button
                                        color="secondary"
                                        size="sm"
                                        onClick={() => setDishPage((p) => Math.min(p + 1, totalDishPages))}
                                        isDisabled={dishPage === totalDishPages}
                                    >
                                        Próximo
                                    </Button>
                                </div>
                            )}
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
                                            <Button
                                                color="secondary"
                                                size="md"
                                                iconLeading={Download02}
                                                onClick={() => {
                                                    toast.success("Exportação de ingredientes iniciada!");
                                                    // TODO: Integrar com a API de exportação de ingredientes
                                                }}
                                            >
                                                Exportar dados
                                            </Button>
                                            <IngredientsFilterPopover
                                                applied={appliedIngredientFilter}
                                                onApply={setAppliedIngredientFilter}
                                                categoryOptions={ingredientCategoryOptions}
                                            />
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
                                        <Table.Body items={paginatedIngredientItems}>
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

                                    {totalIngredientPages > 1 && (
                                        <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                onClick={() => setIngredientPage((p) => Math.max(p - 1, 1))}
                                                isDisabled={ingredientPage === 1}
                                            >
                                                Anterior
                                            </Button>
                                            <span className="text-sm text-tertiary">
                                                Página {ingredientPage} de {totalIngredientPages}
                                            </span>
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                onClick={() => setIngredientPage((p) => Math.min(p + 1, totalIngredientPages))}
                                                isDisabled={ingredientPage === totalIngredientPages}
                                            >
                                                Próximo
                                            </Button>
                                        </div>
                                    )}
                                </TableCard.Root>
                            </div>
                        </section>
                    </Tabs.Panel>

                    <Tabs.Panel id="classifications" className="flex flex-col gap-4 outline-hidden">
                        <section className="flex flex-col gap-4">
                            <div>
                                <p className="text-md font-semibold text-primary">Classificações</p>
                                <p className="mt-1 text-sm text-tertiary">Organize e padronize os critérios que estruturam e categorizam os pratos do cardápio.</p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-primary">Categorias de prato</p>
                                                <Badge size="sm" type="pill-color" color="brand">
                                                    {dishCategories.length}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Classificação dos pratos no cardápio</p>
                                        </div>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={Plus}
                                            onClick={() => {
                                                setClassificationForm({ descricao: "", icone: "" });
                                                setClassificationError(null);
                                                setClassificationDetails(null);
                                                setClassificationDrawer({ type: "create", kind: "dish-categories" });
                                            }}
                                        >
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {dishCategories.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setClassificationDetails(null);
                                                    setClassificationError(null);
                                                    setClassificationDrawer({ type: "details", kind: "dish-categories", id: c.id });
                                                    void loadClassificationDetails("dish-categories", c.id);
                                                }}
                                            >
                                                <Badge size="sm" type="pill-color" color="gray">
                                                    {c.descricao}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-primary">Preferências alimentares</p>
                                                <Badge size="sm" type="pill-color" color="brand">
                                                    {foodPreferences.length}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Restrições e escolhas alimentares</p>
                                        </div>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={Plus}
                                            onClick={() => {
                                                setClassificationForm({ descricao: "", icone: "" });
                                                setClassificationError(null);
                                                setClassificationDetails(null);
                                                setClassificationDrawer({ type: "create", kind: "food-preferences" });
                                            }}
                                        >
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {foodPreferences.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setClassificationDetails(null);
                                                    setClassificationError(null);
                                                    setClassificationDrawer({ type: "details", kind: "food-preferences", id: c.id });
                                                    void loadClassificationDetails("food-preferences", c.id);
                                                }}
                                            >
                                                <Badge size="sm" type="pill-color" color="gray">
                                                    {c.descricao}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-primary">Tipos de cozinha</p>
                                                <Badge size="sm" type="pill-color" color="brand">
                                                    {cuisineTypes.length}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Origem culinária dos pratos</p>
                                        </div>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={Plus}
                                            onClick={() => {
                                                setClassificationForm({ descricao: "", icone: "" });
                                                setClassificationError(null);
                                                setClassificationDetails(null);
                                                setClassificationDrawer({ type: "create", kind: "cuisine-types" });
                                            }}
                                        >
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {cuisineTypes.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setClassificationDetails(null);
                                                    setClassificationError(null);
                                                    setClassificationDrawer({ type: "details", kind: "cuisine-types", id: c.id });
                                                    void loadClassificationDetails("cuisine-types", c.id);
                                                }}
                                            >
                                                <Badge size="sm" type="pill-color" color="gray">
                                                    {c.descricao}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-primary">Ingredientes principais</p>
                                                <Badge size="sm" type="pill-color" color="brand">
                                                    {mainIngredients.length}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Base proteica ou destaque do prato</p>
                                        </div>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={Plus}
                                            onClick={() => {
                                                setClassificationForm({ descricao: "", icone: "" });
                                                setClassificationError(null);
                                                setClassificationDetails(null);
                                                setIconQuery("");
                                                setIconPickerOpen(false);
                                                setClassificationDrawer({ type: "create", kind: "main-ingredients" });
                                            }}
                                        >
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {mainIngredients.map((c, idx) => {
                                            const icon = c.icone ? ICON_CATALOG.find((x) => x.id === c.icone) : null;
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setClassificationDetails(null);
                                                        setClassificationError(null);
                                                        setClassificationDrawer({ type: "details", kind: "main-ingredients", id: c.id });
                                                        void loadClassificationDetails("main-ingredients", c.id);
                                                    }}
                                                >
                                                    <Badge size="sm" type="pill-color" color={badgeColorByIndex(idx)}>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {icon ? <icon.Icon className="size-3.5" /> : null}
                                                            {c.descricao}
                                                        </span>
                                                    </Badge>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-primary">Categoria de ingredientes</p>
                                                <Badge size="sm" type="pill-color" color="brand">
                                                    {categories.length}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Crie tipo de ingredientes</p>
                                        </div>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={Plus}
                                            onClick={() => {
                                                setClassificationForm({ descricao: "", icone: "" });
                                                setClassificationError(null);
                                                setClassificationDetails(null);
                                                setClassificationDrawer({ type: "create", kind: "ingredient-categories" });
                                            }}
                                        >
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {categories.map((c, idx) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setClassificationDetails(null);
                                                    setClassificationError(null);
                                                    setClassificationDrawer({ type: "details", kind: "ingredient-categories", id: c.id });
                                                    void loadClassificationDetails("ingredient-categories", c.id);
                                                }}
                                            >
                                                <Badge size="sm" type="pill-color" color={badgeColorByIndex(idx)}>
                                                    {c.descricao}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-primary">Temas</p>
                                                <Badge size="sm" type="pill-color" color="brand">
                                                    {themes.length}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Crie temas com cardápios completos para diferentes ocasiões.</p>
                                        </div>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={Plus}
                                            onClick={() => {
                                                setClassificationForm({ descricao: "", icone: "" });
                                                setClassificationError(null);
                                                setClassificationDetails(null);
                                                setClassificationDrawer({ type: "create", kind: "themes" });
                                            }}
                                        >
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {themes.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setClassificationDetails(null);
                                                    setClassificationError(null);
                                                    setClassificationDrawer({ type: "details", kind: "themes", id: c.id });
                                                    void loadClassificationDetails("themes", c.id);
                                                }}
                                            >
                                                <Badge size="sm" type="pill-color" color="gray">
                                                    {c.descricao}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
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
                                                        <p className="text-sm font-semibold text-primary">Marca preferencial</p>
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

                                                    <hr className="my-4 border-secondary" />

                                                    <div>
                                                        <p className="text-sm font-semibold text-primary">Quantidade</p>
                                                        <p className="mt-1 text-sm text-tertiary">
                                                            {(() => {
                                                                const n = getNumberValue(ingredientDetails ?? {}, ["quantidade"]);
                                                                if (n === null) return "—";
                                                                return `${n} ${n === 1 ? "embalagem" : "embalagens"}`;
                                                            })()}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Medida</p>
                                                        <p className="mt-1 text-sm text-tertiary">
                                                            {ingredientView.volumePeso
                                                                ? `${ingredientView.volumePeso} ${getStringValue(ingredientDetails ?? {}, ["unidade_medida"]) ?? ingredientView.unidade}`
                                                                : getStringValue(ingredientDetails ?? {}, ["unidade_medida"]) ?? ingredientView.unidade}
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

                                                        <Input
                                                            label="Marca preferencial"
                                                            value={ingredientForm.marca_pref}
                                                            onChange={(v) => setIngredientForm((p) => ({ ...p, marca_pref: v }))}
                                                            isRequired
                                                        />

                                                        <Input
                                                            label="Fornecedor"
                                                            value={ingredientForm.fornecedor}
                                                            onChange={(v) => setIngredientForm((p) => ({ ...p, fornecedor: v }))}
                                                            isRequired
                                                        />
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                    <p className="text-sm font-semibold text-primary">Quantidade (Peso/Vol.)</p>
                                                    <div className="mt-4 flex flex-col gap-4">
                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <Input
                                                                label="Volume/Peso"
                                                                value={ingredientForm.volume_peso}
                                                                onChange={(v) => setIngredientForm((p) => ({ ...p, volume_peso: v }))}
                                                                isRequired
                                                            />
                                                            <Select
                                                                aria-label="Unidade"
                                                                label="Unidade"
                                                                size="md"
                                                                items={unitOptions}
                                                                selectedKey={ingredientForm.unidade}
                                                                onSelectionChange={(key) => {
                                                                    const u = key ? String(key) : "g";
                                                                    setIngredientForm((p) => ({ ...p, unidade: u, unidade_medida: u }));
                                                                }}
                                                            >
                                                                {(item) => <Select.Item {...item} />}
                                                            </Select>
                                                        </div>

                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <Input
                                                                label="Quantidade"
                                                                value={ingredientForm.quantidade}
                                                                onChange={(v) => setIngredientForm((p) => ({ ...p, quantidade: v }))}
                                                                isRequired
                                                            />
                                                            <Input
                                                                label="Custo unitário"
                                                                value={ingredientForm.valor}
                                                                onChange={(v) => setIngredientForm((p) => ({ ...p, valor: v }))}
                                                                isRequired
                                                            />
                                                        </div>
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
                                        <Button
                                            color="link-color"
                                            size="sm"
                                            iconLeading={Download02}
                                            isLoading={templateDownloading}
                                            onClick={() => void downloadIngredientsTemplate()}
                                            className="w-fit"
                                        >
                                            Baixar template de exemplo
                                        </Button>
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

                                                <Input
                                                    label="Marca preferencial"
                                                    value={ingredientForm.marca_pref}
                                                    onChange={(v) => setIngredientForm((p) => ({ ...p, marca_pref: v }))}
                                                    isRequired
                                                />

                                                <Input
                                                    label="Fornecedor"
                                                    value={ingredientForm.fornecedor}
                                                    onChange={(v) => setIngredientForm((p) => ({ ...p, fornecedor: v }))}
                                                    isRequired
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                            <p className="text-sm font-semibold text-primary">Quantidade (Peso/Vol.)</p>
                                            <div className="mt-4 flex flex-col gap-4">
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <Input
                                                        label="Volume/Peso"
                                                        value={ingredientForm.volume_peso}
                                                        onChange={(v) => setIngredientForm((p) => ({ ...p, volume_peso: v }))}
                                                        isRequired
                                                    />
                                                    <Select
                                                        aria-label="Unidade"
                                                        label="Unidade"
                                                        size="md"
                                                        items={unitOptions}
                                                        selectedKey={ingredientForm.unidade}
                                                        onSelectionChange={(key) => {
                                                            const u = key ? String(key) : "g";
                                                            setIngredientForm((p) => ({ ...p, unidade: u, unidade_medida: u }));
                                                        }}
                                                    >
                                                        {(item) => <Select.Item {...item} />}
                                                    </Select>
                                                </div>

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <Input
                                                        label="Quantidade"
                                                        value={ingredientForm.quantidade}
                                                        onChange={(v) => setIngredientForm((p) => ({ ...p, quantidade: v }))}
                                                        isRequired
                                                    />
                                                    <Input
                                                        label="Custo unitário"
                                                        value={ingredientForm.valor}
                                                        onChange={(v) => setIngredientForm((p) => ({ ...p, valor: v }))}
                                                        isRequired
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setPickCreateMode("single")}
                                            className={cx(
                                                "flex w-full items-center justify-between gap-4 rounded-xl border bg-primary px-4 py-4 text-left shadow-xs mt-2",
                                                pickCreateMode === "single" ? "border-brand ring-1 ring-brand" : "border-secondary",
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-tertiary">
                                                    <LayerSingle className="size-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">Unitário</p>
                                                    <p className="mt-1 text-sm text-tertiary">Cadastrar manualmente</p>
                                                </div>
                                            </div>
                                            <div
                                                className={cx(
                                                    "size-5 rounded-md border flex items-center justify-center p-0.5",
                                                    pickCreateMode === "single" ? "border-brand-solid bg-brand-solid" : "border-secondary",
                                                )}
                                            >
                                                {pickCreateMode === "single" && (
                                                    <Check className="size-5 text-white" />
                                                )}
                                            </div>
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
                                                    <LayersThree02 className="size-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">Em lote</p>
                                                    <p className="mt-1 text-sm text-tertiary">Importar planilha</p>
                                                </div>
                                            </div>
                                            <div
                                                className={cx(
                                                    "size-5 rounded-md border flex items-center justify-center p-0.5",
                                                    pickCreateMode === "batch" ? "border-brand-solid bg-brand-solid" : "border-secondary",
                                                )}
                                            >
                                                {pickCreateMode === "batch" && (
                                                    <Check className="size-5 text-white" />
                                                )}
                                            </div>
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
                                                iconTrailing={Lucide.Save}
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

                                                    if (
                                                        !descricao ||
                                                        !idCategoria ||
                                                        !unidade ||
                                                        valor === null ||
                                                        !marcaPref ||
                                                        !fornecedor ||
                                                        volumePeso === null ||
                                                        quantidade === null
                                                    ) {
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
                                                iconTrailing={Lucide.Save}
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

                                                    if (
                                                        !descricao ||
                                                        !idCategoria ||
                                                        !unidade ||
                                                        valor === null ||
                                                        !marcaPref ||
                                                        !fornecedor ||
                                                        volumePeso === null ||
                                                        quantidade === null
                                                    ) {
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

            <SlideoutMenu
                isOpen={classificationDrawer !== null}
                isDismissable
                onOpenChange={(open) => (!open ? closeClassificationDrawer() : undefined)}
            >
                {({ close }) => {
                    const type = classificationDrawer?.type ?? null;
                    const kind = classificationDrawer?.kind ?? null;

                    const closeAll = () => {
                        close();
                        closeClassificationDrawer();
                    };

                    const kindLabel =
                        kind === "dish-categories"
                            ? "categoria de prato"
                            : kind === "food-preferences"
                                ? "preferência alimentar"
                                : kind === "cuisine-types"
                                    ? "tipo de cozinha"
                                    : kind === "main-ingredients"
                                        ? "ingrediente principal"
                                        : kind === "ingredient-categories"
                                            ? "categoria ingrediente"
                                            : "tema";

                    const title =
                        type === "create"
                            ? `Adicionar ${kindLabel}`
                            : type === "details"
                                ? kind === "cuisine-types" || kind === "main-ingredients" || kind === "themes"
                                    ? `Detalhes do ${kindLabel}`
                                    : `Detalhes da ${kindLabel}`
                                : type === "edit"
                                    ? `Editar ${kindLabel}`
                                    : "Classificação";

                    const description =
                        type === "details"
                            ? "Informações completas desta classificação."
                            : type === "edit"
                                ? "Atualize as informações da classificação."
                                : "Preencha o nome abaixo.";

                    const selectedIcon = classificationForm.icone
                        ? ICON_CATALOG.find((x) => x.id === classificationForm.icone) ?? null
                        : null;

                    const filteredIcons = ICON_CATALOG.filter((x) => {
                        const q = iconQuery.trim().toLowerCase();
                        if (!q) return true;
                        return `${x.id} ${x.label}`.toLowerCase().includes(q);
                    }).slice(0, 48);

                    return (
                        <>
                            <SlideoutMenu.Header onClose={closeAll}>
                                <div className="flex flex-col gap-1 pr-10">
                                    <p className="text-md font-semibold text-primary">{title}</p>
                                    <p className="text-sm text-tertiary">{description}</p>
                                </div>
                            </SlideoutMenu.Header>

                            <SlideoutMenu.Content>
                                {classificationError ? <p className="text-sm text-error-primary">{classificationError}</p> : null}

                                {type === "details" || type === "edit" ? (
                                    classificationLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." />
                                        </div>
                                    ) : classificationView ? (
                                        type === "details" ? (
                                            <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                <p className="text-sm font-semibold text-primary">Nome</p>
                                                <p className="mt-1 text-sm text-tertiary">{classificationView.descricao}</p>

                                                {kind === "main-ingredients" ? (
                                                    <div className="mt-4">
                                                        <p className="text-sm font-semibold text-primary">Ícone</p>
                                                        <div className="mt-2">
                                                            {classificationView.icone ? (
                                                                (() => {
                                                                    const icon = ICON_CATALOG.find((x) => x.id === classificationView.icone);
                                                                    return icon ? (
                                                                        <div className="inline-flex items-center gap-2 rounded-lg border border-secondary px-3 py-2 text-sm text-tertiary">
                                                                            <icon.Icon className="size-4" />
                                                                            {icon.label}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-sm text-tertiary">{classificationView.icone}</p>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <p className="text-sm text-tertiary">—</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {classificationView.updatedAt ? (
                                                    <p className="mt-4 text-xs text-tertiary">
                                                        Atualizado em {formatDatePtBr(classificationView.updatedAt)}
                                                    </p>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                <p className="text-sm font-semibold text-primary">Nomenclatura</p>
                                                <div className="mt-4 flex flex-col gap-4">
                                                    <Input
                                                        label="Nome"
                                                        value={classificationForm.descricao}
                                                        onChange={(v) => setClassificationForm((p) => ({ ...p, descricao: v }))}
                                                        isRequired
                                                    />

                                                    {kind === "main-ingredients" ? (
                                                        <div className="flex flex-col gap-1.5">
                                                            <p className="text-sm font-medium text-secondary">Ícone *</p>
                                                            <Dropdown.Root isOpen={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                                                                <AriaButton
                                                                    className={cx(
                                                                        "flex w-full items-center justify-between gap-3 rounded-lg bg-primary px-3 py-2 shadow-xs ring-1 ring-primary ring-inset outline-hidden transition-shadow duration-100 ease-linear cursor-pointer",
                                                                        iconPickerOpen ? "ring-2 ring-brand" : null,
                                                                    )}
                                                                >
                                                                    <span className="inline-flex min-w-0 items-center gap-2">
                                                                        {selectedIcon ? <selectedIcon.Icon className="size-4 text-tertiary" /> : <Star01 className="size-4 text-tertiary" />}
                                                                        <span className="truncate text-sm text-tertiary">
                                                                            {selectedIcon ? selectedIcon.label : "Selecione um ícone"}
                                                                        </span>
                                                                    </span>
                                                                    <ChevronDown className="size-4 text-tertiary" />
                                                                </AriaButton>

                                                                <Dropdown.Popover className="w-[360px] p-3">
                                                                    <Input
                                                                        placeholder="Buscar ícone..."
                                                                        icon={SearchLg}
                                                                        value={iconQuery}
                                                                        onChange={setIconQuery}
                                                                    />
                                                                    <div className="mt-3 grid grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-1">
                                                                        {filteredIcons.map((i) => (
                                                                            <button
                                                                                key={i.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setClassificationForm((p) => ({ ...p, icone: i.id }));
                                                                                    setIconPickerOpen(false);
                                                                                }}
                                                                                className={cx(
                                                                                    "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center",
                                                                                    classificationForm.icone === i.id ? "border-brand ring-1 ring-brand" : "border-secondary",
                                                                                )}
                                                                            >
                                                                                <i.Icon className="size-5 text-tertiary" />
                                                                                <span className="w-full truncate text-[11px] text-tertiary">{i.label}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </Dropdown.Popover>
                                                            </Dropdown.Root>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-sm text-tertiary">Não foi possível carregar os detalhes.</p>
                                    )
                                ) : type === "create" ? (
                                    <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                        <p className="text-sm font-semibold text-primary">Nomenclatura</p>
                                        <div className="mt-4 flex flex-col gap-4">
                                            <Input
                                                label="Nome"
                                                value={classificationForm.descricao}
                                                onChange={(v) => setClassificationForm((p) => ({ ...p, descricao: v }))}
                                                isRequired
                                            />

                                            {kind === "main-ingredients" ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <p className="text-sm font-medium text-secondary">Ícone *</p>
                                                    <Dropdown.Root isOpen={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                                                        <AriaButton

                                                            className={cx(
                                                                "flex w-full items-center justify-between gap-3 rounded-lg bg-primary px-3 py-2 shadow-xs ring-1 ring-primary ring-inset outline-hidden transition-shadow duration-100 ease-linear cursor-pointer",
                                                                iconPickerOpen ? "ring-2 ring-brand" : null,
                                                            )}
                                                        >
                                                            <span className="inline-flex min-w-0 items-center gap-2">
                                                                {selectedIcon ? <selectedIcon.Icon className="size-4 text-tertiary" /> : <Star01 className="size-4 text-tertiary" />}
                                                                <span className="truncate text-sm text-tertiary">
                                                                    {selectedIcon ? selectedIcon.label : "Selecione um ícone"}
                                                                </span>
                                                            </span>
                                                            <ChevronDown className="size-4 text-tertiary" />
                                                        </AriaButton>

                                                        <Dropdown.Popover className="w-[400px] p-3">
                                                            <Input placeholder="Buscar ícone..." icon={SearchLg} value={iconQuery} onChange={setIconQuery} />
                                                            <div className="mt-3 grid grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-1">
                                                                {filteredIcons.map((i) => (
                                                                    <button
                                                                        key={i.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setClassificationForm((p) => ({ ...p, icone: i.id }));
                                                                            setIconPickerOpen(false);
                                                                        }}
                                                                        className={cx(
                                                                            "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center",
                                                                            classificationForm.icone === i.id ? "border-brand ring-1 ring-brand" : "border-secondary",
                                                                        )}
                                                                    >
                                                                        <i.Icon className="size-5 text-tertiary" />
                                                                        <span className="w-full truncate text-[11px] text-tertiary">{i.label}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </Dropdown.Popover>
                                                    </Dropdown.Root>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                            </SlideoutMenu.Content>

                            <SlideoutMenu.Footer>
                                {type === "details" ? (
                                    <div className="flex justify-end">
                                        <Button
                                            color="secondary"
                                            size="md"
                                            iconTrailing={Edit02}
                                            onClick={() => {
                                                if (!kind || classificationDrawer?.type !== "details") return;
                                                if (!classificationView?.id) return;
                                                setClassificationForm({
                                                    descricao: classificationView.descricao === "—" ? "" : classificationView.descricao,
                                                    icone: classificationView.icone ?? "",
                                                });
                                                setClassificationDrawer({ type: "edit", kind, id: classificationDrawer.id });
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
                                                onClick={() => setOpenClassificationDeleteConfirm(true)}
                                            >
                                                Excluir
                                            </Button>
                                        ) : null}

                                        <Button
                                            color="secondary"
                                            size="md"
                                            className="flex-1"
                                            isDisabled={classificationLoading}
                                            onClick={closeAll}
                                        >
                                            Cancelar
                                        </Button>

                                        <Button
                                            color="primary"
                                            size="md"
                                            className="flex-1"
                                            isLoading={classificationLoading}
                                            onClick={async () => {
                                                const token = getTytAccessToken();
                                                if (!token || !kind || !type) return;

                                                const descricao = classificationForm.descricao.trim();
                                                const icone = classificationForm.icone.trim();

                                                if (!descricao) {
                                                    toast.error("Preencha o nome.");
                                                    return;
                                                }

                                                if (kind === "main-ingredients" && !icone) {
                                                    toast.error("Selecione um ícone.");
                                                    return;
                                                }

                                                setClassificationLoading(true);
                                                try {
                                                    const isEdit = type === "edit" && classificationDrawer?.type === "edit";
                                                    const id = isEdit ? classificationDrawer.id : null;

                                                    const res =
                                                        kind === "dish-categories"
                                                            ? isEdit && id !== null
                                                                ? await pratosCategoriasApi.update(id, { descricao, icone: "knifefork" } satisfies PratoCategoriaBody, token)
                                                                : await pratosCategoriasApi.create({ descricao, icone: "knifefork" } satisfies PratoCategoriaBody, token)
                                                            : kind === "cuisine-types"
                                                                ? isEdit && id !== null
                                                                    ? await tiposCozinhaApi.update(id, { descricao } satisfies CatalogoDescricaoBody, token)
                                                                    : await tiposCozinhaApi.create({ descricao } satisfies CatalogoDescricaoBody, token)
                                                                : kind === "themes"
                                                                    ? isEdit && id !== null
                                                                        ? await temasApi.update(id, { descricao } satisfies CatalogoDescricaoBody, token)
                                                                        : await temasApi.create({ descricao } satisfies CatalogoDescricaoBody, token)
                                                                    : kind === "food-preferences"
                                                                        ? isEdit && id !== null
                                                                            ? await prefCulinariasApi.update(id, { descricao } satisfies CatalogoDescricaoBody, token)
                                                                            : await prefCulinariasApi.create({ descricao } satisfies CatalogoDescricaoBody, token)
                                                                        : kind === "main-ingredients"
                                                                            ? isEdit && id !== null
                                                                                ? await ingredientesPrincipaisApi.update(
                                                                                    id,
                                                                                    { descricao, icone } satisfies IngredientePrincipalBody,
                                                                                    token,
                                                                                )
                                                                                : await ingredientesPrincipaisApi.create(
                                                                                    { descricao, icone } satisfies IngredientePrincipalBody,
                                                                                    token,
                                                                                )
                                                                            : isEdit && id !== null
                                                                                ? await ingredientesCategoriasApi.update(id, { descricao }, token)
                                                                                : await ingredientesCategoriasApi.create({ descricao }, token);

                                                    await parseJsonOrThrow<unknown>(res);
                                                    toast.success(isEdit ? "Classificação atualizada com sucesso!" : "Classificação criada com sucesso!");
                                                    closeAll();
                                                    await reload();
                                                } catch (err) {
                                                    if (err instanceof TytApiError)
                                                        toast.error("Não foi possível salvar.", { description: parseApiErrorMessage(err.body) });
                                                    else toast.error("Não foi possível salvar.");
                                                } finally {
                                                    setClassificationLoading(false);
                                                }
                                            }}
                                        >
                                            Salvar
                                        </Button>
                                    </div>
                                )}
                            </SlideoutMenu.Footer>
                        </>
                    );
                }}
            </SlideoutMenu>

            <ModalOverlay
                isOpen={openClassificationDeleteConfirm}
                isDismissable
                onOpenChange={(open) => {
                    if (!open) setOpenClassificationDeleteConfirm(false);
                }}
            >
                <Modal>
                    <Dialog>
                        <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                            <div className="flex items-start justify-between gap-4 border-b border-secondary px-6 py-5">
                                <div className="min-w-0">
                                    <p className="text-md font-semibold text-primary">
                                        Excluir {classificationForm.descricao ? `${classificationForm.descricao}?` : "item?"}
                                    </p>
                                    <p className="mt-1 text-sm text-tertiary">
                                        Você tem certeza que deseja excluir esta classificação? Esta ação não poderá ser desfeita.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 px-6 py-5">
                                <Button
                                    color="secondary"
                                    size="md"
                                    className="flex-1"
                                    onClick={() => setOpenClassificationDeleteConfirm(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    size="md"
                                    className="flex-1"
                                    isLoading={classificationLoading}
                                    onClick={async () => {
                                        const token = getTytAccessToken();
                                        if (!token || classificationDrawer?.type !== "edit") return;
                                        setClassificationLoading(true);
                                        try {
                                            const kind = classificationDrawer.kind;
                                            const id = classificationDrawer.id;
                                            const res =
                                                kind === "dish-categories"
                                                    ? await pratosCategoriasApi.remove(id, token)
                                                    : kind === "cuisine-types"
                                                        ? await tiposCozinhaApi.remove(id, token)
                                                        : kind === "themes"
                                                            ? await temasApi.remove(id, token)
                                                            : kind === "food-preferences"
                                                                ? await prefCulinariasApi.remove(id, token)
                                                                : kind === "main-ingredients"
                                                                    ? await ingredientesPrincipaisApi.remove(id, token)
                                                                    : await ingredientesCategoriasApi.remove(id, token);
                                            await parseJsonOrThrow<unknown>(res);
                                            toast.success("Classificação excluída com sucesso!");
                                            setOpenClassificationDeleteConfirm(false);
                                            closeClassificationDrawer();
                                            await reload();
                                        } catch (err) {
                                            if (err instanceof TytApiError)
                                                toast.error("Não foi possível excluir.", { description: parseApiErrorMessage(err.body) });
                                            else toast.error("Não foi possível excluir.");
                                        } finally {
                                            setClassificationLoading(false);
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
