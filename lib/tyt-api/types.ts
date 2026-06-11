/**
 * Parâmetros das rotas espelhados em `TYT_Api.postman_collection.json`.
 * Inclui path params, query params e bodies JSON/form-data.
 */

// ---------------------------------------------------------------------------
// Comum
// ---------------------------------------------------------------------------

export type ResourceId = number | string;

/** Filtro `status` em ingredientes e pratos (collection Postman). */
export type AtivoInativoStatus = "active" | "inactive";

/** Filtro `status` em chefs e clientes (collection Postman). */
export type UserListStatus = "entrevista" | "active" | "pending" | (string & {});

export type TipoUsuario = "admin" | "chef" | "cliente";

// ---------------------------------------------------------------------------
// Path params
// ---------------------------------------------------------------------------

export type UserIdParams = { id: ResourceId };
export type IngredienteIdParams = { id: ResourceId };
export type IngredienteCategoriaIdParams = { id: ResourceId };
export type PratoIdParams = { id: ResourceId };
export type PratoCategoriaIdParams = { id: ResourceId };
export type TipoCozinhaIdParams = { id: ResourceId };
export type TemaIdParams = { id: ResourceId };
export type IngredientePrincipalIdParams = { id: ResourceId };
export type PrefCulinariaIdParams = { id: ResourceId };
export type KitchenOrderIdParams = { id: ResourceId };
export type KitchenOrderCodeParams = { code: string };

// ---------------------------------------------------------------------------
// Auth — POST /api/auth/*
// ---------------------------------------------------------------------------

export type LoginBody = {
    email: string;
    senha: string;
};

export type ForgotPasswordBody = {
    email: string;
};

export type ResetPasswordBody = {
    token: string;
    novaSenha: string;
};

export type ChangePasswordBody = {
    email: string;
    senha: string;
    novaSenha: string;
};

// ---------------------------------------------------------------------------
// Users — POST/PUT /api/users, GET /api/users/:id
// ---------------------------------------------------------------------------

/** Campos base compartilhados nos formulários de usuário (form-data). */
export type UserFormBaseFields = {
    nome: string;
    cpf: string;
    senha: string;
    email: string;
    data_nascimento: string;
    whatsapp: string;
    cep: string;
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    tipo_usuario: TipoUsuario;
    foto?: File | Blob | null;
};

export type CreateUserClienteFields = UserFormBaseFields & {
    tipo_usuario: "cliente";
    comprovante_end?: File | Blob | null;
};

export type CreateUserAdminFields = UserFormBaseFields & {
    tipo_usuario: "admin";
};

export type ChefDisponibilidadeInput = {
    dia_semana: string;
    manha: boolean;
    tarde: boolean;
    noite: boolean;
};

/** Campos extras do cadastro de chef (form-data). */
export type ChefProfileFields = {
    disponivel_viajar: boolean;
    tipo_transporte: string;
    instagram: string;
    escola_formacao: string;
    conte_sobre_voce: string;
    idiomas: string[];
    especialidades: string[];
    disponivel_para: string[];
    disponibilidade: ChefDisponibilidadeInput[];
};

export type CreateUserChefFields = UserFormBaseFields & ChefProfileFields & {
    tipo_usuario: "chef";
};

export type UpdateUserClienteFields = CreateUserClienteFields;
export type UpdateUserChefFields = CreateUserChefFields;

/** Chaves de form-data documentadas na collection (referência). */
export const USER_FORM_KEYS = {
    base: [
        "nome",
        "cpf",
        "senha",
        "email",
        "data_nascimento",
        "whatsapp",
        "cep",
        "endereco",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "estado",
        "tipo_usuario",
        "foto",
    ],
    cliente: ["comprovante_end"],
    chef: [
        "disponivel_viajar",
        "tipo_transporte",
        "instagram",
        "escola_formacao",
        "conte_sobre_voce",
        "idiomas[]",
        "especialidades[]",
        "disponivel_para[]",
        "disponibilidade[{index}][dia_semana]",
        "disponibilidade[{index}][manha]",
        "disponibilidade[{index}][tarde]",
        "disponibilidade[{index}][noite]",
    ],
} as const;

// ---------------------------------------------------------------------------
// Chefs — GET /api/chefs, PUT /api/chefs/update-status
// ---------------------------------------------------------------------------

export type ChefsListQuery = {
    status?: UserListStatus;
};

export type UpdateChefStatusBody = {
    id_user: number;
    aprovado: boolean;
    status: string;
};

// ---------------------------------------------------------------------------
// Clientes — GET /api/clientes
// ---------------------------------------------------------------------------

