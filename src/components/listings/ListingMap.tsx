import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { cn } from "#/lib/utils";

export interface LatLng {
	lat: number;
	lng: number;
}

export interface ViewportBounds {
	maxLat: number;
	maxLng: number;
	minLat: number;
	minLng: number;
}

export interface ListingMapProps<T extends LatLng> {
	className?: string;
	containerClassName?: string;
	initialCenter?: { lat: number; lng: number };
	initialZoom?: number;
	items: readonly T[];
	mapClassName?: string;
	onViewportChange?: (bounds: ViewportBounds) => void;
	renderPopup: (item: T) => React.ReactNode;
	style?: React.CSSProperties;
}

interface ManagedMarker {
	marker: mapboxgl.Marker;
	popup?: mapboxgl.Popup;
	root?: Root;
}

const DEFAULT_CENTER = { lat: 43.6532, lng: -79.3832 };
const DEFAULT_ZOOM = 4;
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function toBounds(map: mapboxgl.Map): ViewportBounds {
	const bounds = map.getBounds();
	if (!bounds) {
		return {
			minLat: -90,
			maxLat: 90,
			minLng: -180,
			maxLng: 180,
		};
	}

	return {
		minLat: bounds.getSouth(),
		maxLat: bounds.getNorth(),
		minLng: bounds.getWest(),
		maxLng: bounds.getEast(),
	};
}

