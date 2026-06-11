export type WorkosOrganizationMembershipStatus =
	| "active"
	| "inactive"
	| "pending";

export interface WorkosOrganizationMembership {
	id: string;
	organizationId: string;
	roleSlug?: string;
	roleSlugs?: string[];
	status: WorkosOrganizationMembershipStatus;
	userId: string;
}

export type WorkosOrganizationMembershipListArgs =
	| {
			organizationId: string;
			statuses?: WorkosOrganizationMembershipStatus[];
			userId?: string;
	  }
	| {
			organizationId?: string;
			statuses?: WorkosOrganizationMembershipStatus[];
			userId: string;
	  };

export interface WorkosProvisioning {
	createOrganization(args: { name: string }): Promise<{ id: string }>;
	createOrganizationMembership(args: {
		organizationId: string;
		roleSlug: string;
		userId: string;
	}): Promise<{ id?: string }>;
	createUser(args: {
		email: string;
		firstName?: string;
		lastName?: string;
	}): Promise<{ email: string; id: string }>;
	deactivateOrganizationMembership(
		membershipId: string
	): Promise<WorkosOrganizationMembership>;
	deleteOrganizationMembership(membershipId: string): Promise<void>;
	findInvitationByToken?(token: string): Promise<{
		acceptInvitationUrl?: string;
		email: string;
		id: string;
		state?: string;
		token?: string;
	}>;
	listOrganizationMemberships(
		args: WorkosOrganizationMembershipListArgs
	): Promise<WorkosOrganizationMembership[]>;
	listUsers(args: {
		email?: string;
	}): Promise<Array<{ email: string; id: string }>>;
	resendInvitation?(invitationId: string): Promise<{
		email: string;
		id: string;
		state?: string;
	}>;
	revokeInvitation?(invitationId: string): Promise<{
		email: string;
		id: string;
		state?: string;
	}>;
	sendInvitation?(args: {
		email: string;
		expiresInDays?: number;
		inviterUserId?: string;
		organizationId?: string;
		roleSlug?: string;
	}): Promise<{
		acceptInvitationUrl?: string;
		email: string;
		id: string;
		state?: string;
		token?: string;
	}>;
	updateOrganizationMembership(
		membershipId: string,
		args: { roleSlug?: string; roleSlugs?: string[] }
	): Promise<WorkosOrganizationMembership>;
}

async function getAuthKit() {
	const { authKit } = await import("../../auth");
	return authKit;
}

function mapWorkosOrganizationMembership(membership: {
	id: string;
	organizationId: string;
	role?: { slug: string };
	roles?: Array<{ slug: string }>;
	status: WorkosOrganizationMembershipStatus;
	userId: string;
}): WorkosOrganizationMembership {
	return {
		id: membership.id,
		organizationId: membership.organizationId,
		roleSlug: membership.role?.slug,
		roleSlugs: membership.roles?.map((role) => role.slug),
		status: membership.status,
		userId: membership.userId,
	};
}

const defaultProvisioning: WorkosProvisioning = {
	createOrganization: async (args) => {
		const authKit = await getAuthKit();
		return await authKit.workos.organizations.createOrganization(args);
	},
	createOrganizationMembership: async (args) => {
		const authKit = await getAuthKit();
		const membership =
			await authKit.workos.userManagement.createOrganizationMembership(args);
		return { id: membership.id };
	},
	createUser: async (args) => {
		const authKit = await getAuthKit();
		const user = await authKit.workos.userManagement.createUser({
			email: args.email,
			firstName: args.firstName,
			lastName: args.lastName,
		});
		return { email: user.email, id: user.id };
	},
	deactivateOrganizationMembership: async (membershipId) => {
		const authKit = await getAuthKit();
		const membership =
			await authKit.workos.userManagement.deactivateOrganizationMembership(
				membershipId
			);
		return mapWorkosOrganizationMembership(membership);
	},
	deleteOrganizationMembership: async (membershipId) => {
		const authKit = await getAuthKit();
		await authKit.workos.userManagement.deleteOrganizationMembership(
			membershipId
		);
	},
	findInvitationByToken: async (token) => {
		const authKit = await getAuthKit();
		const invitation =
			await authKit.workos.userManagement.findInvitationByToken(token);
		return {
			acceptInvitationUrl: invitation.acceptInvitationUrl,
			email: invitation.email,
			id: invitation.id,
			state: invitation.state,
			token: invitation.token,
		};
	},
	listUsers: async (args) => {
		const authKit = await getAuthKit();
		const users = await authKit.workos.userManagement.listUsers(args);
		return users.data.map((user) => ({ email: user.email, id: user.id }));
	},
	listOrganizationMemberships: async (args) => {
		const authKit = await getAuthKit();
		const memberships =
			await authKit.workos.userManagement.listOrganizationMemberships({
				organizationId: args.organizationId,
				statuses: args.statuses,
				userId: args.userId,
			});
		return memberships.data.map(mapWorkosOrganizationMembership);
	},
	updateOrganizationMembership: async (membershipId, args) => {
		const authKit = await getAuthKit();
		const membership =
			await authKit.workos.userManagement.updateOrganizationMembership(
				membershipId,
				args
			);
		return mapWorkosOrganizationMembership(membership);
	},
	resendInvitation: async (invitationId) => {
		const authKit = await getAuthKit();
		const invitation =
			await authKit.workos.userManagement.resendInvitation(invitationId);
		return {
			email: invitation.email,
			id: invitation.id,
			state: invitation.state,
		};
	},
	revokeInvitation: async (invitationId) => {
		const authKit = await getAuthKit();
		const invitation =
			await authKit.workos.userManagement.revokeInvitation(invitationId);
		return {
			email: invitation.email,
			id: invitation.id,
			state: invitation.state,
		};
	},
	sendInvitation: async (args) => {
		const authKit = await getAuthKit();
		const invitation = await authKit.workos.userManagement.sendInvitation(args);
		return {
			acceptInvitationUrl: invitation.acceptInvitationUrl,
			email: invitation.email,
			id: invitation.id,
			state: invitation.state,
			token: invitation.token,
		};
	},
};

let overrideProvisioning: WorkosProvisioning | null = null;

export function getWorkosProvisioning(): WorkosProvisioning {
	return overrideProvisioning ?? defaultProvisioning;
}

export function setWorkosProvisioningForTests(
	provisioning: WorkosProvisioning | null
) {
	overrideProvisioning = provisioning;
}
