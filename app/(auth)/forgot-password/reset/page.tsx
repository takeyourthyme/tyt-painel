import { Suspense } from "react";
import { ResetPasswordView } from "./reset-password-view";

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-dvh items-center justify-center bg-primary px-4 py-12 md:min-h-screen">
                    <p className="text-md text-tertiary">Carregando…</p>
                </div>
            }
        >
            <ResetPasswordView />
        </Suspense>
    );
}
