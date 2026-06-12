import { CheckCircle } from "@untitledui/icons";
import { AuthBackToLoginLink } from "@/app/(auth)/_components/auth-back-link";
import { AuthFlowHeader } from "@/app/(auth)/_components/auth-flow-header";
import { AuthFlowShell } from "@/app/(auth)/_components/auth-flow-shell";
import { AuthPrimaryButton } from "@/app/(auth)/_components/auth-primary-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";

export function ForgotPasswordSuccessView() {
    return (
        <AuthFlowShell>
            <AuthFlowHeader
                icon={<FeaturedIcon color="gray" theme="modern" size="xl" icon={CheckCircle} />}
                title="Redefinição de senha"
                description="Sua senha foi redefinida com sucesso. Clique abaixo para fazer login magicamente"
            />

            <div className="flex w-full flex-col gap-6">
                <AuthPrimaryButton href="/login">Continuar</AuthPrimaryButton>
            </div>

            <div className="flex justify-center">
                <AuthBackToLoginLink>Voltar para o login</AuthBackToLoginLink>
            </div>
        </AuthFlowShell>
    );
}
