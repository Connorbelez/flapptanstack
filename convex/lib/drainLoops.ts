export interface CursorPage<TItem> {
	continueCursor: string | null;
	isDone: boolean;
	page: readonly TItem[];
}

export interface CursorDrainResult<TState> {
	cursor: string | null;
	exhausted: boolean;
	maxPagesReached: boolean;
	pagesRead: number;
	state: TState;
}

export async function drainCursorPages<TItem, TState>(args: {
	fetchPage: (cursor: string | null) => Promise<CursorPage<TItem>>;
	initialCursor?: string | null;
	initialState: TState;
	maxPages?: number;
	onPage: (
		state: TState,
		page: readonly TItem[],
		meta: { pageNumber: number }
	) => Promise<TState> | TState;
	shouldStop?: (state: TState) => boolean;
}): Promise<CursorDrainResult<TState>> {
	let cursor = args.initialCursor ?? null;
	let pagesRead = 0;
	let state = args.initialState;
	const maxPages = args.maxPages ?? Number.POSITIVE_INFINITY;

	while (pagesRead < maxPages) {
		const pageResult = await args.fetchPage(cursor);
		pagesRead += 1;
		state = await args.onPage(state, pageResult.page, {
			pageNumber: pagesRead,
		});
		cursor = pageResult.continueCursor;

		if (pageResult.isDone) {
			return {
				cursor,
				exhausted: true,
				maxPagesReached: false,
				pagesRead,
				state,
			};
		}

		if (args.shouldStop?.(state) === true) {
			return {
				cursor,
				exhausted: false,
				maxPagesReached: false,
				pagesRead,
				state,
			};
		}
	}

	return {
		cursor,
		exhausted: false,
		maxPagesReached: true,
		pagesRead,
		state,
	};
}

export interface WaveLoopResult<TState> {
	drainedAllEligibleWork: boolean;
	maxWavesReached: boolean;
	state: TState;
	wavesRun: number;
}

export async function executeWaveLoop<TState>(args: {
	initialState: TState;
	maxWaves: number;
	runWave: (
		state: TState,
		meta: { waveNumber: number }
	) => Promise<{ state: TState; shouldContinue: boolean }>;
}): Promise<WaveLoopResult<TState>> {
	let state = args.initialState;
	let wavesRun = 0;

	while (wavesRun < args.maxWaves) {
		const waveNumber = wavesRun + 1;
		const result = await args.runWave(state, { waveNumber });
		state = result.state;
		wavesRun = waveNumber;

		if (!result.shouldContinue) {
			return {
				drainedAllEligibleWork: true,
				maxWavesReached: false,
				state,
				wavesRun,
			};
		}
	}

	return {
		drainedAllEligibleWork: false,
		maxWavesReached: true,
		state,
		wavesRun,
	};
}
