import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";
import { buildTemaFormData } from "./form-data";
import type { CatalogoDescricaoBody, IngredientePrincipalBody, PratoCategoriaBody, ResourceId, TemaFormFields } from "./types";

export type { CatalogoDescricaoBody, IngredientePrincipalBody, PratoCategoriaBody } from "./types";

function crudJson(
    segment: "pratosCategorias" | "tiposCozinha" | "temas" | "ingredientesPrincipais" | "prefCulinarias",
    method: "GET" | "POST" | "PUT" | "DELETE",
    token: string,
    options?: { id?: ResourceId; body?: PratoCategoriaBody | CatalogoDescricaoBody | IngredientePrincipalBody },
) {
    const ep = tytEndpoints[segment];
    const path = options?.id !== undefined ? ep.byId(options.id) : ep.collection;
    return tytFetch(path, {
        method,
        token,
        ...(options?.body !== undefined ? { json: options.body } : {}),
    });
}

/** Pratos — Categorias */
export const pratosCategoriasApi = {
    create: (body: PratoCategoriaBody, token: string) => crudJson("pratosCategorias", "POST", token, { body }),
    update: (id: ResourceId, body: PratoCategoriaBody, token: string) =>
        crudJson("pratosCategorias", "PUT", token, { id, body }),
    remove: (id: ResourceId, token: string) => crudJson("pratosCategorias", "DELETE", token, { id }),
    getById: (id: ResourceId, token: string) => crudJson("pratosCategorias", "GET", token, { id }),
    getAll: (token: string) => crudJson("pratosCategorias", "GET", token),
};

/** Pratos — Tipos de cozinha */
export const tiposCozinhaApi = {
    create: (body: CatalogoDescricaoBody, token: string) => crudJson("tiposCozinha", "POST", token, { body }),
    update: (id: ResourceId, body: CatalogoDescricaoBody, token: string) =>
        crudJson("tiposCozinha", "PUT", token, { id, body }),
    remove: (id: ResourceId, token: string) => crudJson("tiposCozinha", "DELETE", token, { id }),
    getById: (id: ResourceId, token: string) => crudJson("tiposCozinha", "GET", token, { id }),
    getAll: (token: string) => crudJson("tiposCozinha", "GET", token),
};

/** Pratos — Temas (usa FormData para suportar upload de foto) */
export const temasApi = {
    create: (fields: TemaFormFields, token: string) => {
        const fd = buildTemaFormData(fields);
        return tytFetch(tytEndpoints.temas.collection, { method: "POST", token, body: fd });
    },
    update: (id: ResourceId, fields: TemaFormFields, token: string) => {
        const fd = buildTemaFormData(fields);
        return tytFetch(tytEndpoints.temas.byId(id), { method: "PUT", token, body: fd });
    },
    remove: (id: ResourceId, token: string) => crudJson("temas", "DELETE", token, { id }),
    getById: (id: ResourceId, token: string) => crudJson("temas", "GET", token, { id }),
    getAll: (token: string) => crudJson("temas", "GET", token),
};

/** Pratos — Ingredientes principais */
export const ingredientesPrincipaisApi = {
    create: (body: IngredientePrincipalBody, token: string) => crudJson("ingredientesPrincipais", "POST", token, { body }),
    update: (id: ResourceId, body: IngredientePrincipalBody, token: string) =>
        crudJson("ingredientesPrincipais", "PUT", token, { id, body }),
    remove: (id: ResourceId, token: string) => crudJson("ingredientesPrincipais", "DELETE", token, { id }),
    getById: (id: ResourceId, token: string) => crudJson("ingredientesPrincipais", "GET", token, { id }),
    getAll: (token: string) => crudJson("ingredientesPrincipais", "GET", token),
};

/** Pratos — Preferências culinárias */
export const prefCulinariasApi = {
    create: (body: CatalogoDescricaoBody, token: string) => crudJson("prefCulinarias", "POST", token, { body }),
    update: (id: ResourceId, body: CatalogoDescricaoBody, token: string) =>
        crudJson("prefCulinarias", "PUT", token, { id, body }),
    remove: (id: ResourceId, token: string) => crudJson("prefCulinarias", "DELETE", token, { id }),
    getById: (id: ResourceId, token: string) => crudJson("prefCulinarias", "GET", token, { id }),
    getAll: (token: string) => crudJson("prefCulinarias", "GET", token),
};
