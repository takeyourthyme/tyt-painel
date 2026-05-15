/** Serializa query params tipados (omite `undefined`, `null` e string vazia). */
export function toQueryString<T extends Record<string, string | number | boolean | undefined | null>>(
    params?: T,
): string {
    if (!params) return "";
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;
        search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : "";
}
