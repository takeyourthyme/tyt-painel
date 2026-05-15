import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";
import { toQueryString } from "./query";
import type {
    IngredienteCreateBody,
    IngredienteUpdateBody,
    IngredientesListQuery,
    IngredientesUploadForm,
    ResourceId,
} from "./types";

export type { IngredienteCreateBody, IngredienteUpdateBody, IngredientesListQuery } from "./types";

export function postIngrediente(body: IngredienteCreateBody, token: string) {
    return tytFetch(tytEndpoints.ingredientes.collection, { method: "POST", json: body, token });
}

export function getIngredientesTemplate(token: string) {
    return tytFetch(tytEndpoints.ingredientes.templateDownload, { method: "GET", token });
}

export function postIngredientesUpload({ file }: IngredientesUploadForm, token: string) {
    const formData = new FormData();
    formData.append("file", file);
    return tytFetch(tytEndpoints.ingredientes.upload, { method: "POST", body: formData, token });
}

export function putIngrediente(id: ResourceId, body: IngredienteUpdateBody, token: string) {
    return tytFetch(tytEndpoints.ingredientes.byId(id), { method: "PUT", json: body, token });
}

export function deleteIngrediente(id: ResourceId, token: string) {
    return tytFetch(tytEndpoints.ingredientes.byId(id), { method: "DELETE", token });
}

export function putIngredienteToggleStatus(id: ResourceId, token: string) {
    return tytFetch(tytEndpoints.ingredientes.toggleStatus(id), { method: "PUT", token });
}

export function getIngredientes(token: string, query?: IngredientesListQuery) {
    return tytFetch(`${tytEndpoints.ingredientes.collection}${toQueryString(query)}`, { method: "GET", token });
}

export function getIngredienteById(id: ResourceId, token: string) {
    return tytFetch(tytEndpoints.ingredientes.byId(id), { method: "GET", token });
}
