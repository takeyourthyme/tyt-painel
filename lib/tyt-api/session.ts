import { isTytAdminUser, isTytChefUser, isTytPanelUser, type TytUser } from "./auth";

const TOKEN_STORAGE_KEY = "tyt_access_token";
const USER_STORAGE_KEY = "tyt_user";

export function getTytAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getTytUser(): TytUser | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as TytUser;
    } catch {
        return null;
    }
}

export function setTytAccessToken(token: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function setTytUser(user: TytUser): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function setTytSession(token: string, user: TytUser): void {
    setTytAccessToken(token);
    setTytUser(user);
}

export function clearTytAccessToken(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function clearTytUser(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function clearTytSession(): void {
    clearTytAccessToken();
    clearTytUser();
}

export function hasTytSession(): boolean {
    const user = getTytUser();
    return Boolean(getTytAccessToken() && user && isTytPanelUser(user));
}

export function isSessionAdmin(): boolean {
    const user = getTytUser();
    return user ? isTytAdminUser(user) : false;
}

export function isSessionChef(): boolean {
    const user = getTytUser();
    return user ? isTytChefUser(user) : false;
}
