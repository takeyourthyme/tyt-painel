"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Check, Lock01 } from "@untitledui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthBackToLoginLink } from "@/app/(auth)/_components/auth-back-link";
import { AuthFlowHeader } from "@/app/(auth)/_components/auth-flow-header";
import { AuthFlowShell } from "@/app/(auth)/_components/auth-flow-shell";
import { AuthPrimaryButton } from "@/app/(auth)/_components/auth-primary-button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { postResetPassword } from "@/lib/tyt-api/auth";
import { parseApiErrorMessage, readResponseBody } from "@/lib/tyt-api/errors";
import { cx } from "@/utils/cx";

const SPECIAL_RE = /[^A-Za-z0-9\s]/;

function PasswordRule({ met, children }: { met: boolean; children: ReactNode }) {
    return (
        <div className="flex gap-2">
            <div
                className={cx(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    met ? "bg-success-solid text-white" : "bg-fg-disabled_subtle text-fg-disabled",
                )}
                aria-hidden
            >
                {met ? <Check className="size-3" strokeWidth={3} /> : null}
            </div>
            <p className="min-w-0 flex-1 text-left text-sm text-tertiary">{children}</p>
        </div>
    );
}

export function ResetPasswordView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [token, setToken] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [passwordError, setPasswordError] = useState<string | undefined>();
    const [confirmError, setConfirmError] = useState<string | undefined>();
    const [tokenError, setTokenError] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = searchParams.get("token")?.trim();
        if (t) setToken(t);
    }, [searchParams]);

    const hasLength = password.length >= 8;
    const hasSpecial = SPECIAL_RE.test(password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let pErr: string | undefined;
        let cErr: string | undefined;
        let tErr: string | undefined;

        if (!token.trim()) {
            tErr = "Informe o token enviado por e-mail";
        }
        if (!hasLength || !hasSpecial) {
            pErr = "Digite uma senha válida";
        }
        if (password !== confirm) {
            cErr = "As senhas não coincidem";
        }

        setTokenError(tErr);
        setPasswordError(pErr);
        setConfirmError(cErr);

        if (tErr || pErr || cErr) {
            return;
        }

        setLoading(true);
        try {
            const res = await postResetPassword({ token: token.trim(), novaSenha: password });
            const text = await readResponseBody(res);
            if (!res.ok) {
                setTokenError(parseApiErrorMessage(text, "Não foi possível redefinir a senha"));
                return;
            }
            router.push("/forgot-password/success");
        } catch {
            setTokenError("Falha de conexão. Tente novamente");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthFlowShell>
            <AuthFlowHeader
                icon={<FeaturedIcon color="gray" theme="modern" size="xl" icon={Lock01} />}
                title="Defina uma nova senha"
                description="Sua nova senha deve ser diferente das senhas usadas anteriormente"
            />

            <Form className="flex w-full flex-col gap-6 rounded-xl" onSubmit={handleSubmit}>
                <div className="flex w-full flex-col gap-5">
                    <Input
                        isRequired
                        label="Token"
                        name="token"
                        type="text"
                        autoComplete="one-time-code"
                        placeholder="Cole o código do e-mail"
                        size="md"
                        value={token}
                        onChange={(v) => {
                            setToken(v);
                            if (tokenError) setTokenError(undefined);
                        }}
                        isInvalid={Boolean(tokenError)}
                        hint={tokenError}
                    />
                    <Input
                        isRequired
                        label="Senha"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        size="md"
                        value={password}
                        onChange={(v) => {
                            setPassword(v);
                            if (passwordError) setPasswordError(undefined);
                        }}
                        isInvalid={Boolean(passwordError)}
                        hint={passwordError}
                    />
                    <Input
                        isRequired
                        label="Confirme a senha"
                        name="confirm"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        size="md"
                        value={confirm}
                        onChange={(v) => {
                            setConfirm(v);
                            if (confirmError) setConfirmError(undefined);
                        }}
                        isInvalid={Boolean(confirmError)}
                        hint={confirmError}
                    />

                    <div className="flex flex-col gap-3">
                        <PasswordRule met={hasLength}>Deve ter pelo menos 8 caracteres</PasswordRule>
                        <PasswordRule met={hasSpecial}>Deve conter um caractere especial</PasswordRule>
                    </div>
                </div>

                <AuthPrimaryButton type="submit" isLoading={loading} isDisabled={loading}>
                    Redefinir senha
                </AuthPrimaryButton>
            </Form>

            <div className="flex justify-center">
                <AuthBackToLoginLink>Voltar para fazer login</AuthBackToLoginLink>
            </div>
        </AuthFlowShell>
    );
}
