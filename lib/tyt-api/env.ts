/**
 * Base URL da API TYT (equivalente à variável `{{URL}}` da collection Postman).
 * Produção atual: https://tyt-api.vercel.app/
 */
export function getTytApiBaseUrl(): string {
    const raw = process.env.NEXT_PUBLIC_TYT_API_URL ?? "https://tyt-api.vercel.app";
    return raw.replace(/\/$/, "");
}