export type ClientesListQuery = {
    status?: UserListStatus;
};

// ---------------------------------------------------------------------------
// Ingredientes — /api/ingredientes*
// ---------------------------------------------------------------------------

export type IngredientesListQuery = {
    status?: AtivoInativoStatus;
};

export type IngredienteCreateBody = {
    descricao: string;
    valor: number;
    unidade: string;
    id_categoria: number;
    marca_pref?: string | null;
    fornecedor?: string | null;
    volume_peso?: number;
    unidade_medida?: string;
    quantidade?: number;
};

export type IngredienteUpdateBody = {
    descricao: string;
    valor: number;
    unidade: string;
    id_categoria: number;
    marca_pref?: string | null;
    fornecedor?: string | null;
    volume_peso?: number;
    unidade_medida?: string;
    quantidade?: number;
    ativo?: boolean;
};

/** POST /api/ingredientes/upload — campo `file` no form-data. */
export type IngredientesUploadForm = {
    file: File | Blob;
};

// ---------------------------------------------------------------------------
// Ingredientes categorias — /api/ingredientes-categorias*
// ---------------------------------------------------------------------------

export type IngredienteCategoriaBody = {
    descricao: string;
};

// ---------------------------------------------------------------------------
// Pratos — /api/pratos*
// ---------------------------------------------------------------------------

export type PratosListQuery = {
    status?: AtivoInativoStatus;
};

export type PratoByIdQuery = {
    status?: AtivoInativoStatus;
};

/** Campos do form-data em POST/PUT /api/pratos (collection Postman). */
export type PratoFormFields = {
    nome_prato: string;
    descricao: string;
    quantidade: number | string;
    ativo: boolean | string;
    categorias: string;
    tipos_cozinha: string;
    temas: string;
    ingredientes_principais: string;
    pref_culinarias: string;
    ingredientes?: string | null;
    foto1?: File | Blob | string | null;
    foto2?: File | Blob | string | null;
    ficha_tecnica?: File | Blob | string | null;
    meal_preap?: boolean | string;
    get_togheter?: boolean | string;
    receita?: File | Blob | string | null;
    destaque_site?: boolean | string;
};

export const PRATO_FORM_KEYS = [
    "nome_prato",
    "descricao",
    "quantidade",
    "ativo",
    "categorias",
    "tipos_cozinha",
    "temas",
    "ingredientes_principais",
    "pref_culinarias",
    "ingredientes",
    "foto1",
    "foto2",
    "ficha_tecnica",
    "meal_preap",
    "get_togheter",
    "receita",
    "destaque_site",
] as const;

// ---------------------------------------------------------------------------
// Catálogos de pratos (JSON CRUD)
// ---------------------------------------------------------------------------

export type PratoCategoriaBody = {
    descricao: string;
    icone: string;
};

export type CatalogoDescricaoBody = {
    descricao: string;
};

export type TemaFormFields = {
    nome?: string;
    descricao: string;
    ativo?: boolean | string;
    foto?: File | Blob | null;
    pratos?: string; // JSON array of prato IDs, e.g. "[1,3,5]"
};

export type IngredientePrincipalBody = {
    descricao: string;
    icone?: string;
};

// ---------------------------------------------------------------------------
// Kitchen orders — /api/kitchen-orders*
// ---------------------------------------------------------------------------

export type KitchenOrdersListQuery = {
    /** Busca parcial por código (collection Postman). */
    code?: string;
};

export type KitchenOrdersListResponse = {
    success: boolean;
    data: KitchenOrderListItem[];
};

export type KitchenOrderListItem = {
    id: number;
    code: string;
    type: string;
    status: string;
    city: string;
    event_date: string;
    people_quantity: number;
    createdAt: string;
    cliente?: { id: number; nome: string; foto?: string | null } | null;
    chef?: { id: number; nome: string; foto?: string | null } | null;
};

export type KitchenOrderDishInput = {
    dish_id: number;
    quantity: number;
    observations?: string;
};

export type CreateKitchenOrderBody = {
    type: string;
    id_pagamento?: string;
    event_date: string;
    event_time: string;
    people_quantity: number;
    city: string;
    address: string;
    number: string;
    complement?: string;
    district: string;
    observations?: string;
    client_request?: string;
    dishes: KitchenOrderDishInput[];
};

export type UpdateKitchenOrderStatusBody = {
    status: string;
};

export type SpecialServiceProposalItem = {
    description: string;
    price: number;
};

export type SpecialServiceProposalBody = {
    items: SpecialServiceProposalItem[];
};

export type AssignKitchenOrderChefBody = {
    id_usuario_chef: number;
};
