import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";
import { buildPratoFormData } from "./form-data";
import { toQueryString } from "./query";
import type { PratoByIdQuery, PratoFormFields, PratosListQuery, ResourceId } from "./types";

export type { PratoByIdQuery, PratoFormFields, PratosListQuery } from "./types";

export function postPrato(formData: FormData, token: string) {
    return tytFetch(tytEndpoints.pratos.collection, { method: "POST", body: formData, token });
}

export function postPratoFromFields(fields: PratoFormFields, token: string) {
    return postPrato(buildPratoFormData(fields), token);
}

export function putPrato(id: ResourceId, formData: FormData, token: string) {
    return tytFetch(tytEndpoints.pratos.byId(id), { method: "PUT", body: formData, token });
}

export function putPratoFromFields(id: ResourceId, fields: PratoFormFields, token: string) {
    return putPrato(id, buildPratoFormData(fields), token);
}

export function deletePrato(id: ResourceId, token: string) {
    return tytFetch(tytEndpoints.pratos.byId(id), { method: "DELETE", token });
}

export function getPratos(token: string, query?: PratosListQuery) {
    return tytFetch(`${tytEndpoints.pratos.collection}${toQueryString(query)}`, { method: "GET", token });
}

export function getPratoById(id: ResourceId, token: string, query?: PratoByIdQuery) {
    return tytFetch(`${tytEndpoints.pratos.byId(id)}${toQueryString(query)}`, { method: "GET", token });
}
