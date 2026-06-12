"use client";

import { useCallback, useState } from "react";
import { Mail01 } from "@untitledui/icons";
import { useSearchParams } from "next/navigation";
import { AuthBackToLoginLink } from "@/app/(auth)/_components/auth-back-link";
import { AuthFlowHeader } from "@/app/(auth)/_components/auth-flow-header";
import { AuthFlowShell } from "@/app/(auth)/_components/auth-flow-shell";
import { AuthPrimaryButton } from "@/app/(auth)/_components/auth-primary-button";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { postForgotPassword } from "@/lib/tyt-api/auth";
import { parseApiErrorMessage, readResponseBody } from "@/lib/tyt-api/errors";

export function CheckEmailView() {
    const searchParams = useSearchParams();
    const emailParam = searchParams.get("email")?.trim() ?? "";
    const [resent, setResent] = useState(false);
    const [resendError, setResendError] = useState<string | null>(null);
    const [resending, setResending] = useState(false);

    const openMailClient = useCallback(() => {
        if (!emailParam) return;
        window.location.href = `mailto:${emailParam}`;
    }, [emailParam]);

    const handleResend = useCallback(async () => {
        if (!emailParam) return;
        setResendError(null);
        setResending(true);
        try {
            const res = await postForgotPassword({ email: emailParam });
            const text = await readResponseBody(res);
            if (!res.ok) {
                setResendError(parseApiErrorMessage(text, "Não foi possível reenviar"));
                return;
            }
            setResent(true);
            window.setTimeout(() => setResent(false), 4000);
        } catch {
            setResendError("Falha de conexão. Tente novamente");
        } finally {
            setResending(false);
        }
    }, [emailParam]);

    if (!emailParam) {
        return (
            <AuthFlowShell>
                <AuthFlowHeader
                    icon={<FeaturedIcon color="gray" theme="modern" size="xl" icon={Mail01} />}
                    title="Verifique seu e-mail"
                    description="Não encontramos um e-mail na URL. Volte e informe seu e-mail para redefinir a senha"
                />
                <div className="flex justify-center">
                    <AuthBackToLoginLink>Voltar para o login</AuthBackToLoginLink>
                </div>
            </AuthFlowShell>
        );
    }

    return (
        <AuthFlowShell>
            <AuthFlowHeader
                icon={<FeaturedIcon color="gray" theme="modern" size="xl" icon={Mail01} />}
                title="Verifique seu e-mail"
                description={
                    <>
                        Enviamos um link para redefinir a senha para <span className="font-medium text-secondary">{emailParam}</span>
                    </>
                }
            />

            <div className="flex w-full flex-col gap-3">
                <AuthPrimaryButton type="button" onClick={openMailClient}>
                    Abra o aplicativo de e-mail
                </AuthPrimaryButton>

                <Button
                    size="lg"
                    color="secondary"
                    className="w-full rounded-md!"
                    href="/forgot-password/reset"
                >
                    Inserir código de redefinição
                </Button>

                <div className="flex flex-wrap items-center justify-center gap-1 pt-3 text-center">
                    <span className="text-sm text-tertiary">Não recebeu o e-mail?</span>
                    <Button
                        color="link-color"
                        className="inline h-auto min-h-0 p-0! text-sm font-semibold"
                        isDisabled={resending}
                        onClick={() => void handleResend()}
                    >
                        Clique para reenviar
                    </Button>
                </div>
                {resent ? <p className="text-center text-sm text-success-primary">Enviamos o e-mail novamente</p> : null}
                {resendError ? <p className="text-center text-sm text-error-primary">{resendError}</p> : null}
            </div>

            <div className="flex justify-center">
                <AuthBackToLoginLink>Voltar para fazer login</AuthBackToLoginLink>
            </div>
        </AuthFlowShell>
    );
}
