"use client";

import { type ReactNode, useState, useMemo } from "react";
import { useExportData } from "@/hooks/use-export-data";
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    CheckCircle,
    ChevronDown,
    CreditCard02,
    Download02,
    Eye,
    FilterLines,
    MarkerPin01,
    SearchLg,
    Share04,
    Star01,
    UserSquare,
    X as CloseIcon,
    XCircle,
    User01,
} from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import type { Key } from "react-aria-components";
import { toast } from "sonner";
import { Calendar } from "@/components/application/date-picker/calendar";
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
import { Toggle } from "@/components/base/toggle/toggle";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { cx } from "@/utils/cx";
import { formatAvailabilityDayLabel, formatServiceChipLabel, useChefApprovalActions, useChefDetails } from "./chef-details-data";
import { CalendarCheck, ChefHat } from "lucide-react";
import { AgendaFilterPopover, emptyAgendaFilter, type AgendaFilterState, type AgendaFilterOption } from "@/app/(dashboard)/agenda/agenda-filter-popover";

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
    code: string;
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
    code: string;
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
        analise: "Análise de perfil",
        entrevista: "Entrevista",
        documentacao: "Documentação",
        ativo: "Ativo",
        inativo: "Inativo",
    };
    return map[status];
}

function getChefStatusBadgeColor(status: ChefStatus): "success" | "gray" | "pink" | "purple" | "blue" | "gray-blue" {
    if (status === "ativo") return "success";
    if (status === "inativo") return "gray";
    if (status === "cadastro") return "pink";
    if (status === "analise") return "purple";
    if (status === "entrevista") return "blue";
    return "gray-blue";
}

