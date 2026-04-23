import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FairLendAnimatedHeader } from "./FairLendAnimatedHeader";

const meta = {
	title: "Navigation/FairLendAnimatedHeader",
	component: FairLendAnimatedHeader,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof FairLendAnimatedHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultNavItems = [
	{ label: "Listings", href: "/listings", active: false },
	{ label: "Dashboard", href: "/dashboard", active: false },
	{ label: "Portfolio", href: "/portfolio", active: false },
	{ label: "Payments", href: "/payments", active: false },
];

export const Default: Story = {
	args: {
		brandName: "FairLend",
		eyebrow: "Mortgage Marketplace",
		navItems: defaultNavItems,
		cta: {
			label: "Get Started",
			onClick: fn(),
		},
	},
};

export const ActiveListingState: Story = {
	args: {
		brandName: "FairLend",
		eyebrow: "Mortgage Marketplace",
		navItems: [
			{ label: "Listings", href: "/listings", active: true },
			{ label: "Dashboard", href: "/dashboard", active: false },
			{ label: "Portfolio", href: "/portfolio", active: false },
			{ label: "Payments", href: "/payments", active: false, badge: 3 },
		],
		cta: {
			label: "New Listing",
			onClick: fn(),
		},
		secondaryAction: {
			label: "Sign In",
			onClick: fn(),
		},
	},
};

export const SignedInUser: Story = {
	args: {
		brandName: "FairLend",
		eyebrow: "Mortgage Marketplace",
		navItems: [
			{ label: "Listings", href: "/listings", active: false },
			{ label: "Dashboard", href: "/dashboard", active: true },
			{ label: "Portfolio", href: "/portfolio", active: false },
			{ label: "Payments", href: "/payments", active: false, badge: 2 },
		],
		cta: {
			label: "Fund Deal",
			onClick: fn(),
		},
		user: {
			name: "Alexandra Chen",
			email: "alex.chen@fairlend.com",
			initials: "AC",
		},
	},
};

export const WithAvatarUser: Story = {
	args: {
		brandName: "FairLend",
		navItems: [
			{ label: "Listings", href: "/listings", active: false },
			{ label: "Dashboard", href: "/dashboard", active: false },
		],
		cta: {
			label: "Create Account",
			onClick: fn(),
		},
		user: {
			name: "Marcus Johnson",
			email: "marcus@example.com",
			avatarUrl:
				"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face",
		},
	},
};

export const Minimal: Story = {
	args: {
		brandName: "FairLend",
		navItems: [
			{ label: "Listings", href: "/listings" },
			{ label: "About", href: "/about" },
		],
	},
};

export const ManyNavItems: Story = {
	args: {
		brandName: "FairLend",
		eyebrow: "Backoffice",
		navItems: [
			{ label: "Listings", href: "/listings", active: false },
			{ label: "Dashboard", href: "/dashboard", active: false },
			{ label: "Portfolio", href: "/portfolio", active: false },
			{ label: "Payments", href: "/payments", active: false, badge: 5 },
			{ label: "Reports", href: "/reports", active: true },
			{ label: "Settings", href: "/settings", active: false },
		],
		cta: {
			label: "New Deal",
			onClick: fn(),
		},
		secondaryAction: {
			label: "Help",
			onClick: fn(),
		},
		user: {
			name: "Sam Rivera",
			initials: "SR",
		},
	},
};

export const MobileViewport: Story = {
	parameters: {
		viewport: {
			defaultViewport: "mobile1",
		},
	},
	args: {
		brandName: "FairLend",
		eyebrow: "Mortgage Marketplace",
		navItems: defaultNavItems,
		cta: {
			label: "Get Started",
			onClick: fn(),
		},
		secondaryAction: {
			label: "Sign In",
			onClick: fn(),
		},
	},
};

export const MobileSignedIn: Story = {
	parameters: {
		viewport: {
			defaultViewport: "mobile1",
		},
	},
	args: {
		brandName: "FairLend",
		navItems: [
			{ label: "Listings", href: "/listings", active: false },
			{ label: "Dashboard", href: "/dashboard", active: true },
			{ label: "Portfolio", href: "/portfolio", active: false },
			{ label: "Payments", href: "/payments", active: false, badge: 2 },
		],
		cta: {
			label: "Fund Deal",
			onClick: fn(),
		},
		user: {
			name: "Alexandra Chen",
			initials: "AC",
		},
	},
};

export const TabletViewport: Story = {
	parameters: {
		viewport: {
			defaultViewport: "tablet",
		},
	},
	args: {
		brandName: "FairLend",
		navItems: [
			{ label: "Listings", href: "/listings", active: true },
			{ label: "Dashboard", href: "/dashboard", active: false },
			{ label: "Portfolio", href: "/portfolio", active: false },
		],
		cta: {
			label: "Get Started",
			onClick: fn(),
		},
		user: {
			name: "Jordan Lee",
			initials: "JL",
		},
	},
};
