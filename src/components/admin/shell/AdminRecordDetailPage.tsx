"use client";

import { AdminRecordDetailSurface } from "#/components/admin/shell/RecordSidebar";
import type { AdminDetailTab } from "#/lib/admin-detail-search";

interface AdminRecordDetailPageProps {
	entityType: string;
	initialTab?: AdminDetailTab;
	recordId: string;
}

export function AdminRecordDetailPage({
	entityType,
	initialTab,
	recordId,
}: AdminRecordDetailPageProps) {
	return (
		<AdminRecordDetailSurface
			initialTab={initialTab}
			reference={{
				entityType,
				recordId,
			}}
			variant="page"
		/>
	);
}
