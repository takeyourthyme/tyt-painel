import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";
import { parseApiErrorMessage, parseJsonOrThrow, readResponseBody, TytApiError } from "./errors";
import type { ChangePasswordBody, ForgotPasswordBody, LoginBody, ResetPasswordBody } from "./types";

export type { ChangePasswordBody, ForgotPasswordBody, LoginBody, ResetPasswordBody } from "./types";

export type TytUserTipo = "admin" | "chef" | "cliente" | (string & {});

export type UsuarioChefIdioma = {
    id: number;
    id_user: number;
    idioma: string;
    active: boolean;
};

export type UsuarioChefEspecialidade = {
    id: number;
    id_user: number;
    especialidade: string;
    active: boolean;
};

export type UsuarioChefDisponivelPara = {
    id: number;
    id_user: number;
    disponivel_para: string;
    active: boolean;
};

export type UsuarioChefDisponibilidade = {
    id: number;
    id_user: number;
    dia_semana: string;
    manha: boolean;
    tarde: boolean;
    noite: boolean;
    active: boolean;
};

export type UsuarioChef = {
    id: number;
    id_user: number;
    disponivel_viajar: boolean;
    tipo_transporte: string;
    instagram: string;
    cadastro_aprovado: boolean;
    status: string;
    escola_formacao: string;
    conte_sobre_voce: string;
    createdAt: string;
    updatedAt: string;
    usuario_chef_idiomas: UsuarioChefIdioma[];
    usuario_chef_especialidades: UsuarioChefEspecialidade[];
    usuario_chef_disponivel_para: UsuarioChefDisponivelPara[];
    usuario_chef_disponibilidade: UsuarioChefDisponibilidade[];
};

export type TytUser = {
    id: number;
    nome: string;
    cpf: string;
    data_nascimento: string;
    whatsapp: string;
    email: string;
    cep: string;
    endereco: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
    foto: string | null;
    tipo_usuario: TytUserTipo;
    createdAt: string;
    usuario_cliente: unknown | null;
    usuario_chef: UsuarioChef | null;
};

export type LoginResponse = {
    message: string;
    token: string;
    user: TytUser;
};

export function postLogin(body: LoginBody) {
    return tytFetch(tytEndpoints.auth.login, { method: "POST", json: body });
}

export function isTytAdminUser(user: TytUser): boolean {
    return user.tipo_usuario === "admin";
}

export function isTytChefUser(user: TytUser): boolean {
    return user.tipo_usuario === "chef";
}

/** Apenas admin — perfil permitido no painel. */
export function isTytPanelUser(user: TytUser): boolean {
    return isTytAdminUser(user);
}

/** Login do painel: valida resposta, exige admin e retorna token + user. */
export async function loginPanel(body: LoginBody): Promise<LoginResponse> {
    const res = await postLogin(body);
    const text = await readResponseBody(res);

    if (!res.ok) {
        throw new TytApiError(res.status, parseApiErrorMessage(text, "E-mail ou senha inválidos."));
    }

    let data: LoginResponse;
    try {
        data = text ? (JSON.parse(text) as LoginResponse) : ({} as LoginResponse);
    } catch {
        throw new TytApiError(res.status, "Resposta inválida do servidor.");
    }

    if (!data.token || !data.user) {
        throw new TytApiError(res.status, "Login ok, mas o servidor não retornou token ou usuário.");
    }

    if (!isTytPanelUser(data.user)) {
        throw new TytApiError(403, "Acesso restrito a administradores.");
    }

    return data;
}

/** @deprecated Use `loginPanel`. */
export const loginAdmin = loginPanel;

export function postForgotPassword(body: ForgotPasswordBody) {
    return tytFetch(tytEndpoints.auth.forgotPassword, { method: "POST", json: body });
}

export function postResetPassword(body: ResetPasswordBody) {
    return tytFetch(tytEndpoints.auth.resetPassword, { method: "POST", json: body });
}

export function postChangePassword(body: ChangePasswordBody, token: string) {
    return tytFetch(tytEndpoints.auth.changePassword, { method: "POST", json: body, token });
}

/** Extrai token da resposta de login (formatos comuns). */
export function extractTokenFromLoginPayload(data: unknown): string | null {
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const direct = o.token ?? o.accessToken ?? o.access_token;
    if (typeof direct === "string" && direct.length > 0) return direct;
    const nested = o.data;
    if (nested && typeof nested === "object") {
        const d = nested as Record<string, unknown>;
        const inner = d.token ?? d.accessToken ?? d.access_token;
        if (typeof inner === "string" && inner.length > 0) return inner;
    }
    return null;
}

export async function loginJson<T = unknown>(body: LoginBody): Promise<T> {
    const res = await postLogin(body);
    return parseJsonOrThrow<T>(res);
}
