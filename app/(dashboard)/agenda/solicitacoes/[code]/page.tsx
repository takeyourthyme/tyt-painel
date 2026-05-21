import { OrderDetailsView } from "../../order-details-view";

export default async function SolicitacaoOrderPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    return <OrderDetailsView code={code} backHref="/agenda/solicitacoes" />;
}

