"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Download02, Trash01 } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import { useRouter } from "next/navigation";
import type { Selection } from "react-aria-components";
import { toast } from "sonner";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import { getIngredientes } from "@/lib/tyt-api/ingredientes";
import { deletePrato, getPratoById, putPratoFromFields } from "@/lib/tyt-api/pratos";
import { ingredientesPrincipaisApi, pratosCategoriasApi, prefCulinariasApi, temasApi, tiposCozinhaApi } from "@/lib/tyt-api/pratos-catalogo";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { cx } from "@/utils/cx";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function isWithinUploadLimit(file: File, label: string) {
    if (file.size <= MAX_UPLOAD_BYTES) return true;
    toast.error(`${label} excede 10MB.`, { description: "Escolha um arquivo com até 10MB." });
    return false;
}

type CatalogItem = { id: number; descricao: string };

function getRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
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

function coerceBool(v: unknown): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1") return true;
        if (s === "false" || s === "0") return false;
    }
    return false;
}

function cleanUrl(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const trimmed = v.trim().replace(/`/g, "").trim().replace(/^"|"$/g, "");
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return trimmed;
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

export default function DishEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: dishId } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);

    const [dishCategories, setDishCategories] = useState<CatalogItem[]>([]);
    const [foodPreferences, setFoodPreferences] = useState<CatalogItem[]>([]);
    const [cuisineTypes, setCuisineTypes] = useState<CatalogItem[]>([]);
    const [mainIngredients, setMainIngredients] = useState<CatalogItem[]>([]);
    const [themes, setThemes] = useState<CatalogItem[]>([]);
    const [ingredients, setIngredients] = useState<CatalogItem[]>([]);

    const [categorySelection, setCategorySelection] = useState<Selection>(new Set());
    const [foodPreferenceSelection, setFoodPreferenceSelection] = useState<Set<string>>(new Set());
    const [cuisineTypeSelection, setCuisineTypeSelection] = useState<Set<string>>(new Set());
    const [mainIngredientSelection, setMainIngredientSelection] = useState<Set<string>>(new Set());
    const [themeSelection, setThemeSelection] = useState<Set<string>>(new Set());
    const [ingredientsSelection, setIngredientsSelection] = useState<Set<string>>(new Set());

    const [foodPreferenceKey, setFoodPreferenceKey] = useState<string | null>(null);
    const [foodPreferenceQuery, setFoodPreferenceQuery] = useState("");
    const [cuisineTypeKey, setCuisineTypeKey] = useState<string | null>(null);
    const [cuisineTypeQuery, setCuisineTypeQuery] = useState("");
    const [mainIngredientKey, setMainIngredientKey] = useState<string | null>(null);
    const [mainIngredientQuery, setMainIngredientQuery] = useState("");
    const [themeKey, setThemeKey] = useState<string | null>(null);
    const [themeQuery, setThemeQuery] = useState("");
    const [ingredientKey, setIngredientKey] = useState<string | null>(null);
    const [ingredientQuery, setIngredientQuery] = useState("");
    const [foodPreferenceOpen, setFoodPreferenceOpen] = useState(false);
    const [mainIngredientOpen, setMainIngredientOpen] = useState(false);
    const [cuisineTypeOpen, setCuisineTypeOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [ingredientOpen, setIngredientOpen] = useState(false);
    const [form, setForm] = useState<{
        name: string;
        descriptionText: string;
        quantity: string;
        ativo: boolean;
        mealPreap: boolean;
        getTogheter: boolean;
        receitaFile: File | null;
        fichaTecnicaFile: File | null;
        foto1File: File | null;
        foto2File: File | null;
    }>({
        name: "",
        descriptionText: "",
        quantity: "1",
        ativo: true,
        mealPreap: false,
        getTogheter: false,
        receitaFile: null,
        fichaTecnicaFile: null,
        foto1File: null,
        foto2File: null,
    });

    const [remote, setRemote] = useState<{ foto1Url: string | null; foto2Url: string | null; fichaTecnicaUrl: string | null; receitaUrl: string | null } | null>(null);
    const [removeFoto1, setRemoveFoto1] = useState(false);
    const [removeFoto2, setRemoveFoto2] = useState(false);
    const [removeFichaTecnica, setRemoveFichaTecnica] = useState(false);
    const [removeReceita, setRemoveReceita] = useState(false);

    const load = useCallback(async () => {
        const token = getTytAccessToken();
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const [dishRes, catsRes, cuisineRes, themesRes, mainRes, prefRes, ingredientsRes] = await Promise.all([
                getPratoById(dishId, token),
                pratosCategoriasApi.getAll(token),
                tiposCozinhaApi.getAll(token),
                temasApi.getAll(token),
                ingredientesPrincipaisApi.getAll(token),
                prefCulinariasApi.getAll(token),
                getIngredientes(token),
            ]);
            const [dishJson, catsJson, cuisineJson, themesJson, mainJson, prefJson, ingredientsJson] = await Promise.all([
                parseJsonOrThrow<unknown>(dishRes),
                parseJsonOrThrow<unknown>(catsRes),
                parseJsonOrThrow<unknown>(cuisineRes),
                parseJsonOrThrow<unknown>(themesRes),
                parseJsonOrThrow<unknown>(mainRes),
                parseJsonOrThrow<unknown>(prefRes),
                parseJsonOrThrow<unknown>(ingredientsRes),
            ]);

            const dishRecord = getRecord(dishJson) ?? getRecord(getRecord(dishJson)?.data) ?? null;

            const mapItems = (arr: unknown[]) =>
                arr
                    .map((x) => {
                        if (!x || typeof x !== "object") return null;
                        const r = x as Record<string, unknown>;
                        const id = typeof r.id === "number" ? r.id : Number(r.id);
                        const descricao = typeof r.descricao === "string" ? r.descricao : null;
                        if (!Number.isFinite(id) || !descricao) return null;
                        if (typeof r.ativo === "boolean" && r.ativo === false) return null;
                        return { id, descricao };
                    })
                    .filter(Boolean) as CatalogItem[];

            setDishCategories(mapItems(normalizeList(catsJson)));
            setCuisineTypes(mapItems(normalizeList(cuisineJson)));
            setThemes(mapItems(normalizeList(themesJson)));
            setMainIngredients(mapItems(normalizeList(mainJson)));
            setFoodPreferences(mapItems(normalizeList(prefJson)));
            setIngredients(mapItems(normalizeList(ingredientsJson)));

            if (dishRecord) {
                const name = getStringValue(dishRecord, ["nome_prato"]) ?? "";
                const descriptionText = getStringValue(dishRecord, ["descricao"]) ?? "";
                const quantity = getNumberValue(dishRecord, ["quantidade"]) ?? null;
                const ativo = coerceBool(dishRecord.ativo);
                const mealPreap = coerceBool(dishRecord.meal_preap);
                const getTogheter = coerceBool(dishRecord.get_togheter);

                const idsFromDishArray = (key: string) => {
                    const raw = dishRecord[key];
                    const arr = Array.isArray(raw) ? raw : [];
                    return arr
                        .map((x) => (x && typeof x === "object" ? getNumberValue(x as Record<string, unknown>, ["id"]) : null))
                        .filter((x): x is number => x !== null)
                        .map(String);
                };

                setCategorySelection(new Set(idsFromDishArray("pratos_categorias")));
                setFoodPreferenceSelection(new Set(idsFromDishArray("pratos_pref_culinarias")));
                setCuisineTypeSelection(new Set(idsFromDishArray("pratos_tipos_cozinha")));
                setMainIngredientSelection(new Set(idsFromDishArray("pratos_ingredientes_principais")));
                setThemeSelection(new Set(idsFromDishArray("pratos_temas")));
                setIngredientsSelection(new Set(idsFromDishArray("pratos_ingredientes")));

                setRemote({
                    foto1Url: cleanUrl(dishRecord.foto1),
                    foto2Url: cleanUrl(dishRecord.foto2),
                    fichaTecnicaUrl: cleanUrl(dishRecord.ficha_tecnica),
                    receitaUrl: cleanUrl(dishRecord.receita),
                });
                setRemoveFoto1(false);
                setRemoveFoto2(false);
                setRemoveFichaTecnica(false);
                setRemoveReceita(false);

                setForm((p) => ({
                    ...p,
                    name,
                    descriptionText,
                    quantity: quantity !== null ? String(quantity) : "1",
                    ativo,
                    mealPreap,
                    getTogheter,
                }));
            }
        } catch (err) {
            if (err instanceof TytApiError) setError(parseApiErrorMessage(err.body));
            else setError("Ocorreu um erro. Tente novamente.");
        } finally {
            setLoading(false);
        }
    }, [dishId]);

    useEffect(() => {
        void load();
    }, [load]);

    const categoryCsv = useMemo(() => {
        if (!(categorySelection instanceof Set)) return "";
        return Array.from(categorySelection).map(String).join(",");
    }, [categorySelection]);

    const foodPreferenceCsv = useMemo(() => Array.from(foodPreferenceSelection).join(","), [foodPreferenceSelection]);
    const cuisineTypeCsv = useMemo(() => Array.from(cuisineTypeSelection).join(","), [cuisineTypeSelection]);
    const mainIngredientCsv = useMemo(() => Array.from(mainIngredientSelection).join(","), [mainIngredientSelection]);
    const themeCsv = useMemo(() => Array.from(themeSelection).join(","), [themeSelection]);
    const ingredientsCsv = useMemo(() => Array.from(ingredientsSelection).join(","), [ingredientsSelection]);

    const dishCategoryItems = useMemo(() => dishCategories.map((x) => ({ id: String(x.id), label: x.descricao })), [dishCategories]);
    const prefItems = useMemo(() => foodPreferences.map((x) => ({ id: String(x.id), label: x.descricao })), [foodPreferences]);
    const cuisineItems = useMemo(() => cuisineTypes.map((x) => ({ id: String(x.id), label: x.descricao })), [cuisineTypes]);
    const mainIngredientItems = useMemo(() => mainIngredients.map((x) => ({ id: String(x.id), label: x.descricao })), [mainIngredients]);
    const themeItems = useMemo(() => themes.map((x) => ({ id: String(x.id), label: x.descricao })), [themes]);
    const ingredientItems = useMemo(() => ingredients.map((x) => ({ id: String(x.id), label: x.descricao })), [ingredients]);
    const prefSelectableItems = useMemo(() => prefItems.filter((x) => !foodPreferenceSelection.has(x.id)), [prefItems, foodPreferenceSelection]);
    const mainSelectableItems = useMemo(() => mainIngredientItems.filter((x) => !mainIngredientSelection.has(x.id)), [mainIngredientItems, mainIngredientSelection]);
    const cuisineSelectableItems = useMemo(() => cuisineItems.filter((x) => !cuisineTypeSelection.has(x.id)), [cuisineItems, cuisineTypeSelection]);
    const themeSelectableItems = useMemo(() => themeItems.filter((x) => !themeSelection.has(x.id)), [themeItems, themeSelection]);
    const ingredientSelectableItems = useMemo(() => ingredientItems.filter((x) => !ingredientsSelection.has(x.id)), [ingredientItems, ingredientsSelection]);

    const foto1Preview = form.foto1File ? URL.createObjectURL(form.foto1File) : remote?.foto1Url ?? null;
    const foto2Preview = form.foto2File ? URL.createObjectURL(form.foto2File) : remote?.foto2Url ?? null;

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Button color="link-gray" size="sm" href="/cardapio">
                            Cardápio
                        </Button>
                        <span>/</span>
                        <Button color="link-gray" size="sm" href={`/cardapio/pratos/${dishId}`}>
                            Pratos
                        </Button>
                        <span>/</span>
                        <span className="text-primary">Editar prato</span>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className={cx(playfair.className, "text-display-sm font-semibold text-primary md:text-display-md")}>Editar prato</h1>
                            <p className="mt-1 text-sm text-tertiary">Atualize as informações e a disponibilidade do prato.</p>
                        </div>
                        <Toggle
                            size="sm"
                            isSelected={form.ativo}
                            onChange={(v) => setForm((p) => ({ ...p, ativo: v }))}
                            label="Exibir no cardápio"
                            hint="Quando ativo, o prato ficará visível para os clientes"
                        />
                    </div>
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar os dados.</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void load()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." />
                    </div>
                ) : (
                    <>
                        <section className="grid gap-6 lg:grid-cols-2">
                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className="text-sm font-semibold text-primary">Informações do Prato</h2>
                                    <p className="mt-1 text-sm text-tertiary">Informações básicas para identificação e apresentação do prato</p>
                                </div>
                                <div className="flex flex-col gap-4 px-5 py-5">
                                    <Input
                                        label="Nome do prato"
                                        isRequired
                                        value={form.name}
                                        onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                                    />
                                    <TextArea
                                        label="Descrição"
                                        value={form.descriptionText}
                                        onChange={(v) => setForm((p) => ({ ...p, descriptionText: v }))}
                                        placeholder="Descreva o prato"
                                        rows={4}
                                    />
                                </div>
                            </article>

                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className="text-sm font-semibold text-primary">Fotos do prato</h2>
                                    <p className="mt-1 text-sm text-tertiary">Faça o upload de fotos reais e bem iluminadas do seu prato</p>
                                </div>
                                <div className="flex flex-col gap-4 px-5 py-5">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="flex flex-col gap-2">
                                            <FileUploadDropZone
                                                accept="image/*"
                                                hint="Foto 1: clique para carregar ou arraste e solte"
                                                onDropFiles={(files) => {
                                                    const f = files.item(0);
                                                    if (!f) return;
                                                    if (!isWithinUploadLimit(f, "Foto 1")) return;
                                                    setRemoveFoto1(false);
                                                    setForm((p) => ({ ...p, foto1File: f }));
                                                }}
                                            />
                                            {foto1Preview ? (
                                                <img src={foto1Preview} alt="Prévia foto 1" className="h-28 w-full rounded-lg object-cover" />
                                            ) : (
                                                <div className="flex h-28 items-center justify-center rounded-lg bg-secondary text-sm text-tertiary">Foto 1</div>
                                            )}
                                            {foto1Preview ? (
                                                <Button
                                                    color="link-destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRemoveFoto1(true);
                                                        setForm((p) => ({ ...p, foto1File: null }));
                                                        setRemote((p) => (p ? { ...p, foto1Url: null } : p));
                                                    }}
                                                >
                                                    Remover foto 1
                                                </Button>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <FileUploadDropZone
                                                accept="image/*"
                                                hint="Foto 2: clique para carregar ou arraste e solte"
                                                onDropFiles={(files) => {
                                                    const f = files.item(0);
                                                    if (!f) return;
                                                    if (!isWithinUploadLimit(f, "Foto 2")) return;
                                                    setRemoveFoto2(false);
                                                    setForm((p) => ({ ...p, foto2File: f }));
                                                }}
                                            />
                                            {foto2Preview ? (
                                                <img src={foto2Preview} alt="Prévia foto 2" className="h-28 w-full rounded-lg object-cover" />
                                            ) : (
                                                <div className="flex h-28 items-center justify-center rounded-lg bg-secondary text-sm text-tertiary">Foto 2</div>
                                            )}
                                            {foto2Preview ? (
                                                <Button
                                                    color="link-destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRemoveFoto2(true);
                                                        setForm((p) => ({ ...p, foto2File: null }));
                                                        setRemote((p) => (p ? { ...p, foto2Url: null } : p));
                                                    }}
                                                >
                                                    Remover foto 2
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        </section>

                        <section className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                            <div className="border-b border-secondary px-5 py-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold text-primary">Categorias</h2>
                                        <p className="mt-1 text-sm text-tertiary">Organize seu prato para facilitar a busca e recomendação para os clientes</p>
                                    </div>
                                    <Badge size="sm" type="pill-color" color="brand">
                                        *
                                    </Badge>
                                </div>
                            </div>
                            <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm font-medium text-secondary">Tipo de serviço *</p>
                                    <div className="flex flex-wrap gap-4">
                                        <Checkbox
                                            isSelected={form.mealPreap}
                                            onChange={(v) => setForm((p) => ({ ...p, mealPreap: v }))}
                                            label="Meal Prep"
                                        />
                                        <Checkbox
                                            isSelected={form.getTogheter}
                                            onChange={(v) => setForm((p) => ({ ...p, getTogheter: v }))}
                                            label="Get Together"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium text-secondary">Categoria *</p>
                                    <TagGroup
                                        label="Categorias"
                                        size="md"
                                        selectionMode="multiple"
                                        selectedKeys={categorySelection}
                                        onSelectionChange={setCategorySelection}
                                    >
                                        <TagList className="flex flex-wrap gap-2">
                                            {dishCategoryItems.map((c) => (
                                                <Tag key={c.id} id={c.id}>
                                                    {c.label}
                                                </Tag>
                                            ))}
                                        </TagList>
                                    </TagGroup>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Select.ComboBox
                                        aria-label="Preferência culinária"
                                        label="Preferência culinária"
                                        size="md"
                                        isRequired
                                        items={prefSelectableItems}
                                        inputValue={foodPreferenceQuery}
                                        onInputChange={setFoodPreferenceQuery}
                                        selectedKey={foodPreferenceKey}
                                        onOpenChange={setFoodPreferenceOpen}
                                        onSelectionChange={(key) => {
                                            const id = key ? String(key) : null;
                                            setFoodPreferenceKey(null);
                                            setFoodPreferenceQuery("");
                                            if (!id) return;
                                            setFoodPreferenceSelection((prev) => new Set(prev).add(id));
                                            setFoodPreferenceOpen(false);
                                        }}
                                        placeholder="Selecione"
                                    >
                                        {(item) => <Select.Item {...item} />}
                                    </Select.ComboBox>
                                    {foodPreferenceSelection.size ? (
                                        <TagGroup label="Preferências culinárias selecionadas" size="md">
                                            <TagList className="flex flex-wrap gap-2">
                                                {Array.from(foodPreferenceSelection).map((id) => (
                                                    <Tag
                                                        key={id}
                                                        id={id}
                                                        onClose={(tagId) =>
                                                            setFoodPreferenceSelection((prev) => {
                                                                const next = new Set(prev);
                                                                next.delete(tagId);
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        {foodPreferences.find((x) => String(x.id) === id)?.descricao ?? id}
                                                    </Tag>
                                                ))}
                                            </TagList>
                                        </TagGroup>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Select.ComboBox
                                        aria-label="Ingrediente principal"
                                        label="Ingrediente principal"
                                        size="md"
                                        isRequired
                                        items={mainSelectableItems}
                                        inputValue={mainIngredientQuery}
                                        onInputChange={setMainIngredientQuery}
                                        selectedKey={mainIngredientKey}
                                        onOpenChange={setMainIngredientOpen}
                                        onSelectionChange={(key) => {
                                            const id = key ? String(key) : null;
                                            setMainIngredientKey(null);
                                            setMainIngredientQuery("");
                                            if (!id) return;
                                            setMainIngredientSelection((prev) => new Set(prev).add(id));
                                            setMainIngredientOpen(false);
                                        }}
                                        placeholder="Selecione"
                                    >
                                        {(item) => <Select.Item {...item} />}
                                    </Select.ComboBox>
                                    {mainIngredientSelection.size ? (
                                        <TagGroup label="Ingredientes principais selecionados" size="md">
                                            <TagList className="flex flex-wrap gap-2">
                                                {Array.from(mainIngredientSelection).map((id) => (
                                                    <Tag
                                                        key={id}
                                                        id={id}
                                                        onClose={(tagId) =>
                                                            setMainIngredientSelection((prev) => {
                                                                const next = new Set(prev);
                                                                next.delete(tagId);
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        {mainIngredients.find((x) => String(x.id) === id)?.descricao ?? id}
                                                    </Tag>
                                                ))}
                                            </TagList>
                                        </TagGroup>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Select.ComboBox
                                        aria-label="Tipo de cozinha"
                                        label="Tipo de cozinha"
                                        size="md"
                                        isRequired
                                        items={cuisineSelectableItems}
                                        inputValue={cuisineTypeQuery}
                                        onInputChange={setCuisineTypeQuery}
                                        selectedKey={cuisineTypeKey}
                                        onOpenChange={setCuisineTypeOpen}
                                        onSelectionChange={(key) => {
                                            const id = key ? String(key) : null;
                                            setCuisineTypeKey(null);
                                            setCuisineTypeQuery("");
                                            if (!id) return;
                                            setCuisineTypeSelection((prev) => new Set(prev).add(id));
                                            setCuisineTypeOpen(false);
                                        }}
                                        placeholder="Selecione"
                                    >
                                        {(item) => <Select.Item {...item} />}
                                    </Select.ComboBox>
                                    {cuisineTypeSelection.size ? (
                                        <TagGroup label="Tipos de cozinha selecionados" size="md">
                                            <TagList className="flex flex-wrap gap-2">
                                                {Array.from(cuisineTypeSelection).map((id) => (
                                                    <Tag
                                                        key={id}
                                                        id={id}
                                                        onClose={(tagId) =>
                                                            setCuisineTypeSelection((prev) => {
                                                                const next = new Set(prev);
                                                                next.delete(tagId);
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        {cuisineTypes.find((x) => String(x.id) === id)?.descricao ?? id}
                                                    </Tag>
                                                ))}
                                            </TagList>
                                        </TagGroup>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Select.ComboBox
                                        aria-label="Tema"
                                        label="Tema"
                                        size="md"
                                        isRequired
                                        items={themeSelectableItems}
                                        inputValue={themeQuery}
                                        onInputChange={setThemeQuery}
                                        selectedKey={themeKey}
                                        onOpenChange={setThemeOpen}
                                        onSelectionChange={(key) => {
                                            const id = key ? String(key) : null;
                                            setThemeKey(null);
                                            setThemeQuery("");
                                            if (!id) return;
                                            setThemeSelection((prev) => new Set(prev).add(id));
                                            setThemeOpen(false);
                                        }}
                                        placeholder="Selecione"
                                    >
                                        {(item) => <Select.Item {...item} />}
                                    </Select.ComboBox>
                                    {themeSelection.size ? (
                                        <TagGroup label="Temas selecionados" size="md">
                                            <TagList className="flex flex-wrap gap-2">
                                                {Array.from(themeSelection).map((id) => (
                                                    <Tag
                                                        key={id}
                                                        id={id}
                                                        onClose={(tagId) =>
                                                            setThemeSelection((prev) => {
                                                                const next = new Set(prev);
                                                                next.delete(tagId);
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        {themes.find((x) => String(x.id) === id)?.descricao ?? id}
                                                    </Tag>
                                                ))}
                                            </TagList>
                                        </TagGroup>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2 lg:col-span-2">
                                    <Select.ComboBox
                                        aria-label="Ingredientes"
                                        label="Ingredientes"
                                        size="md"
                                        items={ingredientSelectableItems}
                                        inputValue={ingredientQuery}
                                        onInputChange={setIngredientQuery}
                                        selectedKey={ingredientKey}
                                        onOpenChange={setIngredientOpen}
                                        onSelectionChange={(key) => {
                                            const id = key ? String(key) : null;
                                            setIngredientKey(null);
                                            setIngredientQuery("");
                                            if (!id) return;
                                            setIngredientsSelection((prev) => new Set(prev).add(id));
                                            setIngredientOpen(false);
                                        }}
                                        placeholder="Selecione"
                                    >
                                        {(item) => <Select.Item {...item} />}
                                    </Select.ComboBox>
                                    {ingredientsSelection.size ? (
                                        <TagGroup label="Ingredientes selecionados" size="md">
                                            <TagList className="flex flex-wrap gap-2">
                                                {Array.from(ingredientsSelection).map((id) => (
                                                    <Tag
                                                        key={id}
                                                        id={id}
                                                        onClose={(tagId) =>
                                                            setIngredientsSelection((prev) => {
                                                                const next = new Set(prev);
                                                                next.delete(tagId);
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        {ingredients.find((x) => String(x.id) === id)?.descricao ?? id}
                                                    </Tag>
                                                ))}
                                            </TagList>
                                        </TagGroup>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        <section className="grid gap-6 lg:grid-cols-2">
                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="flex items-center justify-between gap-4 border-b border-secondary px-5 py-5">
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold text-primary">Ficha Técnica</h2>
                                        <p className="mt-1 text-sm text-tertiary">Adicione a ficha técnica com detalhes de preparo, porções e insumos</p>
                                    </div>
                                    <Button color="link-color" size="sm" iconLeading={Download02} isDisabled>
                                        Modelo tabela
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-2 px-5 py-5">
                                    <FileUploadDropZone
                                        accept=".pdf,.xls,.xlsx"
                                        hint="Clique para fazer upload ou arraste e solte"
                                        onDropFiles={(files) => {
                                            const f = files.item(0);
                                            if (!f) return;
                                            if (!isWithinUploadLimit(f, "Ficha técnica")) return;
                                            setRemoveFichaTecnica(false);
                                            setForm((p) => ({ ...p, fichaTecnicaFile: f }));
                                        }}
                                    />
                                    {form.fichaTecnicaFile ? (
                                        <p className="text-sm text-tertiary">{form.fichaTecnicaFile.name}</p>
                                    ) : remote?.fichaTecnicaUrl ? (
                                        <a href={remote.fichaTecnicaUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-solid">
                                            Abrir arquivo atual
                                        </a>
                                    ) : null}
                                    {form.fichaTecnicaFile || remote?.fichaTecnicaUrl ? (
                                        <Button
                                            color="link-destructive"
                                            size="sm"
                                            onClick={() => {
                                                setRemoveFichaTecnica(true);
                                                setForm((p) => ({ ...p, fichaTecnicaFile: null }));
                                                setRemote((p) => (p ? { ...p, fichaTecnicaUrl: null } : p));
                                            }}
                                        >
                                            Remover ficha técnica
                                        </Button>
                                    ) : null}
                                </div>
                            </article>

                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className="text-sm font-semibold text-primary">Receita</h2>
                                    <p className="mt-1 text-sm text-tertiary">Suba o arquivo com o passo a passo detalhado para o preparo.</p>
                                </div>
                                <div className="flex flex-col gap-2 px-5 py-5">
                                    <FileUploadDropZone
                                        accept=".pdf"
                                        hint="Clique para fazer upload ou arraste e solte"
                                        onDropFiles={(files) => {
                                            const f = files.item(0);
                                            if (!f) return;
                                            if (!isWithinUploadLimit(f, "Receita")) return;
                                            setRemoveReceita(false);
                                            setForm((p) => ({ ...p, receitaFile: f }));
                                        }}
                                    />
                                    {form.receitaFile ? (
                                        <p className="text-sm text-tertiary">{form.receitaFile.name}</p>
                                    ) : remote?.receitaUrl ? (
                                        <a href={remote.receitaUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-solid">
                                            Abrir arquivo atual
                                        </a>
                                    ) : null}
                                    {form.receitaFile || remote?.receitaUrl ? (
                                        <Button
                                            color="link-destructive"
                                            size="sm"
                                            onClick={() => {
                                                setRemoveReceita(true);
                                                setForm((p) => ({ ...p, receitaFile: null, descriptionText: "" }));
                                                setRemote((p) => (p ? { ...p, receitaUrl: null } : p));
                                            }}
                                        >
                                            Remover receita
                                        </Button>
                                    ) : null}
                                </div>
                            </article>
                        </section>

                        <footer className="flex flex-col-reverse items-center justify-between gap-3 border-t border-secondary pt-5 sm:flex-row">
                            <Button color="link-destructive" size="md" iconLeading={Trash01} onClick={() => setOpenDeleteConfirm(true)}>
                                Excluir prato
                            </Button>
                            <div className="flex w-full gap-3 sm:w-auto">
                                <Button color="secondary" size="md" className="flex-1 sm:flex-none" onClick={() => router.push(`/cardapio/pratos/${dishId}`)}>
                                    Cancelar
                                </Button>
                                <Button
                                    color="primary"
                                    size="md"
                                    className="flex-1 sm:flex-none"
                                    isLoading={loading}
                                    onClick={async () => {
                                        const token = getTytAccessToken();
                                        if (!token) return;
                                        if (!form.name.trim()) {
                                            toast.error("Preencha o nome do prato.");
                                            return;
                                        }
                                        if (!categoryCsv) {
                                            toast.error("Selecione ao menos uma categoria.");
                                            return;
                                        }
                                        if (!form.mealPreap && !form.getTogheter) {
                                            toast.error("Selecione o tipo de serviço.");
                                            return;
                                        }
                                        if (!foodPreferenceCsv || !cuisineTypeCsv || !mainIngredientCsv || !themeCsv) {
                                            toast.error("Preencha os campos obrigatórios.");
                                            return;
                                        }
                                        setLoading(true);
                                        try {
                                            const fields = {
                                                nome_prato: form.name.trim(),
                                                descricao: form.descriptionText.trim(),
                                                quantidade: form.quantity.trim() || "1",
                                                ativo: form.ativo,
                                                categorias: categoryCsv,
                                                tipos_cozinha: cuisineTypeCsv,
                                                temas: themeCsv,
                                                ingredientes_principais: mainIngredientCsv,
                                                pref_culinarias: foodPreferenceCsv,
                                                ingredientes: ingredientsCsv ? ingredientsCsv : null,
                                                foto1: removeFoto1 ? "" : form.foto1File,
                                                foto2: removeFoto2 ? "" : form.foto2File,
                                                ficha_tecnica: removeFichaTecnica ? "" : form.fichaTecnicaFile,
                                                meal_preap: form.mealPreap,
                                                get_togheter: form.getTogheter,
                                                receita: removeReceita ? "" : form.receitaFile,
                                            };

                                            const res = await putPratoFromFields(dishId, fields, token);
                                            await parseJsonOrThrow<unknown>(res);
                                            toast.success("Prato salvo com sucesso!");
                                            router.push(`/cardapio/pratos/${dishId}`);
                                        } catch (err) {
                                            if (err instanceof TytApiError)
                                                toast.error("Não foi possível salvar o prato.", { description: parseApiErrorMessage(err.body) });
                                            else toast.error("Não foi possível salvar o prato.");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                >
                                    {form.ativo ? "Publicar prato" : "Salvar prato"}
                                </Button>
                            </div>
                        </footer>
                    </>
                )}
            </div>

            <ModalOverlay isOpen={openDeleteConfirm} isDismissable onOpenChange={setOpenDeleteConfirm}>
                <Modal>
                    <Dialog>
                        <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                            <div className="flex items-start justify-between gap-4 border-b border-secondary px-6 py-5">
                                <div className="min-w-0">
                                    <p className="text-md font-semibold text-primary">Excluir prato {form.name.trim() ? `${form.name.trim()}?` : "?"}</p>
                                    <p className="mt-1 text-sm text-tertiary">
                                        Você tem certeza que deseja excluir este prato? Esta ação não poderá ser desfeita.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 px-6 py-5">
                                <Button color="secondary" size="md" className="flex-1" onClick={() => setOpenDeleteConfirm(false)} isDisabled={loading}>
                                    Cancelar
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    size="md"
                                    className="flex-1"
                                    isLoading={loading}
                                    onClick={async () => {
                                        const token = getTytAccessToken();
                                        if (!token) return;
                                        setLoading(true);
                                        try {
                                            const res = await deletePrato(dishId, token);
                                            await parseJsonOrThrow<unknown>(res);
                                            toast.success("Prato excluído com sucesso!");
                                            setOpenDeleteConfirm(false);
                                            router.push("/cardapio");
                                        } catch (err) {
                                            if (err instanceof TytApiError)
                                                toast.error("Não foi possível excluir o prato.", { description: parseApiErrorMessage(err.body) });
                                            else toast.error("Não foi possível excluir o prato.");
                                        } finally {
                                            setLoading(false);
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
