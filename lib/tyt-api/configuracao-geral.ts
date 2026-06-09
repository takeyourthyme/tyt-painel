import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";

export type ConfiguracaoGeralResponse = {
    lgpd_show: boolean;
    cookies: boolean;
    termos_politicas: string | null;
    lgpd: string | null;
};

export type ConfiguracaoGeralUpdateBody = {
    lgpd_show: boolean;
    cookies: boolean;
    termos_politicas?: File | string | null;
    lgpd?: File | string | null;
};

export function getConfiguracaoGeral() {
    return tytFetch(tytEndpoints.configuracaoGeral.get, { method: "GET" });
}

export function putConfiguracaoGeral(body: ConfiguracaoGeralUpdateBody, token: string) {
    const formData = new FormData();
    formData.append("lgpd_show", String(body.lgpd_show));
    formData.append("cookies", String(body.cookies));

    if (body.termos_politicas instanceof File) {
        formData.append("termos_politicas", body.termos_politicas);
    } else if (body.termos_politicas === null) {
        formData.append("termos_politicas", "");
    }

    if (body.lgpd instanceof File) {
        formData.append("lgpd", body.lgpd);
    } else if (body.lgpd === null) {
        formData.append("lgpd", "");
    }

    return tytFetch(tytEndpoints.configuracaoGeral.put, {
        method: "PUT",
        body: formData,
        token,
    });
}
