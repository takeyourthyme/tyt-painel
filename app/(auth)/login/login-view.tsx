"use client";

import { useEffect, useState } from "react";
import { Playfair_Display } from "next/font/google";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { loginPanel } from "@/lib/tyt-api/auth";
import { TytApiError } from "@/lib/tyt-api/errors";
import { hasTytSession, setTytSession } from "@/lib/tyt-api/session";
import { cx } from "@/utils/cx";

const playfair = Playfair_Display({
    subsets: ["latin"],
    weight: ["600"],
    display: "swap",
});

const logoSrc = "/assets/figma-login/9667a5a9bb108d996812ccc4087e3509b6b6316e.svg";

export function LoginView() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [formError, setFormError] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (hasTytSession()) {
            router.replace("/dashboard");
        }
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(undefined);
        if (!email.trim() || !password) {
            setFormError("Preencha e-mail e senha");
            return;
        }
        setLoading(true);
        try {
            const { token, user } = await loginPanel({ email: email.trim(), senha: password });
            setTytSession(token, user);
            router.replace("/dashboard");
            router.refresh();
        } catch (err) {
            if (err instanceof TytApiError) {
                setFormError(err.body || "E-mail ou senha inválidos");
            } else {
                setFormError("Falha de conexão. Tente novamente");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-dvh flex-col items-center justify-center bg-primary px-4 py-12 md:min-h-screen md:px-8 md:pt-24 md:pb-12">
            <div
                className={cx(
                    "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-linear-to-b to-transparent blur-3xl",
                    "from-login-glow-gradient-from",
                    "top-login-glow-top-mobile size-login-glow-mobile",
                    "md:top-login-glow-top-desktop md:size-login-glow-desktop",
                )}
                aria-hidden
            />

            <div className="relative flex w-full max-w-container flex-col items-center">
                <div className="flex w-full max-w-login-form flex-col gap-8">
                    <header className="flex w-full flex-col items-center gap-6">
                        <div className="relative flex h-login-logo-mobile w-login-logo-mobile shrink-0 items-start justify-center md:h-(--height-login-logo-desktop) md:w-login-logo-desktop md:items-center">
                            <Image
                                src={logoSrc}
                                alt="Take Your Thyme"
                                width={75}
                                height={96}
                                className="h-(--height-login-logo-image-mobile) w-login-logo-image-mobile object-contain md:h-full md:w-auto md:max-w-none"
                                priority
                            />
                        </div>
                        <div className="flex w-full flex-col gap-2 text-center md:gap-3">
                            <h1 className={cx(playfair.className, "text-display-xs font-semibold text-primary md:text-display-sm")}>Faça login na sua conta</h1>
                            <p className="text-md font-normal text-tertiary">Bem-vindo! Por favor, insira seus dados</p>
                        </div>
                    </header>

                    <Form className="flex w-full flex-col gap-6 rounded-xl" onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-5">
                            <Input
                                isRequired
                                label="Email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="Insira seu email"
                                size="md"
                                value={email}
                                onChange={(v) => {
                                    setEmail(v);
                                    if (formError) setFormError(undefined);
                                }}
                            />
                            <Input
                                isRequired
                                label="Senha"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Informe sua senha"
                                size="md"
                                value={password}
                                onChange={(v) => {
                                    setPassword(v);
                                    if (formError) setFormError(undefined);
                                }}
                            />
                        </div>
                        {formError ? <p className="text-sm text-error-primary">{formError}</p> : null}

                        <div className="hidden h-5 w-full items-center md:flex">
                            <Button href="/forgot-password" color="link-color" className="h-auto min-h-0 p-0! text-sm font-semibold">
                                Esqueceu a senha?
                            </Button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                type="submit"
                                size="lg"
                                color="primary"
                                isLoading={loading}
                                isDisabled={loading}
                                className="w-full rounded-md! bg-brand-section! text-primary_on-brand! shadow-xs! ring-0! before:hidden! hover:bg-brand-section_subtle! focus-visible:outline-(length:--spacing-focus-ring-width) focus-visible:outline-offset-(--spacing-focus-ring-offset) focus-visible:outline-brand! disabled:bg-disabled!"
                            >
                                Entrar
                            </Button>
                            <Button href="/forgot-password" color="link-color" className="h-auto min-h-0 self-start p-0! text-sm font-semibold md:hidden">
                                Esqueceu a senha?
                            </Button>
                        </div>
                    </Form>
                </div>
            </div>
        </div>
    );
}
