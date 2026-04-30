import { describe, expect, it } from "vitest";
import { parseOnboardingSearch } from "#/routes/onboard/-lib/referral";

describe("parseOnboardingSearch", () => {
	it("treats broker_invite source without an inviter as self signup", () => {
		expect(parseOnboardingSearch({ source: "broker_invite" })).toEqual({
			invitedByBrokerId: undefined,
			ref: undefined,
			referralSource: "self_signup",
		});
	});

	it("emits broker_invite only when the inviter id is present", () => {
		expect(
			parseOnboardingSearch({
				invitedByBrokerId: "user_referrer",
				referralSource: "broker_invite",
			})
		).toEqual({
			invitedByBrokerId: "user_referrer",
			ref: undefined,
			referralSource: "broker_invite",
		});
	});
});
