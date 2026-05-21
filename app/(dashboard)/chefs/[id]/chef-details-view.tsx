"use client";

import { useState } from "react";
import {
    Calendar as CalendarIcon,
    CheckCircle,
    Download02,
    Eye,
    FilterLines,
    SearchLg,
    Share04,
    Star01,
    UserSquare,
    X as CloseIcon,
    XCircle,
} from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import type { Key } from "react-aria-components";
import { toast } from "sonner";
import { Calendar } from "@/components/application/date-picker/calendar";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Table, TableCard } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { NativeSelect } from "@/components/base/select/select-native";
import { Toggle } from "@/components/base/toggle/toggle";
import { cx } from "@/utils/cx";
import { formatAvailabilityDayLabel, formatServiceChipLabel, useChefApprovalActions, useChefDetails } from "./chef-details-data";

const playfair = Playfair_Display({
    subsets: ["latin"],
    display: "swap",
});

type TabId = "chef_data" | "schedule" | "history";

const tabItems: { id: TabId; label: string }[] = [
    { id: "chef_data", label: "Dados Chefs" },
    { id: "schedule", label: "Agenda" },
    { id: "history", label: "Histórico de serviços" },
];

type ScheduleStatus = "pending" | "confirmed";

type ScheduleItem = {
    id: string;
    serviceLabel: string;
    status: ScheduleStatus;
    dateLabel: string;
    timeLabel: string;
    locationLabel: string;
    clientName: string;
};

type HistoryStatus = "pending" | "confirmed" | "cancelled";

type HistoryRow = {
    id: string;
    serviceLabel: string;
    valueLabel: string;
    status: HistoryStatus;
    dateLabel: string;
    locationLabel: string;
    clientName: string;
};

type ChefStatus = "cadastro" | "analise" | "entrevista" | "documentacao" | "ativo" | "inativo";

function normalizeChefStatus(raw: string | null | undefined): ChefStatus | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    const mapped: Record<string, ChefStatus> = {
        cadastro: "cadastro",
        analise: "analise",
        análise: "analise",
        entrevista: "entrevista",
        documentacao: "documentacao",
        documentação: "documentacao",
        ativo: "ativo",
        inativo: "inativo",
        active: "ativo",
        inactive: "inativo",
        pending: "cadastro",
    };
    return mapped[normalized] ?? null;
}

function isFinalChefStatus(status: ChefStatus): boolean {
    return status === "ativo" || status === "inativo";
}

function formatChefStatusLabel(status: ChefStatus): string {
    const map: Record<ChefStatus, string> = {
        cadastro: "Cadastro",
        analise: "Análise",
        entrevista: "Entrevista",
        documentacao: "Documentação",
        ativo: "Ativo",
        inativo: "Inativo",
    };
    return map[status];
}

function getChefStatusBadgeColor(status: ChefStatus): "success" | "gray" | "warning" {
    if (status === "ativo") return "success";
    if (status === "inativo") return "gray";
    return "warning";
}

function getInitials(name: string): string {
    const parts = name
        .trim()
        .split(/\s+/g)
        .filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return `${first}${last}`.toUpperCase();
}

function formatOrderDate(dateIso: string | null): string {
    if (!dateIso) return "—";
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
}

function formatBooleanLabel(value: boolean | null): string {
    if (value === null) return "—";
    return value ? "Sim" : "Não";
}

function formatLanguageLabel(code: string): string {
    const s = code.trim().toLowerCase();
    const map: Record<string, string> = {
        br: "BR - Português",
        pt: "BR - Português",
        us: "EN - Inglês",
        en: "EN - Inglês",
        es: "ES - Espanhol",
        it: "IT - Italiano",
        fr: "FR - Francês",
        de: "DE - Alemão",
        jp: "JP - Japão",
        ja: "JP - Japão",
    };
    return map[s] ?? code;
}

function formatInstagramUsername(username: string): string {
    return username.startsWith("@") ? username : `@${username}`;
}

function formatInstagramLink(username: string): string {
    const user = username.startsWith("@") ? username.slice(1) : username;
    return `https://instagram.com/${user}`;
}

