export class TytApiError extends Error {
    readonly status: number;
    readonly body: string;

    constructor(status: number, body: string) {
        super(`TYT API ${status}: ${body.slice(0, 200)}`);
        this.name = "TytApiError";
        this.status = status;
        this.body = body;
    }
}

export async function readResponseBody(res: Response): Promise<string> {
    try {
        return await res.text();
    } catch {
        return "";
    }
}

/** Extrai mensagem legível de corpo JSON ou texto da API. */
export function parseApiErrorMessage(body: string, fallback = "Ocorreu um erro. Tente novamente"): string {
    const trimmed = body.trim();
    if (!trimmed) return fallback;
    try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof data.message === "string" && data.message.length > 0) return data.message;
        if (typeof data.error === "string" && data.error.length > 0) return data.error;
    } catch {
        // corpo não é JSON
    }
    return trimmed;
}

export async function parseJsonOrThrow<T>(res: Response): Promise<T> {
    const text = await readResponseBody(res);
    if (!res.ok) {
        throw new TytApiError(res.status, text);
    }
    if (!text) {
        return undefined as T;
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new TytApiError(res.status, text);
    }
}
