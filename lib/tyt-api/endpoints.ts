/** Rotas espelhadas da collection `TYT_Api.postman_collection.json` (variável `{{URL}}` + estes caminhos). */

export const tytEndpoints = {
    auth: {
        login: "/api/auth/login",
        forgotPassword: "/api/auth/forgot-password",
        resetPassword: "/api/auth/reset-password",
        changePassword: "/api/auth/change-password",
    },
    users: {
        collection: "/api/users",
        byId: (id: number | string) => `/api/users/${id}`,
    },
    chefs: {
        collection: "/api/chefs",
        updateStatus: "/api/chefs/update-status",
    },
    clientes: {
        collection: "/api/clientes",
    },
    ingredientes: {
        collection: "/api/ingredientes",
        byId: (id: number | string) => `/api/ingredientes/${id}`,
        toggleStatus: (id: number | string) => `/api/ingredientes/${id}/toggle-status`,
        templateDownload: "/api/ingredientes/template/download",
        upload: "/api/ingredientes/upload",
    },
    ingredientesCategorias: {
        collection: "/api/ingredientes-categorias",
        byId: (id: number | string) => `/api/ingredientes-categorias/${id}`,
    },
    pratos: {
        collection: "/api/pratos",
        byId: (id: number | string) => `/api/pratos/${id}`,
    },
    pratosCategorias: {
        collection: "/api/pratos-categorias",
        byId: (id: number | string) => `/api/pratos-categorias/${id}`,
    },
    tiposCozinha: {
        collection: "/api/tipos-cozinha",
        byId: (id: number | string) => `/api/tipos-cozinha/${id}`,
    },
    temas: {
        collection: "/api/temas",
        byId: (id: number | string) => `/api/temas/${id}`,
    },
    ingredientesPrincipais: {
        collection: "/api/ingredientes-principais",
        byId: (id: number | string) => `/api/ingredientes-principais/${id}`,
    },
    prefCulinarias: {
        collection: "/api/pref-culinarias",
        byId: (id: number | string) => `/api/pref-culinarias/${id}`,
    },
    kitchenOrders: {
        collection: "/api/kitchen-orders",
        byCode: (code: string) => `/api/kitchen-orders/${encodeURIComponent(code)}`,
        status: (id: number | string) => `/api/kitchen-orders/${id}/status`,
        specialServiceProposal: (id: number | string) => `/api/kitchen-orders/${id}/special-service-proposal`,
        cancel: (code: string) => `/api/kitchen-orders/${encodeURIComponent(code)}/cancel`,
        assignChef: (hashCodeOrder: string) => `/api/kitchen-orders/${encodeURIComponent(hashCodeOrder)}/assign-chef`,
    },
} as const;
