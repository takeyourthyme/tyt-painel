"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download02, Edit02, Plus } from "@untitledui/icons";
import * as Lucide from "lucide-react";
import { type Key } from "react-aria-components";
import { toast } from "sonner";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { parseApiErrorMessage, parseJsonOrThrow, TytApiError } from "@/lib/tyt-api/errors";
import { temasApi } from "@/lib/tyt-api/pratos-catalogo";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { cx } from "@/utils/cx";

type ClassificationDrawerView =
    | { type: "create"; kind: string }
    | { type: "details"; kind: string; id: number }
    | { type: "edit"; kind: string; id: number };

type CatalogItem = {
    id: number;
    title: string | null;
    descricao: string | null;
    icone?: string | null;
    updatedAt?: string | null;
};

type DishSelectorOption = {
    id: number;
    nome_prato: string;
    categoryIds: number[];
};

type TemaItem = {
    id: number;
    nome: string | null;
    descricao: string;
    foto: string | null;
    ativo: boolean;
    pratos_vinculados: Array<{
        id: number;
        id_prato: number;
        prato?: {
            id: number;
            nome_prato: string;
            descricao: string;
            pratos_categorias: Array<{ id_categoria: number }>;
        };
    }>;
    pratos_por_categoria: Record<string, Array<{
        id: number;
        nome_prato: string;
        descricao: string;
    }>>;
    updatedAt?: string | null;
};

interface TemasDrawerProps {
    view: ClassificationDrawerView;
    dishCategories: CatalogItem[];
    dishesOptions: DishSelectorOption[];
    onClose: () => void;
    onSave: () => Promise<void>;
    setView: (view: any) => void;
}

function formatDatePtBr(dateIso: string | null | undefined): string {
    if (!dateIso) return "—";
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
}

interface CategoryDishSelectorProps {
    category: CatalogItem;
    allDishes: DishSelectorOption[];
    selectedIds: number[];
    onChange: (selectedIds: number[]) => void;
}

const CategoryDishSelector = ({ category, allDishes, selectedIds, onChange }: CategoryDishSelectorProps) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    const categoryDishes = useMemo(() => {
        return allDishes.filter((d) => d.categoryIds.includes(category.id));
    }, [allDishes, category.id]);

    const selectableDishes = useMemo(() => {
        return categoryDishes.filter((d) => !selectedIds.includes(d.id));
    }, [categoryDishes, selectedIds]);

    const items = useMemo(() => {
        return selectableDishes.map((d) => ({
            id: String(d.id),
            label: d.nome_prato,
        }));
    }, [selectableDishes]);

    const handleSelectionChange = (key: Key | null) => {
        if (!key) return;
        const dishId = Number(key);
        if (!selectedIds.includes(dishId)) {
            onChange([...selectedIds, dishId]);
        }
        setQuery("");
        setOpen(false);
    };

    const handleRemove = (tagId: string) => {
        const dishId = Number(tagId);
        onChange(selectedIds.filter((id) => id !== dishId));
    };

    return (
        <div className="flex flex-col gap-2">
            <Select.ComboBox
                aria-label={category.descricao || "Categoria"}
                label={category.descricao || "Categoria"}
                size="md"
                shortcut={false}
                items={items}
                inputValue={query}
                onInputChange={setQuery}
                selectedKey={null}
                onOpenChange={setOpen}
                onSelectionChange={handleSelectionChange}
                placeholder="Selecione um prato"
            >
                {(item) => <Select.Item {...item} />}
            </Select.ComboBox>

            {selectedIds.length > 0 && (
                <TagGroup label="Pratos selecionados" size="md">
                    <TagList className="flex flex-wrap gap-2 mt-1">
                        {selectedIds.map((id) => {
                            const dish = categoryDishes.find((d) => d.id === id);
                            return (
                                <Tag key={id} id={String(id)} onClose={handleRemove}>
                                    {dish?.nome_prato || "Sem Nome"}
                                </Tag>
                            );
                        })}
                    </TagList>
                </TagGroup>
            )}
        </div>
    );
};

