"use client";

import type { FC } from "react";
import { useEffect, useState } from "react";
import { BankNote01, BarChartSquare02, Calendar, ChevronDown, LogOut04, Rows01, Settings01, UserSquare, Users01 } from "@untitledui/icons";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearTytSession } from "@/lib/tyt-api/session";
import { cx } from "@/utils/cx";

const logoSrc = "/assets/Logo-TYT-Preta.svg";

type NavChild = { label: string; href: string };

type NavSection =
    | {
        id: string;
        label: string;
        href: string;
        icon: FC<{ className?: string }>;
        children: NavChild[];
    }
    | {
        id: string;
        label: string;
        href: string;
        icon: FC<{ className?: string }>;
        children?: undefined;
    };

/**
 * Nomenclaturas conforme SiteMap no Figma (node 1158:7969).
 * Ramos de Chefs e Agenda aparecem no diagrama sem rótulos — ficam como itens simples.
 */
const navigation: NavSection[] = [
    {
        id: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: BarChartSquare02,
    },
    {
        id: "chefs",
        label: "Chefs",
        href: "/chefs",
        icon: UserSquare,
    },
    {
        id: "agenda",
        label: "Agenda",
        href: "/agenda",
        icon: Calendar,
        children: [
            { label: "Serviços agendados", href: "/agenda/servicos-agendados" },
            { label: "Solicitações", href: "/agenda/solicitacoes" },
        ],
    },
    {
        id: "cardapio",
        label: "Cardápio",
        href: "/cardapio",
        icon: Rows01,
        children: [
            { label: "Pratos", href: "/cardapio/pratos" },
            { label: "Ingredientes", href: "/cardapio/ingredientes" },
            { label: "Classificações", href: "/cardapio/classificacoes" },
        ],
    },
    { id: "clientes", label: "Clientes", href: "/clientes", icon: Users01 },
    { id: "configuracao", label: "Configuração", href: "/configuracao", icon: Settings01 },
    { id: "financeiro", label: "Financeiro", href: "/financeiro", icon: BankNote01 },
];

function sectionActive(pathname: string, section: NavSection): boolean {
    if (!("children" in section) || !section.children?.length) {
        return pathname === section.href;
    }
    if (pathname === section.href) return true;
    if (pathname.startsWith(`${section.href}/`)) return true;
    return section.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
}

function childActive(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function computeOpenFromPath(pathname: string): Record<string, boolean> {
    const o: Record<string, boolean> = {};
    for (const section of navigation) {
        if ("children" in section && section.children?.length) {
            o[section.id] = sectionActive(pathname, section);
        }
    }
    return o;
}

export function TytSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setOpen(computeOpenFromPath(pathname));
    }, [pathname]);

    const handleLogout = () => {
        clearTytSession();
        router.push("/login");
        router.refresh();
    };

    const toggle = (id: string) => {
        setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <aside className="flex h-full w-full max-w-full flex-col justify-between overflow-y-auto border-secondary bg-primary pt-6 md:border-r lg:w-[296px] lg:pt-6">
            <div className="flex flex-col gap-4">
                <div className="px-5">
                    <Link href="/dashboard" className="relative block h-16 w-[139px]">
                        <Image src={logoSrc} alt="Take Your Thyme" fill className="object-contain object-left" sizes="139px" />
                    </Link>
                </div>
                <nav aria-label="Principal" className="px-4">
                    <ul className="flex flex-col gap-0.5">
                        {navigation.map((section) => {
                            const Icon = section.icon;
                            const hasChildren = "children" in section && section.children && section.children.length > 0;
                            const isGroupActive = sectionActive(pathname, section);
                            const expanded = hasChildren ? (open[section.id] ?? false) : false;

                            if (!hasChildren) {
                                const active = pathname === section.href;
                                return (
                                    <li key={section.id}>
                                        <Link
                                            href={section.href}
                                            className={cx(
                                                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-md font-semibold outline-focus-ring transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                                                active ? "bg-[#1c398e] text-[#dbeafe]" : "text-secondary hover:bg-primary_hover",
                                            )}
                                        >
                                            <Icon aria-hidden className={cx("size-5 shrink-0", active ? "text-[#dbeafe]" : "text-fg-quaternary")} />
                                            <span className="min-w-0 flex-1 truncate">{section.label}</span>
                                        </Link>
                                    </li>
                                );
                            }

                            return (
                                <li key={section.id} className="flex flex-col">
                                    <div className={cx("flex w-full items-stretch gap-0.5 rounded-md", isGroupActive && "bg-primary_hover/60")}>
                                        <Link
                                            href={section.href}
                                            className={cx(
                                                "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-md font-semibold outline-focus-ring transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                                                isGroupActive ? "text-primary" : "text-secondary hover:bg-primary_hover",
                                            )}
                                        >
                                            <Icon aria-hidden className={cx("size-5 shrink-0", isGroupActive ? "text-[#1c398e]" : "text-fg-quaternary")} />
                                            <span className="min-w-0 flex-1 truncate">{section.label}</span>
                                        </Link>
                                        <button
                                            type="button"
                                            aria-expanded={expanded}
                                            aria-controls={`subnav-${section.id}`}
                                            onClick={() => toggle(section.id)}
                                            className={cx(
                                                "flex shrink-0 items-center justify-center rounded-md px-2 py-2 outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2",
                                                isGroupActive ? "text-[#1c398e]" : "text-fg-quaternary",
                                            )}
                                        >
                                            <ChevronDown aria-hidden className={cx("size-4 stroke-[2.5px] transition-transform", expanded && "rotate-180")} />
                                        </button>
                                    </div>
                                    {expanded ? (
                                        <ul id={`subnav-${section.id}`} className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l-2 border-secondary py-1 pl-2">
                                            {section.children!.map((child) => {
                                                const subActive = childActive(pathname, child.href);
                                                return (
                                                    <li key={child.href}>
                                                        <Link
                                                            href={child.href}
                                                            className={cx(
                                                                "block rounded-md py-2 pr-2 pl-3 text-sm font-semibold outline-focus-ring transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                                                                subActive
                                                                    ? "-ml-0.5 border-l-2 border-[#1c398e] bg-[#1c398e]/10 pl-2.5 text-[#1c398e]"
                                                                    : "text-secondary hover:bg-primary_hover",
                                                            )}
                                                        >
                                                            {child.label}
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>
            <div className="px-4 pb-6">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-md font-semibold text-secondary outline-focus-ring transition-colors hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <LogOut04 aria-hidden className="size-5 shrink-0 text-fg-quaternary" />
                    <span className="flex-1 truncate">Sair</span>
                    <ChevronDown aria-hidden className="size-4 shrink-0 -rotate-90 stroke-[2.5px] text-fg-quaternary" />
                </button>
            </div>
        </aside>
    );
}
