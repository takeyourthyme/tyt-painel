"use client";

import { useState } from "react";
import { Key01 } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { AuthBackToLoginLink } from "@/app/(auth)/_components/auth-back-link";
import { AuthFlowHeader } from "@/app/(auth)/_components/auth-flow-header";
import { AuthFlowShell } from "@/app/(auth)/_components/auth-flow-shell";
import { AuthPrimaryButton } from "@/app/(auth)/_components/auth-primary-button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { postForgotPassword } from "@/lib/tyt-api/auth";
import { parseApiErrorMessage, readResponseBody } from "@/lib/tyt-api/errors";

const emailSchema = z.string().email();

export function ForgotPasswordView() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = emailSchema.safeParse(email.trim());
        if (!parsed.success) {
            setError("Digite um e-mail válido");
            return;
        }
        setError(undefined);
        setLoading(true);
        try {
            const res = await postForgotPassword({ email: parsed.data });
            const text = await readResponseBody(res);
            if (!res.ok) {
                setError(parseApiErrorMessage(text, "Não foi possível enviar o e-mail. Tente novamente"));
                return;
            }
            router.push(`/forgot-password/check-email?email=${encodeURIComponent(parsed.data)}`);
        } catch {
            setError("Falha de conexão. Verifique sua rede e tente novamente");
        } finally {
            setLoading(false);
        }
    };

    const isInvalid = Boolean(error);

    return (
        <AuthFlowShell>
            <AuthFlowHeader
                icon={<FeaturedIcon color="gray" theme="modern" size="xl" icon={Key01} />}
                title="Esqueceu a senha?"
                description="Sem problemas, enviaremos as instruções de redefinição"
            />

            <Form className="flex w-full flex-col gap-6 rounded-xl" onSubmit={handleSubmit}>
                <div className="flex w-full flex-col gap-6">
                    <Input
                        isRequired
                        label="Email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Digite seu email"
                        size="md"
                        value={email}
                        onChange={(value) => {
                            setEmail(value);
                            if (error) setError(undefined);
                        }}
                        isInvalid={isInvalid}
                        hint={error}
                    />
                    <AuthPrimaryButton type="submit" isDisabled={email.trim().length === 0 || loading} isLoading={loading}>
                        Redefinir senha
                    </AuthPrimaryButton>
                </div>
            </Form>

            <div className="flex justify-center">
                <AuthBackToLoginLink>Voltar para o login</AuthBackToLoginLink>
            </div>
        </AuthFlowShell>
    );
}
