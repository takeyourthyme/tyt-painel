"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Playfair_Display } from "next/font/google";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { toast } from "sonner";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { getTytAccessToken } from "@/lib/tyt-api/session";
import { TytApiError, parseApiErrorMessage, parseJsonOrThrow } from "@/lib/tyt-api/errors";
import { getPricingTiers, putPricingTiers, type PricingTier } from "@/lib/tyt-api/pricing-tiers";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export default function FinanceiroPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tiers, setTiers] = useState<PricingTier[]>([]);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const hasFetchedRef = useRef(false);

    const loadTiers = useCallback(async (force = false) => {
        if (hasFetchedRef.current && !force) return;
        hasFetchedRef.current = true;
        setLoading(true);
        const token = getTytAccessToken();
        if (!token) {
            toast.error("Sessão não encontrada. Faça login novamente.");
            setLoading(false);
            return;
        }

        try {
            const res = await getPricingTiers(token);
            const data = await parseJsonOrThrow<PricingTier[]>(res);
            if (Array.isArray(data)) {
                setTiers(data);
            }
        } catch (err) {
            console.error(err);
            toast.error("Não foi possível carregar as faixas de preço");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTiers(false);
    }, [loadTiers]);

    const handleValueChange = (id: number, field: keyof PricingTier, value: string) => {
        const numericVal = parseFloat(value) || 0;
        setTiers((prev) =>
            prev.map((t) => {
                if (t.id !== id) return t;
                const updated = { ...t, [field]: numericVal };
                updated.client_price = Math.round((updated.chef_amount + updated.sub_chef_amount + updated.tyt_amount) * 100) / 100;
                return updated;
            })
        );
    };

    const handleSave = async () => {
        const token = getTytAccessToken();
        if (!token) {
            toast.error("Você precisa estar autenticado como administrador");
            return;
        }

        setSaving(true);
        try {
            const res = await putPricingTiers(tiers, token);
            if (!res.ok) {
                throw new TytApiError(res.status, await res.text());
            }
            toast.success("Tabela de precificação salva com sucesso!");
            setIsConfirmModalOpen(false);
            void loadTiers(true);
        } catch (err) {
            if (err instanceof TytApiError) {
                toast.error("Erro ao salvar tabela de precificação", {
                    description: parseApiErrorMessage(err.body),
                });
            } else {
                toast.error("Não foi possível salvar a tabela de precificação");
            }
        } finally {
            setSaving(false);
        }
    };

    const mealPrepTiers = tiers.filter((t) => t.service_type === "MEAL_PREP");
    const getTogetherTiers = tiers.filter((t) => t.service_type === "GET_TOGETHER");

    if (loading) {
        return (
            <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8">
                <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-8">
                    <header className="flex flex-col gap-2">
                        <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>
                            Precificação de Serviços (Financeiro)
                        </h1>
                        <p className="text-sm text-tertiary">
                            Gerencie os valores cobrados dos clientes e a distribuição para Chef, Sub Chef e TYT
                        </p>
                        <div className="mt-2 h-px w-full bg-border-secondary" aria-hidden />
                    </header>
                    <div className="flex items-center justify-center py-20">
                        <LoadingIndicator type="line-spinner" size="md" label="Carregando tabela de preços..." />
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-0 flex-1 bg-secondary_alt px-4 py-6 pb-10 md:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1372px] flex-col gap-8 pb-24">
                <header className="flex flex-col gap-2">
                    <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary")}>
                        Precificação de Serviços (Financeiro)
                    </h1>
                    <p className="text-sm text-tertiary">
                        Gerencie os valores por faixa cobrados dos clientes e o repasse para Chef, Sub Chef e TYT
                    </p>
                    <div className="mt-2 h-px w-full bg-border-secondary" aria-hidden />
                </header>

                <div className="rounded-xl border border-secondary bg-primary shadow-xs overflow-hidden">
                    <div className="border-b border-secondary bg-[#708238]/10 px-6 py-4 dark:bg-[#708238]/20">
                        <h2 className="text-base font-semibold text-primary">Tabela de Preços por Faixa</h2>
                        <p className="text-xs text-tertiary mt-0.5">
                            Valores expressos em Reais (R$). A coluna <strong>Cliente paga</strong> é a soma automática do Chef, Sub Chef e TYT.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-secondary bg-secondary_alt text-xs font-semibold text-secondary uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3.5">Serviço</th>
                                    <th className="px-6 py-3.5">Faixa</th>
                                    <th className="px-6 py-3.5">Cliente paga (R$)</th>
                                    <th className="px-6 py-3.5">Chef recebe (R$)</th>
                                    <th className="px-6 py-3.5">Sub chef (R$)</th>
                                    <th className="px-6 py-3.5">TYT (R$)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary bg-primary">
                                {/* Meal Prep Tiers */}
                                {mealPrepTiers.map((tier) => (
                                    <tr key={tier.id} className="hover:bg-secondary_alt/50 transition duration-75">
                                        <td className="px-6 py-4 font-semibold text-primary">Meal Prep</td>
                                        <td className="px-6 py-4 text-secondary">{tier.label}</td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    disabled
                                                    value={tier.client_price}
                                                    className="w-32 rounded-lg border border-secondary bg-secondary_alt pl-9 pr-3 py-1.5 text-sm font-semibold text-primary cursor-not-allowed"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={tier.chef_amount}
                                                    onChange={(e) => handleValueChange(tier.id, "chef_amount", e.target.value)}
                                                    className="w-32 rounded-lg border border-primary bg-primary pl-9 pr-3 py-1.5 text-sm font-medium text-primary shadow-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={tier.sub_chef_amount}
                                                    onChange={(e) => handleValueChange(tier.id, "sub_chef_amount", e.target.value)}
                                                    className="w-32 rounded-lg border border-primary bg-primary pl-9 pr-3 py-1.5 text-sm font-medium text-primary shadow-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={tier.tyt_amount}
                                                    onChange={(e) => handleValueChange(tier.id, "tyt_amount", e.target.value)}
                                                    className="w-32 rounded-lg border border-primary bg-primary pl-9 pr-3 py-1.5 text-sm font-medium text-primary shadow-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* Get Together Tiers */}
                                {getTogetherTiers.map((tier) => (
                                    <tr key={tier.id} className="hover:bg-secondary_alt/50 transition duration-75">
                                        <td className="px-6 py-4 font-semibold text-primary">Get Together</td>
                                        <td className="px-6 py-4 text-secondary">{tier.label}</td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    disabled
                                                    value={tier.client_price}
                                                    className="w-32 rounded-lg border border-secondary bg-secondary_alt pl-9 pr-3 py-1.5 text-sm font-semibold text-primary cursor-not-allowed"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={tier.chef_amount}
                                                    onChange={(e) => handleValueChange(tier.id, "chef_amount", e.target.value)}
                                                    className="w-32 rounded-lg border border-primary bg-primary pl-9 pr-3 py-1.5 text-sm font-medium text-primary shadow-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={tier.sub_chef_amount}
                                                    onChange={(e) => handleValueChange(tier.id, "sub_chef_amount", e.target.value)}
                                                    className="w-32 rounded-lg border border-primary bg-primary pl-9 pr-3 py-1.5 text-sm font-medium text-primary shadow-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative rounded-lg shadow-xs">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-tertiary">
                                                    R$
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={tier.tyt_amount}
                                                    onChange={(e) => handleValueChange(tier.id, "tyt_amount", e.target.value)}
                                                    className="w-32 rounded-lg border border-primary bg-primary pl-9 pr-3 py-1.5 text-sm font-medium text-primary shadow-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-xl border border-secondary bg-primary p-4 text-xs text-tertiary leading-relaxed">
                    <p className="font-semibold text-secondary mb-1">Regras de negócio:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Para <strong>Get Together</strong>, a quantidade máxima de pessoas aceita na plataforma é <strong>30 pessoas</strong>.</li>
                        <li>Na faixa de <strong>21–30 pessoas</strong>, o valor do Sub Chef é administrado pela TYT e repassado ao Sub Chef responsável via <strong><a href="https://asaas.com/" target="_blank" rel="noopener noreferrer" className="underline">Asaas</a></strong>.</li>
                    </ul>
                </div>
            </div>

            <footer className="fixed bottom-0 right-0 left-0 lg:left-[var(--sidebar-width)] border-t border-secondary bg-primary px-4 py-4 md:px-6 lg:px-8 z-10 flex justify-end">
                <div className="mx-auto flex w-full max-w-[1372px] justify-end">
                    <Button color="primary" size="md" onClick={() => setIsConfirmModalOpen(true)}>
                        Salvar alterações
                    </Button>
                </div>
            </footer>

            {/* Popup de confirmação */}
            <ModalOverlay isOpen={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
                <Modal className="max-w-md bg-primary p-6 rounded-2xl ring-1 ring-secondary shadow-xl">
                    <Dialog className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-semibold text-primary">Confirmar alterações na precificação</h3>
                            <p className="text-sm text-tertiary leading-relaxed">
                                Tem certeza de que deseja salvar a nova tabela de preços? Os novos valores serão aplicados imediatamente a todos os novos pedidos.
                            </p>
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <Button
                                color="secondary"
                                size="md"
                                onClick={() => setIsConfirmModalOpen(false)}
                                disabled={saving}
                            >
                                Cancelar
                            </Button>
                            <Button
                                color="primary"
                                size="md"
                                isLoading={saving}
                                onClick={handleSave}
                            >
                                Confirmar e salvar
                            </Button>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </main>
    );
}
