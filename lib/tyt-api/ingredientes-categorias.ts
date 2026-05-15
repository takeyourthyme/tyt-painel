import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";
import type { IngredienteCategoriaBody, ResourceId } from "./types";

export type { IngredienteCategoriaBody } from "./types";

function crud(
    method: "GET" | "POST" | "PUT" | "DELETE",
    token: string,
    options?: { id?: ResourceId; body?: IngredienteCategoriaBody },
) {
    const ep = tytEndpoints.ingredientesCategorias;
    const path = options?.id !== undefined ? ep.byId(options.id) : ep.collection;
    return tytFetch(path, {
        method,
        token,
        ...(options?.body !== undefined ? { json: options.body } : {}),
    });
}

export const ingredientesCategoriasApi = {
    create: (body: IngredienteCategoriaBody, token: string) => crud("POST", token, { body }),
    update: (id: ResourceId, body: IngredienteCategoriaBody, token: string) => crud("PUT", token, { id, body }),
    remove: (id: ResourceId, token: string) => crud("DELETE", token, { id }),
    getById: (id: ResourceId, token: string) => crud("GET", token, { id }),
    getAll: (token: string) => crud("GET", token),
};
