"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edit02, Download02, InfoCircle } from "@untitledui/icons";
import { FileIcon as FileTypeIcon } from "@untitledui/file-icons";
import { Playfair_Display } from "next/font/google";
import { useRouter } from "next/navigation";
import { ICON_CATALOG } from "@/app/(dashboard)/cardapio/icon-catalog";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { parseJsonOrThrow, TytApiError, parseApiErrorMessage } from "@/lib/tyt-api/errors";
import { getPratoById } from "@/lib/tyt-api/pratos";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { cx } from "@/utils/cx";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

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
    if (v === "1" || v === 1) return true;
    return false;
}

function cleanUrl(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const trimmed = v.trim().replace(/`/g, "").trim().replace(/^"|"$/g, "");
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return trimmed;
}

function formatDatePtBr(v: string | null): string {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function formatCurrency(value: number | null): string {
    if (value === null) return "—";
    try {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch {
        return "—";
    }
}

const badgeColors: BadgeColors[] = ["brand", "purple", "warning", "success", "error", "gray"];
function badgeColorByIndex(i: number): BadgeColors {
    return badgeColors[i % badgeColors.length] ?? "gray";
}

type CatalogItem = {
    id: number;
    descricao: string;
    icone?: string | null;
};

type TechnicalSheetRow = {
    descricao: string;
    quantidade: number | null;
    unidade: string;
    valor: number | null;
    custo_calculado: number | null;
};

type DishView = {
    id: string;
    title: string | null;
    description: string | null;
    ativo: boolean;
    meal_preap: boolean;
    get_togheter: boolean;
    destaque_site: boolean;
    foto1Url: string | null;
    foto2Url: string | null;
    fichaTecnicaUrl: string | null;
    receitaUrl: string | null;
    updatedAt: string | null;
    servings: number;
    totalCost: number | null;
    technicalSheet: TechnicalSheetRow[];
    categorias: Array<{ id: number; descricao: string }>;
    tiposCozinha: Array<{ id: number; descricao: string }>;
    temas: Array<{ id: number; descricao: string }>;
    ingredientesPrincipais: CatalogItem[];
    prefCulinarias: Array<{ id: number; descricao: string }>;
};

function parseCatalogArray(record: Record<string, unknown>, key: string): CatalogItem[] {
    const raw = record[key];
    const arr = Array.isArray(raw) ? raw : [];
    return arr
        .map((x) => {
            if (!x || typeof x !== "object") return null;
            const r = x as Record<string, unknown>;
            const id = getNumberValue(r, ["id"]);
            const descricao = getStringValue(r, ["nome", "descricao"]) ?? null;
            const icone = getStringValue(r, ["icone"]) ?? null;
            if (id === null || !descricao) return null;
            return { id, descricao, icone };
        })
        .filter(Boolean) as CatalogItem[];
}

export default function DishDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: dishId } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [details, setDetails] = useState<Record<string, unknown> | null>(null);
    const [costDrawerOpen, setCostDrawerOpen] = useState(false);
    const fetchedRef = useRef<string | null>(null);

    const load = useCallback(async (force = false) => {
        const token = getTytAccessToken();
        if (!token || !dishId) return;
        if (fetchedRef.current === dishId && !force) return;
        fetchedRef.current = dishId;

        setLoading(true);
        setError(null);
        try {
            const res = await getPratoById(dishId, token);
            const json = await parseJsonOrThrow<unknown>(res);
            const record = getRecord(json) ?? getRecord(getRecord(json)?.data) ?? null;
            setDetails(record);
        } catch (err) {
            fetchedRef.current = null;
            if (err instanceof TytApiError) setError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setError(err.message);
            else setError("Ocorreu um erro. Tente novamente");
        } finally {
            setLoading(false);
        }
    }, [dishId]);

    useEffect(() => {
        void load();
    }, [load]);

    const dish = useMemo<DishView | null>(() => {
        if (!details) return null;
        const id = getStringValue(details, ["id"]) ?? dishId;
        const title = getStringValue(details, ["nome_prato"]) ?? null;
        const description = getStringValue(details, ["descricao"]) ?? null;
        const ativo = coerceBool(details.ativo);
        const meal_preap = coerceBool(details.meal_preap);
        const get_togheter = coerceBool(details.get_togheter);
        const destaque_site = coerceBool(details.destaque_site);
        const foto1Url = cleanUrl(details.foto1);
        const foto2Url = cleanUrl(details.foto2);
        const fichaTecnicaUrl = cleanUrl(details.ficha_tecnica);
        const receitaUrl = cleanUrl(details.receita);
        const updatedAt = getStringValue(details, ["updatedAt", "updated_at", "updated"]) ?? getStringValue(details, ["createdAt", "created_at"]) ?? null;

        return {
            id,
            title,
            description,
            ativo,
            meal_preap,
            get_togheter,
            destaque_site,
            foto1Url,
            foto2Url,
            fichaTecnicaUrl,
            receitaUrl,
            updatedAt,
            servings: getNumberValue(details, ["servings"]) ?? 2,
            totalCost: getNumberValue(details, ["total_cost"]) ?? null,
            technicalSheet: (() => {
                const raw = details.technical_sheet;
                if (!Array.isArray(raw)) return [];
                return raw.map((item) => {
                    const r = item as Record<string, unknown>;
                    return {
                        descricao: (r.descricao as string) ?? "",
                        quantidade: typeof r.quantidade === "number" ? r.quantidade : null,
                        unidade: (r.unidade as string) ?? "",
                        valor: typeof r.valor === "number" ? r.valor : null,
                        custo_calculado: typeof r.custo_calculado === "number" ? r.custo_calculado : null,
                    };
                });
            })(),
            categorias: parseCatalogArray(details, "pratos_categorias"),
            tiposCozinha: parseCatalogArray(details, "pratos_tipos_cozinha"),
            temas: parseCatalogArray(details, "pratos_temas"),
            ingredientesPrincipais: parseCatalogArray(details, "pratos_ingredientes_principais"),
            prefCulinarias: parseCatalogArray(details, "pratos_pref_culinarias"),
        };
    }, [details, dishId]);

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Button color="link-gray" size="sm" onClick={() => router.push("/cardapio")}>
                            Cardápio
                        </Button>
                        <span className="text-quaternary">›</span>
                        <Button color="link-gray" size="sm" onClick={() => router.push("/cardapio")}>
                            Pratos
                        </Button>
                        <span className="text-quaternary">›</span>
                        <span className="text-primary">Detalhes do prato</span>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>
                                {dish?.title ?? "Detalhes do prato"}
                            </h1>
                            <p className="mt-1 text-sm text-tertiary">Confira como as informações do seu prato aparecem no sistema</p>
                        </div>
                        <Button color="primary" size="md" iconLeading={Edit02} href={`/cardapio/pratos/${dishId}/edit`}>
                            Editar
                        </Button>
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar os detalhes do prato</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void load(true)} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." />
                    </div>
                ) : dish ? (
                    <div className="flex flex-col gap-6">
                        <section className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                            <div className="border-b border-secondary px-5 py-5">
                                <h2 className="text-sm font-semibold text-primary">Informações do Prato</h2>
                            </div>
                            <div className="grid gap-4 px-5 py-5 sm:grid-cols-4">
                                <div>
                                    <p className="text-sm font-semibold text-primary">Nome do prato</p>
                                    <p className="mt-1 text-sm text-tertiary">{dish.title || ""}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Porções</p>
                                    <p className="mt-1 text-sm text-tertiary">
                                        {dish.servings} {dish.servings === 1 ? "porção" : "porções"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Custo do prato</p>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <p className="text-sm text-tertiary">
                                            {formatCurrency(dish.totalCost)}
                                        </p>
                                        {dish.technicalSheet.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setCostDrawerOpen(true)}
                                                className="inline-flex items-center justify-center rounded-full text-quaternary transition-colors hover:text-brand-secondary hover:cursor-pointer"
                                                title="Ver detalhamento de custos"
                                            >
                                                <InfoCircle className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Status</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Badge size="sm" type="pill-color" color={dish.ativo ? "success" : "gray"}>
                                            {dish.ativo ? "Disponível no cardápio" : "Oculto do cardápio"}
                                        </Badge>
                                        <Badge size="sm" type="pill-color" color={dish.destaque_site ? "brand" : "gray"}>
                                            {dish.destaque_site ? "Destaque no site" : "Sem destaque"}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="col-span-full border-t border-secondary pt-4 mt-2">
                                    <p className="text-sm font-semibold text-primary">Descrição</p>
                                    <p className="mt-1 text-sm text-tertiary whitespace-pre-wrap">{dish.description || "—"}</p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                            <div className="border-b border-secondary px-5 py-5">
                                <h2 className="text-sm font-semibold text-primary">Categorias</h2>
                            </div>
                            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                                <div>
                                    <p className="text-sm font-semibold text-primary">Tipo de serviço</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {dish.meal_preap ? (
                                            <Badge size="sm" type="pill-color" color="gray">
                                                Meal Prep
                                            </Badge>
                                        ) : null}
                                        {dish.get_togheter ? (
                                            <Badge size="sm" type="pill-color" color="gray">
                                                Get Together
                                            </Badge>
                                        ) : null}
                                        {!dish.meal_preap && !dish.get_togheter ? <p className="text-sm text-tertiary">—</p> : null}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-primary">Categoria</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {dish.categorias.length ? (
                                            dish.categorias.map((c, idx) => (
                                                <Badge key={c.id} size="sm" type="pill-color" color={badgeColorByIndex(idx)}>
                                                    {c.descricao}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-sm text-tertiary">—</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-primary">Preferência culinária</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {dish.prefCulinarias.length ? (
                                            dish.prefCulinarias.map((c) => (
                                                <Badge key={c.id} size="sm" type="pill-color" color="gray">
                                                    {c.descricao}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-sm text-tertiary">—</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-primary">Tipo de Cozinha</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {dish.tiposCozinha.length ? (
                                            dish.tiposCozinha.map((c) => (
                                                <Badge key={c.id} size="sm" type="pill-color" color="gray">
                                                    {c.descricao}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-sm text-tertiary">—</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-primary">Ingrediente principal</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {dish.ingredientesPrincipais.length ? (
                                            dish.ingredientesPrincipais.map((c) => {
                                                const iconObj = c.icone ? ICON_CATALOG.find((x) => x.id === c.icone) : null;
                                                return (
                                                    <Badge key={c.id} size="sm" type="pill-color" color="gray">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {iconObj ? <iconObj.Icon className="size-3.5" /> : null}
                                                            {c.descricao}
                                                        </span>
                                                    </Badge>
                                                );
                                            })
                                        ) : (
                                            <p className="text-sm text-tertiary">—</p>
                                        )}
                                    </div>
                                </div>

                                {!dish.meal_preap ? (
                                    <div>
                                        <p className="text-sm font-semibold text-primary">Tema</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {dish.temas.length ? (
                                                dish.temas.map((c) => (
                                                    <Badge key={c.id} size="sm" type="pill-color" color="gray">
                                                        {c.descricao}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <p className="text-sm text-tertiary">—</p>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </section>

                        <section className="grid gap-4 lg:grid-cols-2">
                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5 flex items-center gap-2">
                                    <h2 className="text-sm font-semibold text-primary">Ficha Técnica</h2>
                                    {dish.technicalSheet.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setCostDrawerOpen(true)}
                                            className="inline-flex items-center justify-center rounded-full text-quaternary transition-colors hover:text-brand-secondary hover:cursor-pointer"
                                            title="Ver detalhamento de custos"
                                        >
                                            <InfoCircle className="size-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="px-5 py-5">
                                    <div className="flex items-center justify-between gap-4 rounded-xl border border-secondary bg-primary p-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cx(
                                                "flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary_alt",
                                                dish.fichaTecnicaUrl ? "text-tertiary" : "text-quaternary"
                                            )}>
                                                <FileTypeIcon type={dish.fichaTecnicaUrl ? "xlsx" : "empty"} theme="light" variant="default" className="size-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={cx("truncate text-sm font-semibold", dish.fichaTecnicaUrl ? "text-primary" : "text-disabled")}>
                                                    Ficha Técnica
                                                </p>
                                                <p className="truncate text-xs text-tertiary">
                                                    {dish.fichaTecnicaUrl ? "Clique para baixar o documento" : "Nenhum arquivo cadastrado"}
                                                </p>
                                            </div>
                                        </div>
                                        {dish.fichaTecnicaUrl && (
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                iconLeading={Download02}
                                                href={dish.fichaTecnicaUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Download
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </article>
                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className="text-sm font-semibold text-primary">Receita</h2>
                                </div>
                                <div className="px-5 py-5">
                                    <div className="flex items-center justify-between gap-4 rounded-xl border border-secondary bg-primary p-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cx(
                                                "flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary_alt",
                                                dish.receitaUrl ? "text-tertiary" : "text-quaternary"
                                            )}>
                                                <FileTypeIcon type={dish.receitaUrl ? "pdf" : "empty"} theme="light" variant="default" className="size-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={cx("truncate text-sm font-semibold", dish.receitaUrl ? "text-primary" : "text-disabled")}>
                                                    Receita
                                                </p>
                                                <p className="truncate text-xs text-tertiary">
                                                    {dish.receitaUrl ? "Clique para baixar o documento" : "Nenhum arquivo cadastrado"}
                                                </p>
                                            </div>
                                        </div>
                                        {dish.receitaUrl && (
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                iconLeading={Download02}
                                                href={dish.receitaUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Download
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        </section>

                        <section className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                            <div className="border-b border-secondary px-5 py-5">
                                <h2 className="text-sm font-semibold text-primary">Galeria de fotos</h2>
                            </div>
                            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                                {dish.foto1Url ? (
                                    <img src={dish.foto1Url} alt="Foto do prato" className="h-56 w-full rounded-lg object-cover" />
                                ) : (
                                    <div className="flex h-56 items-center justify-center rounded-lg bg-secondary text-sm text-tertiary">Sem foto</div>
                                )}
                                {dish.foto2Url ? (
                                    <img src={dish.foto2Url} alt="Foto do prato" className="h-56 w-full rounded-lg object-cover" />
                                ) : (
                                    <div className="flex h-56 items-center justify-center rounded-lg bg-secondary text-sm text-tertiary">Sem foto</div>
                                )}
                                <p className="col-span-full text-xs text-tertiary">Atualizado em {formatDatePtBr(dish.updatedAt)}</p>
                            </div>
                        </section>
                    </div>
                ) : null}
            </div>

            {/* Cost breakdown drawer */}
            <SlideoutMenu isOpen={costDrawerOpen} isDismissable onOpenChange={(open) => (!open ? setCostDrawerOpen(false) : undefined)}>
                {({ close }) => (
                    <>
                        <SlideoutMenu.Header onClose={() => { close(); setCostDrawerOpen(false); }}>
                            <div className="flex flex-col gap-1 pr-10">
                                <p className="text-md font-semibold text-primary">Detalhamento de custos</p>
                                <p className="text-sm text-tertiary">Ingredientes e valores da ficha técnica</p>
                            </div>
                        </SlideoutMenu.Header>

                        <SlideoutMenu.Content>
                            <div className="flex flex-col gap-4">
                                <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-primary">Custo total</p>
                                        <p className="text-lg font-semibold text-brand-secondary">{formatCurrency(dish?.totalCost ?? null)}</p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-secondary bg-primary shadow-xs">
                                    <div className="border-b border-secondary px-4 py-3">
                                        <p className="text-sm font-semibold text-primary">Ingredientes ({dish?.technicalSheet.length ?? 0})</p>
                                    </div>
                                    <div className="divide-y divide-secondary">
                                        {dish?.technicalSheet.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-primary">{item.descricao}</p>
                                                    <p className="mt-0.5 text-xs text-tertiary">
                                                        {item.quantidade ?? "—"} {item.unidade}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm font-medium text-primary">{formatCurrency(item.custo_calculado)}</p>
                                                    <p className="mt-0.5 text-xs text-tertiary">val. unit. {formatCurrency(item.valor)}</p>
                                                </div>
                                            </div>
                                        )) ?? null}
                                        {(!dish?.technicalSheet.length) && (
                                            <div className="px-4 py-6 text-center text-sm text-tertiary">Nenhum ingrediente cadastrado na ficha técnica</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </SlideoutMenu.Content>
                    </>
                )}
            </SlideoutMenu>
        </main>
    );
}
