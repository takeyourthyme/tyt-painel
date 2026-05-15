"use client";

import { I18nProvider } from "@react-aria/i18n";
import { DatePicker, type DatePickerProps } from "@/components/application/date-picker/date-picker";
import { cx } from "@/utils/cx";

const tytDefaults = {
    placeholder: "Selecionar período",
    cancelLabel: "Cancelar",
    applyLabel: "Aplicar",
    todayLabel: "Hoje",
    weekdayLetterLen: 1 as const,
} satisfies Partial<DatePickerProps>;

/**
 * Date picker alinhado ao Figma (Painel TYT): textos em pt-BR, largura do menu 328px,
 * cabeçalhos de dia com uma letra e atalho "Hoje".
 *
 * Reutiliza o {@link DatePicker} do Untitled UI em `components/application/date-picker`.
 */
export function TytDatePicker({ triggerClassName, ...props }: DatePickerProps) {
    return (
        <I18nProvider locale="pt-BR">
            <DatePicker {...tytDefaults} {...props} triggerClassName={cx("font-semibold", triggerClassName)} />
        </I18nProvider>
    );
}
