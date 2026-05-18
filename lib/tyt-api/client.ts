import { getTytApiBaseUrl } from "./env";

export type TytFetchInit = Omit<RequestInit, "headers"> & {
    /** Serializado como JSON com Content-Type application/json (substitui `body` quando informado) */
    json?: unknown;
    headers?: HeadersInit;
    /** Token Bearer (collection Postman `{{token}}`) */
    token?: string | null;
};

/**
 * `fetch` para a API TYT. Caminhos devem começar com `/api/...` (como na collection).
 */
export async function tytFetch(path: string, init: TytFetchInit = {}): Promise<Response> {
    const { json, token, headers: initHeaders, body: initBody, ...rest } = init;
    const base = getTytApiBaseUrl();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${base}${normalizedPath}`;

    const headers = new Headers(initHeaders);
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    let body: BodyInit | null | undefined = initBody;
    if (json !== undefined) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(json);
    }

    const res = await fetch(url, {
        ...rest,
        headers,
        body: body ?? null,
    });

    if (token && typeof window !== "undefined" && (res.status === 401 || res.status === 403)) {
        try {
            window.localStorage.removeItem("tyt_access_token");
            window.localStorage.removeItem("tyt_user");
        } catch {}

        if (!window.location.pathname.startsWith("/login")) {
            window.location.assign("/login");
        }
    }

    return res;
}