export function ListingMap<T extends LatLng>({
	items,
	renderPopup,
	onViewportChange,
	initialCenter = DEFAULT_CENTER,
	initialZoom = DEFAULT_ZOOM,
	className,
	containerClassName,
	style,
	mapClassName,
}: ListingMapProps<T>) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<ManagedMarker[]>([]);
	const onViewportChangeRef = useRef(onViewportChange);
	const renderPopupRef = useRef(renderPopup);
	const [isMapLoaded, setIsMapLoaded] = useState(false);
	const [isMapUnavailable, setIsMapUnavailable] = useState(false);
	const hasSetInitialViewRef = useRef(false);
	/** Ignore moveend until the first intentional camera + bounds emit (avoids filtering the grid to initialCenter/initialZoom before fitBounds). */
	const suppressViewportMoveEndRef = useRef(true);

	useEffect(() => {
		onViewportChangeRef.current = onViewportChange;
		renderPopupRef.current = renderPopup;
	}, [onViewportChange, renderPopup]);

	useEffect(() => {
		if (!(mapContainerRef.current && MAPBOX_TOKEN)) {
			return;
		}

		if (!mapboxgl.supported()) {
			setIsMapUnavailable(true);
			return;
		}

		mapboxgl.accessToken = MAPBOX_TOKEN;

		let map: mapboxgl.Map;
		try {
			map = new mapboxgl.Map({
				container: mapContainerRef.current,
				style: "mapbox://styles/mapbox/streets-v12",
				center: [initialCenter.lng, initialCenter.lat],
				zoom: initialZoom,
			});
		} catch {
			setIsMapUnavailable(true);
			return;
		}

		mapRef.current = map;
		setIsMapUnavailable(false);
		map.addControl(new mapboxgl.NavigationControl(), "top-right");

		map.on("load", () => {
			setIsMapLoaded(true);
		});

		map.on("moveend", () => {
			if (suppressViewportMoveEndRef.current) {
				return;
			}
			onViewportChangeRef.current?.(toBounds(map));
		});

		return () => {
			for (const { marker, popup, root } of markersRef.current) {
				marker.remove();
				popup?.remove();
				if (root) {
					queueMicrotask(() => root.unmount());
				}
			}
			markersRef.current = [];
			setIsMapLoaded(false);
			setIsMapUnavailable(false);

			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
			suppressViewportMoveEndRef.current = true;
		};
	}, [initialCenter.lat, initialCenter.lng, initialZoom]);

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: map marker lifecycle spans multiple conditional branches by design.
	useEffect(() => {
		if (!(mapRef.current && isMapLoaded)) {
			return;
		}

		for (const { marker, popup, root } of markersRef.current) {
			marker.remove();
			popup?.remove();
			if (root) {
				queueMicrotask(() => root.unmount());
			}
		}
		markersRef.current = [];

		for (const item of items) {
			const popupContainer = document.createElement("div");
			const root = createRoot(popupContainer);
			root.render(renderPopupRef.current(item));

			const popup = new mapboxgl.Popup({
				offset: 25,
				closeButton: true,
				closeOnClick: false,
			}).setDOMContent(popupContainer);

			const markerElement = document.createElement("div");
			markerElement.className = "custom-marker";
			markerElement.style.cursor = "pointer";

			const pinElement = document.createElement("div");
			pinElement.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: #3b82f6;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      `;
			markerElement.appendChild(pinElement);

			markerElement.addEventListener("mouseenter", () => {
				pinElement.style.transform = "scale(1.2)";
				pinElement.style.backgroundColor = "#1d4ed8";
			});

			markerElement.addEventListener("mouseleave", () => {
				pinElement.style.transform = "scale(1)";
				pinElement.style.backgroundColor = "#3b82f6";
			});

			const marker = new mapboxgl.Marker(markerElement)
				.setLngLat([item.lng, item.lat])
				.setPopup(popup)
				.addTo(mapRef.current);

			markersRef.current.push({ marker, popup, root });
		}

		if (items.length > 0 && !hasSetInitialViewRef.current) {
			const finite = items.filter(
				(item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)
			) as Array<T & { lat: number; lng: number }>;

			if (finite.length === 1) {
				const point = finite[0];
				mapRef.current.jumpTo({
					center: [point.lng, point.lat],
					zoom: 11,
				});
				hasSetInitialViewRef.current = true;
				suppressViewportMoveEndRef.current = false;
				queueMicrotask(() => {
					if (mapRef.current) {
						onViewportChangeRef.current?.(toBounds(mapRef.current));
					}
				});
			} else if (finite.length > 1) {
				const bounds = new mapboxgl.LngLatBounds();
				for (const item of finite) {
					bounds.extend([item.lng, item.lat]);
				}

				if (!bounds.isEmpty()) {
					mapRef.current.fitBounds(bounds, {
						duration: 0,
						maxZoom: 11,
						padding: 48,
					});
					hasSetInitialViewRef.current = true;
					suppressViewportMoveEndRef.current = false;
					queueMicrotask(() => {
						if (mapRef.current) {
							onViewportChangeRef.current?.(toBounds(mapRef.current));
						}
					});
				}
			}
		}
	}, [items, isMapLoaded]);

	if (!MAPBOX_TOKEN || isMapUnavailable) {
		return (
			<div
				className={cn(
					"relative flex h-full min-h-80 w-full items-center justify-center overflow-hidden rounded-xl border border-border border-dashed bg-card/60 p-6 text-center",
					containerClassName
				)}
			>
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%)]" />
				<div className="relative max-w-sm space-y-2">
					<p className="font-semibold text-lg">Map unavailable</p>
					<p className="text-muted-foreground text-sm">
						{MAPBOX_TOKEN
							? "Map rendering is not available in this browser."
							: "Set VITE_MAPBOX_TOKEN to enable maps in the marketplace."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl",
				/* Mapbox canvas/compositor often ignores border-radius clipping; clip-path matches :root --radius + 4px (same as rounded-xl here). */
				"[clip-path:inset(0_round_calc(var(--radius)+4px))]",
				"[&_.mapboxgl-map]:h-full [&_.mapboxgl-map]:min-h-0 [&_.mapboxgl-map]:overflow-hidden [&_.mapboxgl-map]:rounded-xl",
				"[&_.mapboxgl-canvas-container]:h-full [&_.mapboxgl-canvas-container]:min-h-0 [&_.mapboxgl-canvas-container]:overflow-hidden [&_.mapboxgl-canvas-container]:rounded-xl",
				containerClassName
			)}
		>
			<div
				className={cn(
					"flex min-h-0 min-w-0 flex-1 flex-col",
					mapClassName,
					className
				)}
				ref={mapContainerRef}
				style={style}
			/>
		</div>
	);
}
