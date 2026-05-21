import { OrderDetailsView } from "../../order-details-view";

export default async function ServicoAgendadoOrderPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    return <OrderDetailsView code={code} backHref="/agenda/servicos-agendados" />;
}

