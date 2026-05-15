import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";
import { toQueryString } from "./query";
import type {
    CreateKitchenOrderBody,
    KitchenOrdersListQuery,
    ResourceId,
    SpecialServiceProposalBody,
    UpdateKitchenOrderStatusBody,
} from "./types";

export type {
    CreateKitchenOrderBody,
    KitchenOrderDishInput,
    KitchenOrdersListQuery,
    SpecialServiceProposalBody,
    SpecialServiceProposalItem,
    UpdateKitchenOrderStatusBody,
} from "./types";

export function getKitchenOrders(token: string, query?: KitchenOrdersListQuery) {
    return tytFetch(`${tytEndpoints.kitchenOrders.collection}${toQueryString(query)}`, { method: "GET", token });
}

export function getKitchenOrderByCode(code: string, token: string) {
    return tytFetch(tytEndpoints.kitchenOrders.byCode(code), { method: "GET", token });
}

export function postKitchenOrder(body: CreateKitchenOrderBody, token: string) {
    return tytFetch(tytEndpoints.kitchenOrders.collection, { method: "POST", json: body, token });
}

export function putKitchenOrderStatus(id: ResourceId, body: UpdateKitchenOrderStatusBody, token: string) {
    return tytFetch(tytEndpoints.kitchenOrders.status(id), { method: "PUT", json: body, token });
}

export function putKitchenOrderSpecialServiceProposal(
    id: ResourceId,
    body: SpecialServiceProposalBody,
    token: string,
) {
    return tytFetch(tytEndpoints.kitchenOrders.specialServiceProposal(id), {
        method: "PUT",
        json: body,
        token,
    });
}

export function putKitchenOrderCancel(code: string, token: string) {
    return tytFetch(tytEndpoints.kitchenOrders.cancel(code), { method: "PUT", token });
}
