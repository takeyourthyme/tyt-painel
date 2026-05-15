import { Suspense } from "react";
import { CheckEmailView } from "./check-email-view";

export default function CheckEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-dvh items-center justify-center bg-primary px-4 py-12 md:min-h-screen">
                    <p className="text-md text-tertiary">Carregando…</p>
                </div>
            }
        >
            <CheckEmailView />
        </Suspense>
    );
}
