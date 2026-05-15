import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";
import { buildUserChefFormData, buildUserClienteFormData } from "./form-data";
import { toQueryString } from "./query";
import type {
    ChefsListQuery,
    ClientesListQuery,
    CreateUserChefFields,
    CreateUserClienteFields,
    ResourceId,
    UpdateChefStatusBody,
} from "./types";

export type {
    ChefsListQuery,
    ClientesListQuery,
    CreateUserChefFields,
    CreateUserClienteFields,
    UpdateChefStatusBody,
} from "./types";

export function postCreateUserCliente(fields: CreateUserClienteFields) {
    return postCreateUser(buildUserClienteFormData(fields));
}

export function postCreateUserChef(fields: CreateUserChefFields) {
    return postCreateUser(buildUserChefFormData(fields));
}

export function putUpdateUserCliente(id: ResourceId, fields: CreateUserClienteFields, token: string) {
    return putUpdateUser(id, buildUserClienteFormData(fields), token);
}

export function putUpdateUserChef(id: ResourceId, fields: CreateUserChefFields, token: string) {
    return putUpdateUser(id, buildUserChefFormData(fields), token);
}

export function postCreateUser(formData: FormData) {
    return tytFetch(tytEndpoints.users.collection, { method: "POST", body: formData });
}

export function putUpdateUser(id: ResourceId, formData: FormData, token: string) {
    return tytFetch(tytEndpoints.users.byId(id), { method: "PUT", body: formData, token });
}

export function getUsers(token: string) {
    return tytFetch(`${tytEndpoints.users.collection}/`, { method: "GET", token });
}

export function getUserById(id: ResourceId, token: string) {
    return tytFetch(tytEndpoints.users.byId(id), { method: "GET", token });
}

export function getChefs(token: string, query?: ChefsListQuery) {
    return tytFetch(`${tytEndpoints.chefs.collection}${toQueryString(query)}`, { method: "GET", token });
}

export function getClientes(token: string, query?: ClientesListQuery) {
    return tytFetch(`${tytEndpoints.clientes.collection}${toQueryString(query)}`, { method: "GET", token });
}

export function putChefUpdateStatus(body: UpdateChefStatusBody, token: string) {
    return tytFetch(tytEndpoints.chefs.updateStatus, { method: "PUT", json: body, token });
}
