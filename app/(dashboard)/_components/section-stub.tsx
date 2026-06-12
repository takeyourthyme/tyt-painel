"use client";

import type { FC } from "react";
import { SearchLg } from "@untitledui/icons";
import { Playfair_Display } from "next/font/google";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { cx } from "@/utils/cx";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export type SectionStubProps = {
    /** Título principal (equivalente ao “Section header” no Figma). */
    title: string;
    /** Texto de apoio abaixo do título (ex.: “Visualize, filtre e gerencie…”). */
    description?: string;
    /** Título do estado vazio. */
    emptyTitle?: string;
    /** Descrição do estado vazio. */
    emptyDescription?: string;
    /** Ícone do featured icon (padrão: busca, como no empty state do Figma). */
    emptyIcon?: FC<{ className?: string }>;
};

const defaultDescription = "Área em desenvolvimento. Em breve você poderá gerenciar os dados por aqui";
const defaultEmptyTitle = "Conteúdo em construção";
const defaultEmptyDescription = "Estamos preparando esta experiência para você";

/**
 * Layout de página placeholder alinhado ao frame “Todos os Chefs” / Section header + empty state
 * (Figma node 607:28939 — Section header `1002:56992`, empty state `1023:10031`).
 */
export function SectionStub({
    title,
    description = defaultDescription,
    emptyTitle = defaultEmptyTitle,
    emptyDescription = defaultEmptyDescription,
    emptyIcon = SearchLg,
}: SectionStubProps) {
    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div>
                        <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>{title}</h1>
                        {description ? <p className="mt-1.5 text-sm text-tertiary">{description}</p> : null}
                    </div>
                    <div className="h-px w-full bg-border-secondary" aria-hidden />
                </header>

                <div className={cx("overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs", "min-h-[min(440px,70vh)]")}>
                    <div className="flex min-h-[min(440px,70vh)] items-center justify-center px-6 py-10 md:px-8 md:py-12">
                        <EmptyState size="sm" className="max-w-[352px]">
                            <EmptyState.Header pattern="circle">
                                <EmptyState.FeaturedIcon color="gray" theme="modern" icon={emptyIcon} />
                            </EmptyState.Header>
                            <EmptyState.Content>
                                <h2 className="text-center text-md font-semibold text-primary">{emptyTitle}</h2>
                                <EmptyState.Description>{emptyDescription}</EmptyState.Description>
                            </EmptyState.Content>
                        </EmptyState>
                    </div>
                </div>
            </div>
        </main>
    );
}