function formatWhatsAppLink(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits}`;
}

function formatMailto(email: string): string | null {
    if (!email || email === "—") return null;
    return `mailto:${email}`;
}

function addressLine(chef: { address: string | null; number: string | null }): string {
    if (!chef.address && !chef.number) return "—";
    return [chef.address, chef.number].filter((x) => x && x.trim().length > 0).join(", ");
}

function cityStateLine(chef: { city: string | null; state: string | null }): string {
    if (chef.city && chef.state) return `${chef.city}/${chef.state}`;
    return chef.city || chef.state || "—";
}

function availabilityMatrix(availability: { day: string; morning: boolean; afternoon: boolean; night: boolean }[]) {
    const order = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"] as const;
    const norm = (v: string) =>
        v
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    const map = new Map<string, { morning: boolean; afternoon: boolean; night: boolean }>();
    availability.forEach((a) => map.set(norm(a.day), { morning: a.morning, afternoon: a.afternoon, night: a.night }));

    return order.map((key) => {
        const slot = map.get(key) ?? { morning: false, afternoon: false, night: false };
        return { dayKey: key, dayLabel: formatAvailabilityDayLabel(key), ...slot };
    });
}

function SectionHeader({ title, description }: { title: string; description: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary ring-1 ring-secondary ring-inset">
                <UserSquare className="size-5 text-tertiary" aria-hidden />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{title}</p>
                <p className="mt-0.5 text-sm text-tertiary">{description}</p>
            </div>
        </div>
    );
}

function DataRow({ label, value, href }: { label: string; value: string; href?: string | null }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-quaternary">{label}</p>
            {href ? (
                <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:text-brand-secondary"
                >
                    <span>{value}</span>
                    <Share04 className="size-4" aria-hidden />
                </a>
            ) : (
                <p className="text-sm font-semibold text-primary">{value}</p>
            )}
        </div>
    );
}

function scheduleStatusBadge(status: ScheduleStatus) {
    if (status === "confirmed") {
        return (
            <Badge size="sm" type="pill-color" color="success">
                Confirmado
            </Badge>
        );
    }
    return (
        <Badge size="sm" type="pill-color" color="warning">
            Pendente
        </Badge>
    );
}

function historyStatusBadge(status: HistoryStatus) {
    if (status === "confirmed") {
        return (
            <Badge size="sm" type="pill-color" color="success">
                Confirmado
            </Badge>
        );
    }
    if (status === "cancelled") {
        return (
            <Badge size="sm" type="pill-color" color="error">
                Cancelado
            </Badge>
        );
    }
    return (
        <Badge size="sm" type="pill-color" color="warning">
            Pendente
        </Badge>
    );
}

function ScheduleCard({ item }: { item: ScheduleItem }) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-secondary bg-primary px-5 py-4 shadow-xs">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <CalendarIcon className="size-5 text-tertiary" aria-hidden />
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-primary">{item.serviceLabel}</p>
                        {scheduleStatusBadge(item.status)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-tertiary">
                        <span className="whitespace-nowrap">
                            {item.dateLabel} às {item.timeLabel}
                        </span>
                        <span className="text-quaternary">•</span>
                        <span className="truncate">{item.locationLabel}</span>
                        <span className="text-quaternary">•</span>
                        <span className="whitespace-nowrap">{item.clientName}</span>
                    </div>
                </div>
            </div>

            <ButtonUtility icon={Eye} color="secondary" size="sm" aria-label="Ver" />
        </div>
    );
}

export function ChefDetailsView({ id }: { id: string }) {
    const { chef, orders, metrics, loading, error, reload, canManage } = useChefDetails(id);
    const approval = useChefApprovalActions();
    const [selectedTab, setSelectedTab] = useState<Key>("chef_data");
    const [historyPage] = useState(1);
    const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
    const [scheduleQuery, setScheduleQuery] = useState("");
    const [historyQuery, setHistoryQuery] = useState("");

    const headerName = chef?.name ?? "Perfil do Profissional";
    const headerEmail = chef?.email ?? "—";
    const headerInitials = chef ? getInitials(chef.name) : "";
    const ratingValue = "—";
    const ratingMeta = "— avaliações";
    const chefStatus = chef ? (normalizeChefStatus(chef.statusLabel) ?? (chef.approved ? "ativo" : "cadastro")) : null;
    const isFinalStatus = chefStatus ? isFinalChefStatus(chefStatus) : false;
    const showReviewActions = Boolean(canManage && chef?.chefUserId && chefStatus && !isFinalStatus);
    const showToggle = Boolean(canManage && chef?.chefUserId && chefStatus && isFinalStatus);

    const safeOrders = orders ?? [];

    const orderEventDateTime = (o: typeof safeOrders[number]): Date | null => {
        if (!o.eventDate) return null;
        const base = new Date(o.eventDate);
        if (Number.isNaN(base.getTime())) return null;
        if (!o.eventTime) return base;
        const m = o.eventTime.trim().match(/^(\d{1,2}):(\d{2})/);
        if (!m) return base;
        const hh = Number(m[1]);
        const mm = Number(m[2]);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return base;
        const d = new Date(base);
        d.setHours(hh, mm, 0, 0);
        return d;
    };

    const orderIsCancelled = (status: string | null) => {
        if (!status) return false;
        const s = status.trim().toLowerCase();
        return s.includes("cancel") || s.includes("canceled") || s.includes("cancelled");
    };

    const orderIsConfirmed = (status: string | null) => {
        if (!status) return false;
        const s = status.trim().toLowerCase();
        return s.includes("confirm") || s === "confirmed";
    };

    const formatTimeLabel = (raw: string | null) => {
        if (!raw) return "—";
        const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
        if (!m) return raw;
        return `${m[1].padStart(2, "0")}h${m[2]}`;
    };

    const formatLocationLabel = (o: typeof safeOrders[number]) => {
        const city = o.city?.trim();
        const state = o.state?.trim();
        if (city && state) return `${city} - ${state}`;
        return city || state || "—";
    };

    const formatCurrency = (value: number | null) => {
        if (value === null) return "—";
        try {
            return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        } catch {
            return "—";
        }
    };

    const scheduleOrders = safeOrders
        .filter((o) => {
            const dt = orderEventDateTime(o);
            if (!dt) return false;
            return dt.getTime() >= Date.now() && !orderIsCancelled(o.status);
        })
        .filter((o) => {
            const q = scheduleQuery.trim().toLowerCase();
            if (!q) return true;
            const hay = `${o.code ?? ""} ${o.type ?? ""} ${o.city ?? ""} ${o.clientName ?? ""}`.toLowerCase();
            return hay.includes(q);
        })
        .sort((a, b) => (orderEventDateTime(a)?.getTime() ?? 0) - (orderEventDateTime(b)?.getTime() ?? 0));

    const historyOrders = safeOrders
        .filter((o) => {
            const dt = orderEventDateTime(o);
            if (!dt) return false;
            return dt.getTime() < Date.now() || orderIsCancelled(o.status);
        })
        .filter((o) => {
            const q = historyQuery.trim().toLowerCase();
            if (!q) return true;
            const hay = `${o.code ?? ""} ${o.type ?? ""} ${o.city ?? ""} ${o.clientName ?? ""}`.toLowerCase();
            return hay.includes(q);
        })
        .sort((a, b) => (orderEventDateTime(b)?.getTime() ?? 0) - (orderEventDateTime(a)?.getTime() ?? 0));

    const scheduleItems: ScheduleItem[] = scheduleOrders.map((o) => {
        const dt = orderEventDateTime(o);
        return {
            id: o.id,
            serviceLabel: formatServiceChipLabel(o.type ?? "—"),
            status: orderIsConfirmed(o.status) ? "confirmed" : "pending",
            dateLabel: dt ? dt.toLocaleDateString("pt-BR") : "—",
            timeLabel: formatTimeLabel(o.eventTime),
            locationLabel: formatLocationLabel(o),
            clientName: o.clientName ?? "—",
        };
    });

    const historyRows: HistoryRow[] = historyOrders.map((o) => {
        const dt = orderEventDateTime(o);
        return {
            id: o.id,
            serviceLabel: formatServiceChipLabel(o.type ?? "—"),
            valueLabel: formatCurrency(o.totalValue),
            status: orderIsCancelled(o.status) ? "cancelled" : orderIsConfirmed(o.status) ? "confirmed" : "pending",
            dateLabel: dt ? dt.toLocaleDateString("pt-BR") : "—",
            locationLabel: formatLocationLabel(o),
            clientName: o.clientName ?? "—",
        };
    });

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-3">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                        <Link href="/chefs" className="font-medium hover:text-tertiary_hover">
                            Personal Chefs
                        </Link>
                        <span className="text-quaternary">›</span>
                        <Link href="/chefs" className="font-medium hover:text-tertiary_hover">
                            Todos Chefs
                        </Link>
                        <span className="text-quaternary">›</span>
                        <span className="font-medium text-secondary">{chef ? chef.name.split(" ")[0] : "Detalhes"}</span>
                    </nav>

                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className={cx(playfair.className, "text-display-sm font-semibold text-primary md:text-display-md")}>Perfil do Profissional</h1>
                            <p className="mt-1 text-sm text-tertiary">
                                Visualize o perfil completo e acompanhe a disponibilidade e os serviços realizados pelo profissional na plataforma
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {loading ? <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." /> : null}
                            {showReviewActions ? (
                                <>
                                    <Button
                                        color="secondary-destructive"
                                        size="md"
                                        isDisabled={approval.loading || loading}
                                        onClick={() => setConfirmAction("reject")}
                                    >
                                        Reprovar cadastro
                                    </Button>
                                    <Button
                                        color="primary"
                                        size="md"
                                        isDisabled={approval.loading || loading}
                                        onClick={() => setConfirmAction("approve")}
                                    >
                                        Aprovar cadastro
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    </div>
                </header>

                {error ? (
                    <section role="alert" className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar os dados do chef.</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void reload()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                <section className="rounded-xl bg-utility-blue-light-50 p-4 shadow-xs ring-1 ring-utility-blue-light-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                            <Avatar src={chef?.avatarUrl ?? null} initials={headerInitials} size="lg" alt={headerName} />
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-lg font-semibold text-primary">{headerName}</p>
                                    {chefStatus ? (
                                        <Badge size="sm" type="pill-color" color={getChefStatusBadgeColor(chefStatus)}>
                                            {formatChefStatusLabel(chefStatus)}
                                        </Badge>
                                    ) : null}
                                </div>
                                <p className="mt-0.5 truncate text-sm text-tertiary">{headerEmail}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-tertiary">
                                    <span className="inline-flex items-center gap-1">
                                        <Star01 className="size-4 text-utility-warning-400" aria-hidden />
                                        <span className="font-semibold text-secondary">{ratingValue}</span>
                                        <span className="text-quaternary">({ratingMeta})</span>
                                    </span>
                                    <span className="text-quaternary">|</span>
                                    <span className="text-quaternary">Membro há {chef?.memberSinceLabel ?? "—"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-xl bg-primary px-4 py-3 ring-1 ring-secondary ring-inset md:min-w-[360px]">
                            {chefStatus && !isFinalStatus && canManage && chef?.chefUserId ? (
                                <div className="flex w-full items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-primary">Etapa</p>
                                        <p className="mt-0.5 text-xs text-tertiary">Atualize a etapa do cadastro do profissional.</p>
                                    </div>
                                    <div className="w-[180px]">
                                        <Select
                                            aria-label="Etapa do cadastro"
                                            size="sm"
                                            selectedKey={chefStatus}
                                            isDisabled={approval.loading || loading}
                                            onSelectionChange={async (key) => {
                                                const next = String(key) as ChefStatus;
                                                if (!chef.chefUserId) return;
                                                if (isFinalChefStatus(next)) return;
                                                const result = await approval.update({ chefUserId: chef.chefUserId, approved: false, status: next });
                                                if (result.ok) {
                                                    await reload();
                                                }
                                            }}
                                            items={[
                                                { id: "cadastro", label: "Cadastro" },
                                                { id: "analise", label: "Análise" },
                                                { id: "entrevista", label: "Entrevista" },
                                                { id: "documentacao", label: "Documentação" },
                                            ]}
                                        >
                                            {(item) => <Select.Item {...item} />}
                                        </Select>
                                    </div>
                                </div>
                            ) : chefStatus ? (
                                <>
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-utility-blue-light-50">
                                            {chefStatus === "ativo" ? (
                                                <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                            ) : (
                                                <XCircle className="size-5 text-utility-gray-400" aria-hidden />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-primary">{chefStatus === "ativo" ? "Ativo" : "Inativo"}</p>
                                            <p className="mt-0.5 text-xs text-tertiary">
                                                {chefStatus === "ativo"
                                                    ? "Conta habilitada para acesso e participação em novos trabalhos."
                                                    : "Não habilitada para acesso e participação em novos trabalhos."}
                                            </p>
                                        </div>
                                    </div>
                                    {showToggle ? (
                                        <Toggle
                                            slim
                                            size="sm"
                                            isSelected={chefStatus === "ativo"}
                                            isDisabled={approval.loading || loading}
                                            onChange={async (isSelected) => {
                                                if (!chef?.chefUserId) return;
                                                const result = await approval.update({
                                                    chefUserId: chef.chefUserId,
                                                    approved: isSelected,
                                                    status: isSelected ? "ativo" : "inativo",
                                                });
                                                if (result.ok) {
                                                    await reload();
                                                }
                                            }}
                                        />
                                    ) : null}
                                </>
                            ) : (
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-utility-blue-light-50">
                                        <CheckCircle className="size-5 text-utility-gray-300" aria-hidden />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-primary">—</p>
                                        <p className="mt-0.5 text-xs text-tertiary">Carregando status do profissional.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <ModalOverlay
                    isOpen={Boolean(confirmAction)}
                    isDismissable
                    onOpenChange={(open) => {
                        if (!open) setConfirmAction(null);
                    }}
                >
                    <Modal>
                        <Dialog>
                            <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                                <div className="flex items-start gap-4 px-6 pt-6">
                                    <div
                                        className={cx(
                                            "flex size-12 shrink-0 items-center justify-center rounded-full",
                                            confirmAction === "reject" ? "bg-error-primary" : "bg-success-primary",
                                        )}
                                    >
                                        {confirmAction === "reject" ? (
                                            <XCircle className="size-6 text-error-solid" aria-hidden />
                                        ) : (
                                            <CheckCircle className="size-6 text-success-solid" aria-hidden />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-md font-semibold text-primary">
                                                    {confirmAction === "reject" ? "Reprovar personal chef?" : "Aprovar personal chef?"}
                                                </p>
                                                <p className="mt-1 text-sm text-tertiary">
                                                    Você tem certeza que deseja {confirmAction === "reject" ? "reprovar" : "aprovar"} esse chef? Esta ação não
                                                    pode ser desfeita.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                aria-label="Fechar"
                                                className="flex size-9 items-center justify-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                                onClick={() => setConfirmAction(null)}
                                            >
                                                <CloseIcon className="size-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 px-6 pt-6 pb-6">
                                    <Button color="secondary" size="md" className="flex-1" isDisabled={approval.loading} onClick={() => setConfirmAction(null)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        color={confirmAction === "reject" ? "primary-destructive" : "primary"}
                                        size="md"
                                        className="flex-1"
                                        isLoading={approval.loading}
                                        isDisabled={!chef?.chefUserId}
                                        onClick={async () => {
                                            if (!chef?.chefUserId || !confirmAction) return;
                                            const isApprove = confirmAction === "approve";
                                            const result = await approval.update({
                                                chefUserId: chef.chefUserId,
                                                approved: isApprove,
                                                status: isApprove ? "ativo" : "inativo",
                                            });

                                            if (result.ok) {
                                                toast.success(isApprove ? "Chef aprovado com sucesso!" : "Chef reprovado com sucesso!", {
                                                    description: isApprove
                                                        ? "O profissional agora tem acesso total à plataforma e já pode receber solicitações."
                                                        : "O profissional não terá acesso à plataforma e não poderá receber solicitações.",
                                                });
                                                await reload();
                                            } else {
                                                toast.error(isApprove ? "Não foi possível aprovar o chef." : "Não foi possível reprovar o chef.", {
                                                    description: result.error ?? "Ocorreu um erro. Tente novamente.",
                                                });
                                            }

                                            setConfirmAction(null);
                                        }}
                                    >
                                        {confirmAction === "reject" ? "Reprovar" : "Aprovar"}
                                    </Button>
                                </div>
                            </div>
                        </Dialog>
                    </Modal>
                </ModalOverlay>

                <section className="flex flex-col gap-6">
                    <NativeSelect
                        aria-label="Seção"
                        value={selectedTab as string}
                        onChange={(e) => setSelectedTab(e.target.value)}
                        options={tabItems.map((t) => ({ label: t.label, value: t.id }))}
                        className="w-full md:hidden"
                    />

                    <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} className="hidden w-full flex-col gap-6 md:flex">
                        <Tabs.List type="underline" size="md" items={tabItems} className="w-full">
                            {(tab) => <Tabs.Item {...tab} id={tab.id} />}
                        </Tabs.List>

                        <Tabs.Panel id="chef_data" className="flex flex-col gap-6 outline-hidden">
                            {!chef && loading ? (
                                <div className="rounded-xl bg-primary p-6 shadow-xs ring-1 ring-secondary ring-inset">
                                    <LoadingIndicator type="line-spinner" size="md" label="Carregando dados..." />
                                </div>
                            ) : null}

                            {chef ? (
                                <>
                                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                        <div className="border-b border-secondary px-6 py-5">
                                            <SectionHeader title="Sobre o Chef" description="Perfil profissional e especialidades..." />
                                        </div>
                                        <div className="px-6 py-5">
                                            <div className="flex flex-col gap-5">
                                                <div>
                                                    <p className="text-sm font-medium text-secondary">Apresentação</p>
                                                    <p className="mt-1 text-sm text-tertiary">{chef.about || "—"}</p>
                                                </div>

                                                <div className="grid gap-4 md:grid-cols-4">
                                                    <DataRow label="Escola de formação" value={chef.school || "—"} />
                                                    <DataRow
                                                        label="Instagram"
                                                        value={formatInstagramUsername(chef.username)}
                                                        href={formatInstagramLink(chef.username)}
                                                    />
                                                    <DataRow label="Tipo de serviço desejado" value="Chef" />
                                                    <DataRow label="Tipos de Prato" value="—" />
                                                </div>

                                                <div>
                                                    <p className="text-sm font-medium text-secondary">Especialidades culinárias</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {chef.specialties.length > 0 ? (
                                                            chef.specialties.map((s) => (
                                                                <Badge key={s} size="sm" type="pill-color" color="brand">
                                                                    {s}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-sm text-tertiary">—</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-sm font-medium text-secondary">Idiomas</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {chef.languages.length > 0 ? (
                                                            chef.languages.map((l) => (
                                                                <Badge key={l} size="sm" type="pill-color" color="brand">
                                                                    {formatLanguageLabel(l)}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-sm text-tertiary">—</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-sm font-medium text-secondary">Disponível para</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {chef.availableFor.length > 0 ? (
                                                            chef.availableFor.map((v) => (
                                                                <Badge key={v} size="sm" type="pill-color" color="brand">
                                                                    {formatServiceChipLabel(v)}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-sm text-tertiary">—</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                        <div className="border-b border-secondary px-6 py-5">
                                            <SectionHeader title="Dados básicos" description="Informações de identificação e contato..." />
                                        </div>
                                        <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
                                            <DataRow label="CPF" value={chef.cpf} />
                                            <DataRow label="E-mail" value={chef.email} href={formatMailto(chef.email)} />
                                            <DataRow label="Data de nascimento" value={chef.birthDate} />
                                            <DataRow label="WhatsApp" value={chef.whatsapp} href={formatWhatsAppLink(chef.whatsapp)} />
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                        <div className="border-b border-secondary px-6 py-5">
                                            <SectionHeader title="Localização" description="Endereço e raio de atuação..." />
                                        </div>
                                        <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
                                            <DataRow label="CEP" value={chef.cep || "—"} />
                                            <DataRow label="Endereço" value={addressLine(chef)} />
                                            <DataRow label="Bairro" value={chef.district || "—"} />
                                            <DataRow label="Número" value={chef.number || "—"} />
                                            <DataRow label="Complemento" value={chef.complement || "—"} />
                                            <DataRow label="Cidade/UF" value={cityStateLine(chef)} />
                                            <DataRow label="Disponibilidade para deslocamento" value={formatBooleanLabel(chef.canTravel)} />
                                            <DataRow label="Tipo de transporte" value={chef.transportType || "—"} />
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                        <div className="border-b border-secondary px-6 py-5">
                                            <SectionHeader title="Disponibilidade" description="Turnos disponíveis para agendamento de serviços" />
                                        </div>
                                        <div className="px-6 py-5">
                                            <TableCard.Root>
                                                <Table aria-label="Disponibilidade" selectionMode="none">
                                                    <Table.Header>
                                                        <Table.Head id="day" label="Dia" className="min-w-[180px]" isRowHeader />
                                                        <Table.Head id="morning" label="Manhã" className="min-w-[120px]" />
                                                        <Table.Head id="afternoon" label="Tarde" className="min-w-[120px]" />
                                                        <Table.Head id="night" label="Noite" className="min-w-[120px]" />
                                                    </Table.Header>
                                                    <Table.Body items={availabilityMatrix(chef.availability)}>
                                                        {(item) => (
                                                            <Table.Row id={item.dayKey}>
                                                                <Table.Cell className="whitespace-nowrap">{item.dayLabel}</Table.Cell>
                                                                <Table.Cell>
                                                                    <div className="flex justify-center">
                                                                        {item.morning ? (
                                                                            <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                                        ) : (
                                                                            <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                                        )}
                                                                    </div>
                                                                </Table.Cell>
                                                                <Table.Cell>
                                                                    <div className="flex justify-center">
                                                                        {item.afternoon ? (
                                                                            <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                                        ) : (
                                                                            <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                                        )}
                                                                    </div>
                                                                </Table.Cell>
                                                                <Table.Cell>
                                                                    <div className="flex justify-center">
                                                                        {item.night ? (
                                                                            <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                                        ) : (
                                                                            <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                                        )}
                                                                    </div>
                                                                </Table.Cell>
                                                            </Table.Row>
                                                        )}
                                                    </Table.Body>
                                                </Table>
                                            </TableCard.Root>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </Tabs.Panel>

                        <Tabs.Panel id="schedule" className="outline-hidden">
                            <div className="flex flex-col gap-6">
                                <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                        <Calendar todayLabel="Hoje" weekdayLetterLen={1} />
                                    </div>

                                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                        <div className="border-b border-secondary px-6 py-5">
                                            <p className="text-sm font-semibold text-primary">Programação Diária</p>
                                        </div>
                                        <div className="flex flex-col gap-3 px-6 py-5">
                                            {scheduleItems.length > 0 ? (
                                                scheduleItems.slice(0, 2).map((item) => <ScheduleCard key={item.id} item={item} />)
                                            ) : (
                                                <p className="text-sm text-tertiary">Nenhum agendamento encontrado.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                    <div className="flex flex-col gap-4 border-b border-secondary px-6 py-5 md:flex-row md:items-center md:justify-between">
                                        <p className="text-sm font-semibold text-primary">Próximos Agendamentos</p>
                                        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                                            <Input
                                                aria-label="Buscar por"
                                                placeholder="Buscar por"
                                                icon={SearchLg}
                                                size="sm"
                                                value={scheduleQuery}
                                                onChange={setScheduleQuery}
                                                className="w-full md:w-[320px]"
                                            />
                                            <Button size="md" color="primary" iconLeading={FilterLines} className="w-full md:w-auto">
                                                Filtrar
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3 px-6 py-5">
                                        {scheduleItems.length > 0 ? (
                                            scheduleItems.map((item) => <ScheduleCard key={item.id} item={item} />)
                                        ) : (
                                            <p className="text-sm text-tertiary">Nenhum agendamento encontrado.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Tabs.Panel>

                        <Tabs.Panel id="history" className="outline-hidden">
                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                <div className="border-b border-secondary px-6 py-5">
                                    <p className="text-sm font-semibold text-primary">Registro de Atendimentos</p>
                                </div>

                                <div className="flex flex-col gap-4 border-b border-secondary px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                                    <Input
                                        aria-label="Buscar por"
                                        placeholder="Buscar por"
                                        icon={SearchLg}
                                        size="sm"
                                        value={historyQuery}
                                        onChange={setHistoryQuery}
                                        className="w-full lg:max-w-[520px]"
                                    />
                                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                                        <Button size="md" color="secondary" iconLeading={Download02} className="w-full sm:w-auto">
                                            Exportar dados
                                        </Button>
                                        <Button size="md" color="primary" iconLeading={FilterLines} className="w-full sm:w-auto">
                                            Filtrar
                                        </Button>
                                    </div>
                                </div>

                                <div className="px-6 py-5">
                                    {historyRows.length > 0 ? (
                                        <TableCard.Root>
                                            <Table aria-label="Registro de Atendimentos" selectionMode="none">
                                                <Table.Header>
                                                    <Table.Head id="service" label="Serviço" className="min-w-[160px]" isRowHeader />
                                                    <Table.Head id="value" label="Valor" className="min-w-[140px]" />
                                                    <Table.Head id="status" label="Status" className="min-w-[160px]" />
                                                    <Table.Head id="date" label="Data" className="min-w-[140px]" />
                                                    <Table.Head id="location" label="Localização" className="min-w-[140px]" />
                                                    <Table.Head id="client" label="Cliente" className="min-w-[200px]" />
                                                    <Table.Head id="actions" label="" className="w-[56px]" />
                                                </Table.Header>
                                                <Table.Body items={historyRows}>
                                                    {(row) => (
                                                        <Table.Row id={row.id}>
                                                            <Table.Cell className="whitespace-nowrap">
                                                                <Badge size="sm" type="pill-color" color="gray">
                                                                    {row.serviceLabel}
                                                                </Badge>
                                                            </Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap text-tertiary">{row.valueLabel}</Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap">{historyStatusBadge(row.status)}</Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap text-tertiary">{row.dateLabel}</Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap text-tertiary">{row.locationLabel}</Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap text-tertiary">{row.clientName}</Table.Cell>
                                                            <Table.Cell>
                                                                <div className="flex justify-end">
                                                                    <ButtonUtility icon={Eye} color="secondary" size="sm" aria-label="Ver" />
                                                                </div>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table>
                                        </TableCard.Root>
                                    ) : (
                                        <p className="text-sm text-tertiary">Nenhum serviço encontrado.</p>
                                    )}

                                    <div className="mt-4 flex items-center justify-between border-t border-secondary pt-4">
                                        <Button color="secondary" size="sm">
                                            Anterior
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                aria-current="page"
                                                className="flex size-10 items-center justify-center rounded-full bg-primary_hover text-sm font-medium text-secondary"
                                            >
                                                {historyPage}
                                            </button>
                                            <span className="flex size-10 items-center justify-center text-tertiary">2</span>
                                            <span className="flex size-10 items-center justify-center text-tertiary">3</span>
                                            <span className="flex size-10 items-center justify-center text-tertiary">…</span>
                                            <span className="flex size-10 items-center justify-center text-tertiary">10</span>
                                        </div>
                                        <Button color="secondary" size="sm">
                                            Próximo
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Tabs.Panel>
                    </Tabs>

                    <div className="flex flex-col gap-6 md:hidden">
                        {selectedTab === "chef_data" ? (
                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                <div className="flex min-h-[min(360px,60vh)] items-center justify-center px-6 py-10 md:px-8 md:py-12">
                                    <EmptyState size="sm" className="max-w-[420px]">
                                        <EmptyState.Header pattern="circle">
                                            <EmptyState.FeaturedIcon color="gray" theme="modern" icon={UserSquare} />
                                        </EmptyState.Header>
                                        <EmptyState.Content>
                                            <h2 className="text-center text-md font-semibold text-primary">Abra em uma tela maior</h2>
                                            <EmptyState.Description>O layout completo do perfil fica disponível a partir do tablet.</EmptyState.Description>
                                        </EmptyState.Content>
                                    </EmptyState>
                                </div>
                            </div>
                        ) : selectedTab === "schedule" ? (
                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                <div className="flex flex-col gap-4 border-b border-secondary px-6 py-5">
                                    <p className="text-sm font-semibold text-primary">Próximos Agendamentos</p>
                                    <Input
                                        aria-label="Buscar por"
                                        placeholder="Buscar por"
                                        icon={SearchLg}
                                        size="sm"
                                        value={scheduleQuery}
                                        onChange={setScheduleQuery}
                                    />
                                </div>
                                <div className="flex flex-col gap-3 px-6 py-5">
                                    {scheduleItems.length > 0 ? (
                                        scheduleItems.map((item) => <ScheduleCard key={item.id} item={item} />)
                                    ) : (
                                        <p className="text-sm text-tertiary">Nenhum agendamento encontrado.</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                <div className="px-6 py-5">
                                    {historyOrders.length > 0 ? (
                                        <TableCard.Root>
                                            <Table aria-label="Histórico de serviços" selectionMode="none">
                                                <Table.Header>
                                                    <Table.Head id="code" label="Código" className="min-w-[140px]" isRowHeader />
                                                    <Table.Head id="type" label="Tipo" className="min-w-[160px]" />
                                                    <Table.Head id="status" label="Status" className="min-w-[140px]" />
                                                    <Table.Head id="date" label="Data" className="min-w-[140px]" />
                                                </Table.Header>
                                                <Table.Body items={historyOrders}>
                                                    {(item) => (
                                                        <Table.Row id={item.id}>
                                                            <Table.Cell className="whitespace-nowrap">{item.code || "—"}</Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap">{item.type || "—"}</Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap">{item.status || "—"}</Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap">{formatOrderDate(item.eventDate)}</Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table>
                                        </TableCard.Root>
                                    ) : (
                                        <p className="text-sm text-tertiary">Nenhum serviço encontrado.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
