"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Edit02 } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import { useRouter } from "next/navigation";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import type { BadgeColors } from "@/components/base/badges/badge-types";
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

function formatDatePtBr(v: string | null): string {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

const badgeColors: BadgeColors[] = ["brand", "purple", "warning", "success", "error", "gray"];
function badgeColorByIndex(i: number): BadgeColors {
    return badgeColors[i % badgeColors.length] ?? "gray";
}

type DishView = {
    id: string;
    descricao: string;
    ativo: boolean;
    meal_preap: boolean;
    get_togheter: boolean;
    foto1Url: string | null;
    foto2Url: string | null;
    fichaTecnicaUrl: string | null;
    receitaUrl: string | null;
    updatedAt: string | null;
    categorias: Array<{ id: number; descricao: string }>;
    tiposCozinha: Array<{ id: number; descricao: string }>;
    temas: Array<{ id: number; descricao: string }>;
    ingredientesPrincipais: Array<{ id: number; descricao: string }>;
    prefCulinarias: Array<{ id: number; descricao: string }>;
};

function parseCatalogArray(record: Record<string, unknown>, key: string) {
    const raw = record[key];
    const arr = Array.isArray(raw) ? raw : [];
    return arr
        .map((x) => {
            if (!x || typeof x !== "object") return null;
            const r = x as Record<string, unknown>;
            const id = getNumberValue(r, ["id"]);
            const descricao = getStringValue(r, ["descricao"]) ?? null;
            if (id === null || !descricao) return null;
            return { id, descricao };
        })
        .filter(Boolean) as Array<{ id: number; descricao: string }>;
}

export default function DishDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: dishId } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [details, setDetails] = useState<Record<string, unknown> | null>(null);

    const load = useCallback(async () => {
        const token = getTytAccessToken();
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getPratoById(dishId, token);
            const json = await parseJsonOrThrow<unknown>(res);
            const record = getRecord(json) ?? getRecord(getRecord(json)?.data) ?? null;
            setDetails(record);
        } catch (err) {
            if (err instanceof TytApiError) setError(parseApiErrorMessage(err.body));
            else if (err instanceof Error && err.message) setError(err.message);
            else setError("Ocorreu um erro. Tente novamente.");
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
        const descricao = getStringValue(details, ["descricao"]) ?? "—";
        const ativo = coerceBool(details.ativo);
        const meal_preap = coerceBool(details.meal_preap);
        const get_togheter = coerceBool(details.get_togheter);
        const foto1Url = cleanUrl(details.foto1);
        const foto2Url = cleanUrl(details.foto2);
        const fichaTecnicaUrl = cleanUrl(details.ficha_tecnica);
        const receitaUrl = cleanUrl(details.receita);
        const updatedAt = getStringValue(details, ["updatedAt", "updated_at", "updated"]) ?? getStringValue(details, ["createdAt", "created_at"]) ?? null;

        return {
            id,
            descricao,
            ativo,
            meal_preap,
            get_togheter,
            foto1Url,
            foto2Url,
            fichaTecnicaUrl,
            receitaUrl,
            updatedAt,
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
                <header className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Button color="link-gray" size="sm" onClick={() => router.push("/cardapio")}>
                            Cardápio
                        </Button>
                        <span>/</span>
                        <Button color="link-gray" size="sm" onClick={() => router.push("/cardapio")}>
                            Pratos
                        </Button>
                        <span>/</span>
                        <span className="text-primary">Detalhes do prato</span>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className={cx(playfair.className, "text-display-sm font-semibold text-primary md:text-display-md")}>
                                {dish?.descricao ?? "Detalhes do prato"}
                            </h1>
                            <p className="mt-1 text-sm text-tertiary">Confira como as informações do seu prato aparecem no sistema.</p>
                        </div>
                        <Button color="primary" size="md" iconLeading={Edit02} href={`/cardapio/pratos/${dishId}/edit`}>
                            Editar
                        </Button>
                    </div>
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar os detalhes do prato.</p>
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
                ) : dish ? (
                    <div className="flex flex-col gap-6">
                        <section className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                            <div className="border-b border-secondary px-5 py-5">
                                <h2 className="text-sm font-semibold text-primary">Informações do Prato</h2>
                            </div>
                            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                                <div>
                                    <p className="text-sm font-semibold text-primary">Nome do prato</p>
                                    <p className="mt-1 text-sm text-tertiary">{dish.descricao}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary">Status</p>
                                    <div className="mt-2">
                                        <Badge size="sm" type="pill-color" color={dish.ativo ? "success" : "gray"}>
                                            {dish.ativo ? "Disponível no cardápio" : "Oculto do cardápio"}
                                        </Badge>
                                    </div>
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
                                            dish.ingredientesPrincipais.map((c) => (
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
                            </div>
                        </section>

                        <section className="grid gap-4 lg:grid-cols-2">
                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className="text-sm font-semibold text-primary">Ficha Técnica</h2>
                                </div>
                                <div className="px-5 py-5">
                                    {dish.fichaTecnicaUrl ? (
                                        <a href={dish.fichaTecnicaUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-solid">
                                            Abrir arquivo
                                        </a>
                                    ) : (
                                        <p className="text-sm text-tertiary">—</p>
                                    )}
                                </div>
                            </article>
                            <article className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
                                <div className="border-b border-secondary px-5 py-5">
                                    <h2 className="text-sm font-semibold text-primary">Receita</h2>
                                </div>
                                <div className="px-5 py-5">
                                    {dish.receitaUrl ? (
                                        <a href={dish.receitaUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-solid">
                                            Abrir arquivo
                                        </a>
                                    ) : (
                                        <p className="text-sm text-tertiary">—</p>
                                    )}
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
        </main>
    );
}
