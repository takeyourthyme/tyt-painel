import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";

export type PricingTier = {
    id: number;
    service_type: "MEAL_PREP" | "GET_TOGETHER";
    label: string;
    min_quantity: number;
    max_quantity: number;
    client_price: number;
    chef_amount: number;
    sub_chef_amount: number;
    tyt_amount: number;
    active: boolean;
};

export function getPricingTiers(token: string) {
    return tytFetch(tytEndpoints.pricingTiers.get, {
        method: "GET",
        token,
    });
}

export function putPricingTiers(tiers: PricingTier[], token: string) {
    return tytFetch(tytEndpoints.pricingTiers.put, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(tiers),
        token,
    });
}
