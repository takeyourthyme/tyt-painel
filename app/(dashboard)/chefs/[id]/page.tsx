import { ChefDetailsPageClient } from "./chef-details-page-client";

export default async function ChefDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ChefDetailsPageClient id={id} />;
}