function MobileDisclosure({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <details className="group overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary ring-1 ring-secondary ring-inset">
                        <ChefHat className="size-5 text-tertiary" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">{title}</p>
                        <p className="mt-0.5 text-sm text-tertiary">{description}</p>
                    </div>
                </div>
                <ChevronDown className="size-5 shrink-0 text-fg-quaternary transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-secondary px-4 py-4">{children}</div>
        </details>
    );
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

function formatInstagramUsername(username?: string | null): string {
    if (!username || !username.trim()) return "—";
    const clean = username.trim();
    return clean.startsWith("@") ? clean : `@${clean}`;
}

function formatInstagramLink(username?: string | null): string | undefined {
    if (!username || !username.trim()) return undefined;
    const clean = username.trim();
    const user = clean.startsWith("@") ? clean.slice(1) : clean;
    return user ? `https://instagram.com/${user}` : undefined;
}

function formatWhatsAppLink(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits}`;
}

function formatMailto(email: string): string | null {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || normalizedEmail === "—") return null;

    return `mailto:${normalizedEmail}`;
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

function SectionHeader({
    title,
    description,
    icon: Icon = UserSquare,
    color = "brand",
    theme = "light",
}: {
    title: string;
    description: string;
    icon?: any;
    color?: "brand" | "gray" | "success" | "warning" | "error";
    theme?: "light" | "gradient" | "dark" | "outline" | "modern" | "modern-neue";
}) {
    return (
        <div className="flex items-start gap-3">
            <FeaturedIcon color={color} icon={Icon} theme={theme} size="md" />
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
        <div className="flex items-center justify-between gap-4 rounded-xl border border-secondary bg-primary p-5 shadow-xs">
            <div className="flex min-w-0 items-start gap-3">
                <FeaturedIcon size="sm" theme="light" color="gray" icon={CalendarIcon} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold text-primary">{item.serviceLabel}</p>
                        {scheduleStatusBadge(item.status)}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-tertiary">
                        <div className="flex items-center gap-1.5">
                            <CalendarIcon className="size-4 text-quaternary" aria-hidden />
                            <span className="whitespace-nowrap">
                                {item.dateLabel} às {item.timeLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MarkerPin01 className="size-4 text-quaternary" aria-hidden />
                            <span className="truncate">{item.locationLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <User01 className="size-4 text-quaternary" aria-hidden />
                            <span className="whitespace-nowrap">{item.clientName}</span>
                        </div>
                    </div>
                </div>
            </div>

            <ButtonUtility
                icon={Eye}
                color="secondary"
                size="sm"
                aria-label="Ver"
                href={`/agenda/servicos-agendados/${encodeURIComponent(item.code)}`}
            />
        </div>
    );
}


export function ChefDetailsView({ id }: { id: string }) {
    const { exportToCsv } = useExportData<HistoryRow>();
    const { chef, orders, loading, error, reload, canManage } = useChefDetails(id);
    const approval = useChefApprovalActions();
    const [selectedTab, setSelectedTab] = useState<Key>("chef_data");
    const [historyPage] = useState(1);
    const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
    const [scheduleQuery, setScheduleQuery] = useState("");
    const [historyQuery, setHistoryQuery] = useState("");
    const [appliedScheduleFilter, setAppliedScheduleFilter] = useState<AgendaFilterState>(() => emptyAgendaFilter());
    const [appliedHistoryFilter, setAppliedHistoryFilter] = useState<AgendaFilterState>(() => emptyAgendaFilter());

    const headerName = chef?.name ?? "Perfil do Profissional";
    const headerEmail = chef?.email ?? "—";
    const headerInitials = chef ? getInitials(chef.name) : "";
    const chefStatus = chef ? (normalizeChefStatus(chef.statusLabel) ?? (chef.approved ? "ativo" : "cadastro")) : null;
    const cadastroAprovado = chef?.approved;
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

    const serviceTypeOptions = useMemo<AgendaFilterOption[]>(() => {
        const types = new Set<string>();
        safeOrders.forEach((o) => {
            if (o.type) types.add(o.type);
        });
        return Array.from(types).map((t) => ({ id: t, label: formatServiceChipLabel(t) }));
    }, [safeOrders]);

    const scheduleStatusOptions = [
        { id: "confirmed", label: "Confirmado" },
        { id: "pending", label: "Pendente" }
    ];

    const historyStatusOptions = [
        { id: "confirmed", label: "Confirmado" },
        { id: "pending", label: "Pendente" },
        { id: "cancelled", label: "Cancelado" }
    ];

    const allFutureOrders = safeOrders
        .filter((o) => {
            const dt = orderEventDateTime(o);
            if (!dt) return false;
            return dt.getTime() >= Date.now() && !orderIsCancelled(o.status);
        })
        .sort((a, b) => (orderEventDateTime(a)?.getTime() ?? 0) - (orderEventDateTime(b)?.getTime() ?? 0));

    const scheduleOrders = allFutureOrders
        .filter((o) => {
            if (appliedScheduleFilter.serviceTypes.length > 0) {
                if (!o.type || !appliedScheduleFilter.serviceTypes.includes(o.type)) return false;
            }
            if (appliedScheduleFilter.statuses.length > 0) {
                const itemStatus = orderIsConfirmed(o.status) ? "confirmed" : "pending";
                if (!appliedScheduleFilter.statuses.includes(itemStatus)) return false;
            }
            return true;
        })
        .filter((o) => {
            const q = scheduleQuery.trim().toLowerCase();
            if (!q) return true;
            const hay = `${o.code ?? ""} ${o.type ?? ""} ${o.city ?? ""} ${o.clientName ?? ""}`.toLowerCase();
            return hay.includes(q);
        });

    const historyOrders = safeOrders
        .filter((o) => {
            const dt = orderEventDateTime(o);
            if (!dt) return false;
            return dt.getTime() < Date.now() || orderIsCancelled(o.status);
        })
        .filter((o) => {
            if (appliedHistoryFilter.serviceTypes.length > 0) {
                if (!o.type || !appliedHistoryFilter.serviceTypes.includes(o.type)) return false;
            }
            if (appliedHistoryFilter.statuses.length > 0) {
                const itemStatus = orderIsCancelled(o.status) ? "cancelled" : orderIsConfirmed(o.status) ? "confirmed" : "pending";
                if (!appliedHistoryFilter.statuses.includes(itemStatus)) return false;
            }
            return true;
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
            code: o.code ?? "",
            serviceLabel: formatServiceChipLabel(o.type ?? "—"),
            status: orderIsConfirmed(o.status) ? "confirmed" : "pending",
            dateLabel: dt ? dt.toLocaleDateString("pt-BR") : "—",
            timeLabel: formatTimeLabel(o.eventTime),
            locationLabel: formatLocationLabel(o),
            clientName: o.clientName ?? "—",
        };
    });

    const dailyScheduleItems: ScheduleItem[] = allFutureOrders.map((o) => {
        const dt = orderEventDateTime(o);
        return {
            id: o.id,
            code: o.code ?? "",
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
            code: o.code ?? "",
            serviceLabel: formatServiceChipLabel(o.type ?? "—"),
            valueLabel: formatCurrency(o.totalValue),
            status: orderIsCancelled(o.status) ? "cancelled" : orderIsConfirmed(o.status) ? "confirmed" : "pending",
            dateLabel: dt ? dt.toLocaleDateString("pt-BR") : "—",
            locationLabel: formatLocationLabel(o),
            clientName: o.clientName ?? "—",
        };
    });

    const chefDataPanelContent = (
        <>
            {!chef && loading ? (
                <div className="rounded-xl bg-primary p-6 shadow-xs ring-1 ring-secondary ring-inset">
                    <LoadingIndicator type="line-spinner" size="md" label="Carregando dados..." />
                </div>
            ) : null}

            {chef ? (
                <>
                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                        <div className="border-b border-secondary px-6 py-5">
                            <SectionHeader title="Sobre o Chef" description="Perfil profissional e especialidades" icon={ChefHat} color="gray" />
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
                            <SectionHeader title="Dados básicos" description="Informações de identificação e contato" icon={User01} color="gray" />
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
                            <SectionHeader title="Localização" description="Endereço e raio de atuação" icon={MarkerPin01} color="gray" />
                        </div>
                        <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
                            <DataRow label="CEP" value={chef.cep || "—"} />
                            <DataRow label="Endereço" value={addressLine(chef)} />
                            <DataRow label="Bairro" value={chef.district || "—"} />
                            <DataRow label="Número" value={chef.number || "—"} />
                            <DataRow label="Complemento" value={chef.complement || "—"} />
                            <DataRow label="Cidade/UF" value={cityStateLine(chef)} />
                            <DataRow label="Disponibilidade para viagens" value={formatBooleanLabel(chef.canTravel)} />
                            <DataRow label="Tipo de transporte" value={chef.transportType || "—"} />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                        <div className="border-b border-secondary px-6 py-5">
                            <SectionHeader title="Disponibilidade" description="Turnos disponíveis para agendamento de serviços" icon={CalendarCheck} color="gray" />
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
                                                    <div className="flex justify-start pl-2">
                                                        {item.morning ? (
                                                            <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                        ) : (
                                                            <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                        )}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <div className="flex justify-start pl-2">
                                                        {item.afternoon ? (
                                                            <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                        ) : (
                                                            <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                        )}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <div className="flex justify-start pl-2">
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
        </>
    );

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8" aria-busy={loading}>
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-4 md:hidden">
                    <Link
                        href="/chefs"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-tertiary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <ArrowLeft className="size-5 shrink-0" aria-hidden />
                        Voltar
                    </Link>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>
                                    {showReviewActions ? "Revisão de Cadastro" : "Perfil do Profissional"}
                                </h1>
                                <p className="mt-1 text-sm text-tertiary">
                                    {showReviewActions
                                        ? "Revise as informações profissionais, dados de contato e disponibilidade antes de aprovar o acesso à plataforma"
                                        : "Visualize o perfil completo e acompanhe a disponibilidade e os serviços realizados pelo profissional na plataforma"}
                                </p>
                            </div>
                            {loading ? <LoadingIndicator type="line-spinner" size="sm" label="Carregando..." /> : null}
                        </div>

                        {showReviewActions ? (
                            <div className="flex flex-col gap-3 pt-2">
                                <Button
                                    color="secondary"
                                    size="md"
                                    className="w-full"
                                    iconLeading={CloseIcon}
                                    isDisabled={approval.loading || loading}
                                    onClick={() => setConfirmAction("reject")}
                                >
                                    Recusar Cadastro
                                </Button>
                                <Button
                                    color="primary"
                                    size="md"
                                    className="w-full"
                                    iconLeading={CheckCircle}
                                    isDisabled={approval.loading || loading}
                                    onClick={() => setConfirmAction("approve")}
                                >
                                    Aprovar cadastro
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                <header className="hidden flex-col gap-3 md:flex">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-4 text-sm text-tertiary">
                        <Link href="/chefs" className="font-medium hover:text-tertiary_hover">
                            Personal Chefs
                        </Link>
                        <span className="text-quaternary">›</span>
                        <Link href="/chefs" className="font-medium hover:text-tertiary_hover">
                            {cadastroAprovado ? "Todos os Chefs" : "Novos cadastros"}
                        </Link>
                        <span className="text-quaternary">›</span>
                        <span className="font-medium text-secondary">{chef ? chef.name.split(" ")[0] : "Detalhes"}</span>
                    </nav>

                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>Perfil do Profissional</h1>
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
                                <p className="text-sm font-semibold text-primary">Não foi possível carregar os dados do chef</p>
                                <p className="mt-1 text-sm text-tertiary">{error}</p>
                            </div>
                            <Button color="secondary" size="md" onClick={() => void reload()} isLoading={loading}>
                                Tentar novamente
                            </Button>
                        </div>
                    </section>
                ) : null}

                {chef ? (
                    <section className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs md:hidden">
                        <div className="flex flex-col gap-4 p-4">
                            {chefStatus ? (
                                <Badge size="sm" type="pill-color" color={getChefStatusBadgeColor(chefStatus)}>
                                    {formatChefStatusLabel(chefStatus)}
                                </Badge>
                            ) : null}

                            <div className="flex items-center gap-3">
                                <Avatar src={chef.avatarUrl ?? null} initials={headerInitials} size="lg" alt={headerName} />
                                <div className="min-w-0">
                                    <p className="truncate text-lg font-semibold text-primary">{headerName}</p>
                                    <p className="mt-0.5 truncate text-sm text-tertiary">{headerEmail}</p>
                                </div>
                            </div>

                            {chefStatus && !isFinalStatus && canManage && chef.chefUserId ? (
                                <div className="pt-1">
                                    <p className="text-sm font-medium text-secondary">Etapa *</p>
                                    <div className="mt-2">
                                        <Select
                                            aria-label="Etapa do cadastro"
                                            size="md"
                                            selectedKey={chefStatus}
                                            isDisabled={approval.loading || loading}
                                            onSelectionChange={async (key) => {
                                                const next = String(key) as ChefStatus;
                                                if (!chef.chefUserId) return;
                                                if (isFinalChefStatus(next)) return;
                                                const result = await approval.update({ chefUserId: chef.chefUserId, approved: false, status: next });
                                                if (result.ok) await reload();
                                            }}
                                            items={[
                                                { id: "cadastro", label: "Cadastro" },
                                                { id: "analise", label: "Análise de perfil" },
                                                { id: "entrevista", label: "Entrevista" },
                                                { id: "documentacao", label: "Documentação" },
                                            ]}
                                        >
                                            {(item) => <Select.Item {...item} />}
                                        </Select>
                                    </div>
                                </div>
                            ) : showToggle && chefStatus ? (
                                <div className="flex items-start justify-between gap-4 rounded-xl bg-utility-blue-light-50 p-4 ring-1 ring-utility-blue-light-200 ring-inset">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-primary">{chefStatus === "ativo" ? "Chef Ativo" : "Chef Inativo"}</p>
                                        <p className="mt-1 text-sm text-tertiary">
                                            {chefStatus === "ativo"
                                                ? "Conta habilitada para acesso e participação em novos trabalhos"
                                                : "Conta desativada para acesso e participação em novos trabalhos"}
                                        </p>
                                    </div>
                                    <Toggle
                                        slim
                                        size="sm"
                                        isSelected={chefStatus === "ativo"}
                                        isDisabled={approval.loading || loading}
                                        onChange={async (isSelected) => {
                                            if (!chef.chefUserId) return;
                                            const result = await approval.update({
                                                chefUserId: chef.chefUserId,
                                                approved: isSelected,
                                                status: isSelected ? "ativo" : "inativo",
                                            });
                                            if (result.ok) await reload();
                                        }}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </section>
                ) : null}

                <section className={cx("hidden rounded-xl p-4 shadow-xs ring-1 ring-gray-200 md:block", cadastroAprovado ? "bg-brand-secondary" : "bg-gray-100")}>
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
                                    <span className="text-quaternary">Membro há {chef?.memberSinceLabel ?? "—"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-xl bg-primary px-4 py-3 ring-1 ring-secondary ring-inset md:min-w-[360px]">
                            {chefStatus && !isFinalStatus && canManage && chef?.chefUserId ? (
                                <div className="flex w-full items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-primary">Etapa</p>
                                        <p className="mt-0.5 text-xs text-tertiary">Atualize a etapa do cadastro do profissional</p>
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
                                                { id: "analise", label: "Análise de perfil" },
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
                                                    ? "Conta habilitada para acesso e participação em novos trabalhos"
                                                    : "Não habilitada para acesso e participação em novos trabalhos"}
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
                                        <p className="mt-0.5 text-xs text-tertiary">Carregando status do profissional</p>
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
                                                    pode ser desfeita
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
                                                        ? "O profissional agora tem acesso total à plataforma e já pode receber solicitações"
                                                        : "O profissional não terá acesso à plataforma e não poderá receber solicitações",
                                                });
                                                await reload();
                                            } else {
                                                toast.error(isApprove ? "Não foi possível aprovar o chef" : "Não foi possível reprovar o chef", {
                                                    description: result.error ?? "Ocorreu um erro. Tente novamente",
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
                    <div className="flex flex-col gap-4 md:hidden">
                        {!chef && loading ? (
                            <div className="rounded-xl bg-primary p-6 shadow-xs ring-1 ring-secondary ring-inset">
                                <LoadingIndicator type="line-spinner" size="md" label="Carregando dados..." />
                            </div>
                        ) : null}

                        {chef ? (
                            <>
                                {isFinalStatus && cadastroAprovado ? (
                                    <>
                                        <Select
                                            aria-label="Seção"
                                            size="md"
                                            selectedKey={selectedTab}
                                            onSelectionChange={(key) => {
                                                if (key !== null) setSelectedTab(key);
                                            }}
                                            items={[
                                                { id: "chef_data", label: "Dados do Chef" },
                                                { id: "schedule", label: "Agenda" },
                                                { id: "history", label: "Histórico de serviços" },
                                            ]}
                                        >
                                            {(item) => <Select.Item {...item} />}
                                        </Select>

                                        {selectedTab === "chef_data" ? (
                                            <>
                                                <MobileDisclosure title="Sobre o Chef" description="Perfil profissional e especialidade">
                                                    <div className="flex flex-col gap-5">
                                                        <div>
                                                            <p className="text-sm font-medium text-secondary">Apresentação</p>
                                                            <p className="mt-1 text-sm text-tertiary">{chef.about || "—"}</p>
                                                        </div>

                                                        <div className="grid gap-4 sm:grid-cols-2">
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
                                                </MobileDisclosure>

                                                <MobileDisclosure title="Dados básicos" description="Informações de identificação e contato">
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <DataRow label="CPF" value={chef.cpf} />
                                                        <DataRow label="E-mail" value={chef.email} href={formatMailto(chef.email)} />
                                                        <DataRow label="Data de nascimento" value={chef.birthDate} />
                                                        <DataRow label="WhatsApp" value={chef.whatsapp} href={formatWhatsAppLink(chef.whatsapp)} />
                                                    </div>
                                                </MobileDisclosure>

                                                <MobileDisclosure title="Localização" description="Endereço e raio de atuação">
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <DataRow label="CEP" value={chef.cep || "—"} />
                                                        <DataRow label="Endereço" value={addressLine(chef)} />
                                                        <DataRow label="Bairro" value={chef.district || "—"} />
                                                        <DataRow label="Número" value={chef.number || "—"} />
                                                        <DataRow label="Complemento" value={chef.complement || "—"} />
                                                        <DataRow label="Cidade/UF" value={cityStateLine(chef)} />
                                                        <DataRow label="Disponibilidade para viagens" value={formatBooleanLabel(chef.canTravel)} />
                                                        <DataRow label="Tipo de transporte" value={chef.transportType || "—"} />
                                                    </div>
                                                </MobileDisclosure>

                                                <MobileDisclosure title="Disponibilidade" description="Turnos disponíveis para agendamento de serviços">
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
                                                                            <div className="flex justify-start">
                                                                                {item.morning ? (
                                                                                    <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                                                ) : (
                                                                                    <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                                                )}
                                                                            </div>
                                                                        </Table.Cell>
                                                                        <Table.Cell>
                                                                            <div className="flex justify-start">
                                                                                {item.afternoon ? (
                                                                                    <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                                                ) : (
                                                                                    <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                                                )}
                                                                            </div>
                                                                        </Table.Cell>
                                                                        <Table.Cell>
                                                                            <div className="flex justify-start">
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
                                                </MobileDisclosure>
                                            </>
                                        ) : selectedTab === "schedule" ? (
                                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                                <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4">
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
                                                <div className="flex flex-col gap-3 px-4 py-4">
                                                    {scheduleItems.length > 0 ? (
                                                        scheduleItems.map((item) => <ScheduleCard key={item.id} item={item} />)
                                                    ) : (
                                                        <p className="text-sm text-tertiary">Nenhum agendamento encontrado</p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                                                <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4">
                                                    <p className="text-sm font-semibold text-primary">Registro de Atendimentos</p>
                                                    <Input
                                                        aria-label="Buscar por"
                                                        placeholder="Buscar por"
                                                        icon={SearchLg}
                                                        size="sm"
                                                        value={historyQuery}
                                                        onChange={setHistoryQuery}
                                                    />
                                                </div>
                                                <div className="px-4 py-4">
                                                    {historyRows.length > 0 ? (
                                                        <TableCard.Root>
                                                            <Table aria-label="Registro de Atendimentos" selectionMode="none">
                                                                <Table.Header>
                                                                    <Table.Head id="service" label="Serviço" className="min-w-[160px]" isRowHeader />
                                                                    <Table.Head id="value" label="Valor" className="min-w-[120px]" />
                                                                    <Table.Head id="status" label="Status" className="min-w-[140px]" />
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
                                                                        </Table.Row>
                                                                    )}
                                                                </Table.Body>
                                                            </Table>
                                                        </TableCard.Root>
                                                    ) : (
                                                        <p className="text-sm text-tertiary">Nenhum serviço encontrado</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <MobileDisclosure title="Sobre o Chef" description="Perfil profissional e especialidade">
                                            <div className="flex flex-col gap-5">
                                                <div>
                                                    <p className="text-sm font-medium text-secondary">Apresentação</p>
                                                    <p className="mt-1 text-sm text-tertiary">{chef.about || "—"}</p>
                                                </div>

                                                <div className="grid gap-4 sm:grid-cols-2">
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
                                        </MobileDisclosure>

                                        <MobileDisclosure title="Dados básicos" description="Informações de identificação e contato">
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <DataRow label="CPF" value={chef.cpf} />
                                                <DataRow label="E-mail" value={chef.email} href={formatMailto(chef.email)} />
                                                <DataRow label="Data de nascimento" value={chef.birthDate} />
                                                <DataRow label="WhatsApp" value={chef.whatsapp} href={formatWhatsAppLink(chef.whatsapp)} />
                                            </div>
                                        </MobileDisclosure>

                                        <MobileDisclosure title="Localização" description="Endereço e raio de atuação">
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <DataRow label="CEP" value={chef.cep || "—"} />
                                                <DataRow label="Endereço" value={addressLine(chef)} />
                                                <DataRow label="Bairro" value={chef.district || "—"} />
                                                <DataRow label="Número" value={chef.number || "—"} />
                                                <DataRow label="Complemento" value={chef.complement || "—"} />
                                                <DataRow label="Cidade/UF" value={cityStateLine(chef)} />
                                                <DataRow label="Disponibilidade para viagens" value={formatBooleanLabel(chef.canTravel)} />
                                                <DataRow label="Tipo de transporte" value={chef.transportType || "—"} />
                                            </div>
                                        </MobileDisclosure>

                                        <MobileDisclosure title="Disponibilidade" description="Turnos disponíveis para agendamento de serviços">
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
                                                                    <div className="flex justify-start">
                                                                        {item.morning ? (
                                                                            <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                                        ) : (
                                                                            <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                                        )}
                                                                    </div>
                                                                </Table.Cell>
                                                                <Table.Cell>
                                                                    <div className="flex justify-start">
                                                                        {item.afternoon ? (
                                                                            <CheckCircle className="size-5 text-utility-blue-600" aria-hidden />
                                                                        ) : (
                                                                            <XCircle className="size-5 text-utility-gray-300" aria-hidden />
                                                                        )}
                                                                    </div>
                                                                </Table.Cell>
                                                                <Table.Cell>
                                                                    <div className="flex justify-start">
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
                                        </MobileDisclosure>
                                    </>
                                )}
                            </>
                        ) : null}
                    </div>

                    {!cadastroAprovado ? (
                        <div className="hidden w-full flex-col gap-6 md:flex">
                            {chefDataPanelContent}
                        </div>
                    ) : (
                        <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} className="hidden w-full flex-col gap-6 md:flex">
                            <Tabs.List type="underline" size="md" items={tabItems} className="w-full">
                                {(tab) => <Tabs.Item {...tab} id={tab.id} />}
                            </Tabs.List>

                            <Tabs.Panel id="chef_data" className="flex flex-col gap-6 outline-hidden">
                                {chefDataPanelContent}
                            </Tabs.Panel>

                            <Tabs.Panel id="schedule" className="outline-hidden">
                                <div className="flex flex-col gap-6">
                                    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                                        <div className="overflow-hidden rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                            <Calendar todayLabel="Hoje" weekdayLetterLen={1} />
                                        </div>

                                        <TableCard.Root>
                                            <TableCard.Header title="Programação Diária" />
                                            <div className="flex flex-col gap-3 px-6 py-5">
                                                {dailyScheduleItems.length > 0 ? (
                                                    dailyScheduleItems.slice(0, 2).map((item) => <ScheduleCard key={item.id} item={item} />)
                                                ) : (
                                                    <p className="text-sm text-tertiary">Nenhum agendamento encontrado</p>
                                                )}
                                            </div>
                                        </TableCard.Root>
                                    </div>

                                    <TableCard.Root className="border-none bg-secondary ring-transparent shadow-none">
                                        <TableCard.Header
                                            title="Próximos Agendamentos"
                                            className="border-none bg-secondary"
                                            contentTrailing={
                                                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                                                    <Input
                                                        aria-label="Pesquisar..."
                                                        placeholder="Pesquisar..."
                                                        icon={SearchLg}
                                                        size="sm"
                                                        value={scheduleQuery}
                                                        onChange={setScheduleQuery}
                                                        className="w-full md:w-[320px]"
                                                    />
                                                    <AgendaFilterPopover
                                                        applied={appliedScheduleFilter}
                                                        onApply={setAppliedScheduleFilter}
                                                        serviceTypeOptions={serviceTypeOptions}
                                                        statusOptions={scheduleStatusOptions}
                                                    />
                                                </div>
                                            }
                                        />
                                        <div className="flex flex-col gap-3 px-6 py-5">
                                            {scheduleItems.length > 0 ? (
                                                scheduleItems.map((item) => <ScheduleCard key={item.id} item={item} />)
                                            ) : (
                                                <p className="text-sm text-tertiary">Nenhum agendamento encontrado</p>
                                            )}
                                        </div>
                                    </TableCard.Root>
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel id="history" className="outline-hidden flex flex-col gap-6">
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-lg font-semibold text-primary">Registro de Atendimentos</h2>
                                </div>

                                <TableCard.Root>
                                    <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                                        <Input
                                            aria-label="Pesquisar..."
                                            placeholder="Pesquisar..."
                                            icon={SearchLg}
                                            size="sm"
                                            value={historyQuery}
                                            onChange={setHistoryQuery}
                                            className="w-full md:max-w-md"
                                        />
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Button
                                                size="md"
                                                color="secondary"
                                                iconLeading={Download02}
                                                className="w-full sm:w-auto"
                                                onClick={() => {
                                                    exportToCsv(
                                                        historyRows,
                                                        [
                                                            { header: "Serviço", key: "serviceLabel" },
                                                            { header: "Valor", key: "valueLabel" },
                                                            {
                                                                header: "Status",
                                                                key: (item) => {
                                                                    if (item.status === "confirmed") return "Confirmado";
                                                                    if (item.status === "cancelled") return "Cancelado";
                                                                    return "Pendente";
                                                                }
                                                            },
                                                            { header: "Data", key: "dateLabel" },
                                                            { header: "Localização", key: "locationLabel" },
                                                            { header: "Cliente", key: "clientName" },
                                                        ],
                                                        `historico-atendimentos-${(chef?.name ?? "chef").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")}.csv`
                                                    );
                                                    toast.success("Histórico de atendimentos exportado com sucesso!");
                                                }}
                                            >
                                                Exportar dados
                                            </Button>
                                            <AgendaFilterPopover
                                                applied={appliedHistoryFilter}
                                                onApply={setAppliedHistoryFilter}
                                                serviceTypeOptions={serviceTypeOptions}
                                                statusOptions={historyStatusOptions}
                                            />
                                        </div>
                                    </div>
                                    {historyRows.length > 0 ? (
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
                                                                <ButtonUtility
                                                                    icon={Eye}
                                                                    color="secondary"
                                                                    size="sm"
                                                                    aria-label="Ver"
                                                                    href={`/agenda/servicos-agendados/${encodeURIComponent(row.code)}`}
                                                                />
                                                            </div>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table>
                                    ) : (
                                        <div className="px-6 py-5">
                                            <p className="text-sm text-tertiary">Nenhum serviço encontrado</p>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
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
                                </TableCard.Root>
                            </Tabs.Panel>
                        </Tabs>
                    )}
                </section>
            </div>
        </main>
    );
}
