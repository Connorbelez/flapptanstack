import { httpRouter } from "convex/server";
import { authKit } from "./auth";
import { eftVopayWebhook } from "./payments/webhooks/eftVopay";
import { rotessaWebhook } from "./payments/webhooks/rotessa";
import { rotessaPadWebhook } from "./payments/webhooks/rotessaPad";
import { stripeWebhook } from "./payments/webhooks/stripe";
import { vopayWebhook } from "./payments/webhooks/vopay";
import {
	createVelocityMockScenario,
	deliverVelocityMockWebhook,
	fetchVelocityMockDeal,
	patchVelocityMockDealHttp,
	searchVelocityMockDeals,
} from "./velocity/mock";
import { velocityWebhook } from "./velocity/webhook";

const http = httpRouter();

authKit.registerRoutes(http);

http.route({
	path: "/webhooks/rotessa",
	method: "POST",
	handler: rotessaWebhook,
});
http.route({
	path: "/webhooks/pad_rotessa",
	method: "POST",
	handler: rotessaPadWebhook,
});
http.route({
	path: "/webhooks/stripe",
	method: "POST",
	handler: stripeWebhook,
});
http.route({
	path: "/webhooks/pad_vopay",
	method: "POST",
	handler: vopayWebhook,
});
http.route({
	path: "/webhooks/eft_vopay",
	method: "POST",
	handler: eftVopayWebhook,
});
http.route({
	path: "/api/velocity/webhook",
	method: "POST",
	handler: velocityWebhook,
});
http.route({
	path: "/api/dev/velocity/scenarios",
	method: "POST",
	handler: createVelocityMockScenario,
});
http.route({
	path: "/api/dev/velocity/webhook",
	method: "POST",
	handler: deliverVelocityMockWebhook,
});
http.route({
	path: "/api/dev/mock-velocity/v1/deals",
	method: "GET",
	handler: fetchVelocityMockDeal,
});
http.route({
	path: "/api/dev/mock-velocity/v1/deals/search",
	method: "POST",
	handler: searchVelocityMockDeals,
});
http.route({
	path: "/api/dev/mock-velocity/deals",
	method: "PATCH",
	handler: patchVelocityMockDealHttp,
});
http.route({
	path: "/api/dev/mock-velocity/deals/",
	method: "PATCH",
	handler: patchVelocityMockDealHttp,
});

export default http;
