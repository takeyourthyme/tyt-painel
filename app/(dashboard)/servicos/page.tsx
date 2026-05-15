import { redirect } from "next/navigation";

/** Rota antiga: no SiteMap, Serviços agendados ficam sob Dashboard. */
export default function ServicosRedirectPage() {
    redirect("/dashboard/servicos-agendados");
}