export function TemasDrawer({ view, dishCategories, dishesOptions, onClose, onSave, setView }: TemasDrawerProps) {
    const [themeDetails, setThemeDetails] = useState<TemaItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form fields
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");
    const [ativo, setAtivo] = useState(true);
    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const [fotoUrl, setFotoUrl] = useState<string | null>(null);
    const [selectedCategoryDishesMap, setSelectedCategoryDishesMap] = useState<Record<number, number[]>>({});

    const fetchDetails = useCallback(async () => {
        if (view.type === "create") {
            setThemeDetails(null);
            setNome("");
            setDescricao("");
            setAtivo(true);
            setFotoFile(null);
            setFotoUrl(null);
            setSelectedCategoryDishesMap({});
            return;
        }

        const token = getTytAccessToken();
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await temasApi.getById(view.id, token);
            const json = await parseJsonOrThrow<any>(res);
            const data = (json.data || json) as TemaItem;
            setThemeDetails(data);

            setNome(data.nome || "");
            setDescricao(data.descricao || "");
            setAtivo(data.ativo ?? true);
            setFotoUrl(data.foto || null);
            setFotoFile(null);

            const pratosVinculados = data.pratos_vinculados || [];
            const initialMap: Record<number, number[]> = {};
            for (const pv of pratosVinculados) {
                const dish = pv.prato;
                if (!dish) continue;
                const dishId = pv.id_prato || dish.id;
                const cats = dish.pratos_categorias || [];
                for (const pc of cats) {
                    const cid = pc.id_categoria;
                    if (!initialMap[cid]) {
                        initialMap[cid] = [];
                    }
                    if (!initialMap[cid].includes(dishId)) {
                        initialMap[cid].push(dishId);
                    }
                }
            }
            setSelectedCategoryDishesMap(initialMap);
        } catch (err) {
            console.error(err);
            if (err instanceof TytApiError) setError(parseApiErrorMessage(err.body));
            else setError("Erro ao carregar detalhes do tema");
        } finally {
            setLoading(false);
        }
    }, [view]);

    useEffect(() => {
        void fetchDetails();
    }, [fetchDetails]);

    const handleCategoryDishesChange = (categoryId: number, selectedIds: number[]) => {
        setSelectedCategoryDishesMap((prev) => ({
            ...prev,
            [categoryId]: selectedIds,
        }));
    };

    const handleSave = async () => {
        const token = getTytAccessToken();
        if (!token) return;

        if (!descricao.trim()) {
            toast.error("A descrição do tema é obrigatória");
            return;
        }

        setSaveLoading(true);
        try {
            const allSelectedIds = Array.from(new Set(Object.values(selectedCategoryDishesMap).flat()));
            const pratosJsonString = JSON.stringify(allSelectedIds);

            const fields = {
                nome: nome.trim() || undefined,
                descricao: descricao.trim(),
                ativo,
                foto: fotoFile ?? (fotoUrl ? undefined : null), // Send null to clear if cleared, or undefined to keep existing
                pratos: pratosJsonString,
            };

            if (view.type === "edit") {
                await temasApi.update(view.id, fields, token);
                toast.success("Tema atualizado com sucesso!");
            } else {
                await temasApi.create(fields, token);
                toast.success("Tema criado com sucesso!");
            }

            onClose();
            await onSave();
        } catch (err) {
            console.error(err);
            if (err instanceof TytApiError) {
                toast.error("Não foi possível salvar o tema", { description: parseApiErrorMessage(err.body) });
            } else {
                toast.error("Não foi possível salvar o tema");
            }
        } finally {
            setSaveLoading(false);
        }
    };

    const fotoPreview = useMemo(() => {
        if (fotoFile) return URL.createObjectURL(fotoFile);
        return fotoUrl;
    }, [fotoFile, fotoUrl]);

    const handleRemoveFoto = () => {
        setFotoFile(null);
        setFotoUrl(null);
    };

    return (
        <SlideoutMenu isOpen={true} isDismissable onOpenChange={(open) => (!open ? onClose() : undefined)}>
            {({ close }) => {
                const closeAll = () => {
                    close();
                    onClose();
                };

                const title =
                    view.type === "create"
                        ? "Novo tema"
                        : view.type === "details"
                        ? "Detalhes do tema"
                        : "Editar tema";

                const description =
                    view.type === "details"
                        ? "Informações completas do seu tema"
                        : view.type === "edit"
                        ? "Atualize as informações e o cardápio do tema"
                        : "Insira as informações e o cardápio do tema";

                return (
                    <>
                        <SlideoutMenu.Header onClose={closeAll}>
                            <div className="flex flex-col gap-1">
                                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                                <p className="text-sm text-tertiary">{description}</p>
                            </div>
                        </SlideoutMenu.Header>

                        <SlideoutMenu.Content>
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." />
                                </div>
                            ) : error ? (
                                <div className="p-4 text-center">
                                    <p className="text-sm text-error">{error}</p>
                                    <Button className="mt-4" color="secondary" onClick={() => void fetchDetails()}>
                                        Tentar novamente
                                    </Button>
                                </div>
                            ) : view.type === "details" && themeDetails ? (
                                <div className="flex flex-col gap-4">
                                    <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                        {themeDetails.foto && (
                                            <img
                                                src={themeDetails.foto}
                                                alt={themeDetails.nome || "Capa do tema"}
                                                className="mb-4 h-44 w-full rounded-lg object-cover"
                                            />
                                        )}

                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <span className="text-xs font-semibold text-tertiary uppercase tracking-wider">
                                                    Nome
                                                </span>
                                                <p className="text-sm font-medium text-primary mt-1">
                                                    {themeDetails.nome || "—"}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="text-xs font-semibold text-tertiary uppercase tracking-wider">
                                                    Descrição
                                                </span>
                                                <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">
                                                    {themeDetails.descricao || "—"}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="text-xs font-semibold text-tertiary uppercase tracking-wider">
                                                    Status
                                                </span>
                                                <div className="mt-1">
                                                    {themeDetails.ativo ? (
                                                        <Badge size="sm" type="pill-color" color="success">
                                                            <span className="flex items-center gap-1">
                                                                <Check className="size-3.5" />
                                                                Disponível no cardápio
                                                            </span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge size="sm" type="pill-color" color="warning">
                                                            <span className="flex items-center gap-1">
                                                                <Lucide.X className="size-3.5" />
                                                                Indisponível no cardápio
                                                            </span>
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            {themeDetails.pratos_por_categoria &&
                                                Object.keys(themeDetails.pratos_por_categoria).length > 0 && (
                                                    <>
                                                        <div className="border-t border-secondary my-2" />
                                                        {Object.entries(themeDetails.pratos_por_categoria).map(
                                                            ([catName, catDishes]) => {
                                                                if (!Array.isArray(catDishes) || catDishes.length === 0)
                                                                    return null;
                                                                return (
                                                                    <div key={catName} className="flex flex-col gap-2">
                                                                        <span className="text-xs font-semibold text-tertiary uppercase tracking-wider">
                                                                            {catName}
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {catDishes.map((d) => (
                                                                                <Badge
                                                                                    key={d.id}
                                                                                    size="sm"
                                                                                    type="pill-color"
                                                                                    color="brand"
                                                                                >
                                                                                    {d.nome_prato}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        )}
                                                    </>
                                                )}

                                            <div className="mt-2 text-xs text-tertiary">
                                                Atualizado em {formatDatePtBr(themeDetails.updatedAt)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                        <h3 className="text-sm font-semibold text-primary">Detalhes do tema</h3>

                                        <Input
                                            label="Nome"
                                            isRequired
                                            value={nome}
                                            onChange={setNome}
                                            placeholder="Ex: Noite Italiana"
                                        />

                                        <TextArea
                                            label="Descrição"
                                            isRequired
                                            value={descricao}
                                            onChange={setDescricao}
                                            placeholder="Descreva a proposta do tema"
                                            rows={4}
                                        />

                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-sm font-medium text-secondary">Capa *</span>
                                            <span className="text-xs text-tertiary">Só é possível adicionar uma foto</span>
                                            <div className="mt-2">
                                                {fotoPreview ? (
                                                    <div className="relative group">
                                                        <img
                                                            src={fotoPreview}
                                                            alt="Capa do tema"
                                                            className="h-44 w-full rounded-lg object-cover"
                                                        />
                                                        <div className="mt-2">
                                                            <Button
                                                                color="link-destructive"
                                                                size="sm"
                                                                onClick={handleRemoveFoto}
                                                            >
                                                                Remover foto
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <FileUploadDropZone
                                                        accept="image/*"
                                                        allowsMultiple={false}
                                                        hint="Clique para enviar ou arraste e solte. SVG, PNG, JPG ou GIF (máx. 800x400px)"
                                                        onDropFiles={(files) => {
                                                            const f = files.item(0);
                                                            if (f) setFotoFile(f as File);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <Toggle
                                            size="sm"
                                            isSelected={ativo}
                                            onChange={setAtivo}
                                            label="Exibir no cardápio"
                                            hint="Quando ativo, o prato ficará visível para os clientes"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                        <h3 className="text-sm font-semibold text-primary">Cardápio</h3>

                                        {dishCategories.map((cat) => (
                                            <CategoryDishSelector
                                                key={cat.id}
                                                category={cat}
                                                allDishes={dishesOptions}
                                                selectedIds={selectedCategoryDishesMap[cat.id] || []}
                                                onChange={(selectedIds) =>
                                                    handleCategoryDishesChange(cat.id, selectedIds)
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </SlideoutMenu.Content>

                        <SlideoutMenu.Footer>
                            <div className="flex w-full items-center justify-between gap-4">
                                {view.type === "details" && themeDetails ? (
                                    <>
                                        <div />
                                        <Button
                                            color="secondary"
                                            size="md"
                                            iconLeading={Edit02}
                                            onClick={() => setView({ type: "edit", kind: "themes", id: view.id })}
                                        >
                                            Editar
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button color="secondary" size="md" onClick={closeAll} isDisabled={saveLoading}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            color="primary"
                                            size="md"
                                            iconLeading={Lucide.Save}
                                            onClick={() => void handleSave()}
                                            isLoading={saveLoading}
                                        >
                                            Salvar
                                        </Button>
                                    </>
                                )}
                            </div>
                        </SlideoutMenu.Footer>
                    </>
                );
            }}
        </SlideoutMenu>
    );
}
