import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import { Card } from "#/components/ui/card";
import type { MarketplaceReplicaItem } from "./marketplace-replica-data";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface MarketplaceReplicaMapProps {
	items: readonly MarketplaceReplicaItem[];
}

export function MarketplaceReplicaMap({ items }: MarketplaceReplicaMapProps) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<mapboxgl.Marker[]>([]);

	useEffect(() => {
		if (!(mapContainerRef.current && MAPBOX_TOKEN)) {
			return;
		}

		mapboxgl.accessToken = MAPBOX_TOKEN;
		const map = new mapboxgl.Map({
			center: [-79.42, 43.68],
			container: mapContainerRef.current,
			style: "mapbox://styles/mapbox/light-v11",
			zoom: 9,
		});

		map.addControl(new mapboxgl.NavigationControl(), "top-right");
		mapRef.current = map;

		return () => {
			for (const marker of markersRef.current) {
				marker.remove();
			}
			markersRef.current = [];
			map.remove();
			mapRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!mapRef.current) {
			return;
		}

		for (const marker of markersRef.current) {
			marker.remove();
		}
		markersRef.current = [];

		const bounds = new mapboxgl.LngLatBounds();

		for (const [index, item] of items.entries()) {
			const markerNode = document.createElement("div");
			markerNode.className =
				"flex size-11 items-center justify-center rounded-full bg-[#006837] font-semibold text-lg text-white shadow-lg ring-4 ring-white";
			markerNode.textContent = String(index + 1);

			const marker = new mapboxgl.Marker(markerNode)
				.setLngLat([item.lng, item.lat])
				.addTo(mapRef.current);
			markersRef.current.push(marker);
			bounds.extend([item.lng, item.lat]);
		}

		if (!bounds.isEmpty()) {
			mapRef.current.fitBounds(bounds, {
				maxZoom: 10.5,
				padding: 56,
			});
		}
	}, [items]);

	if (!MAPBOX_TOKEN) {
		return (
			<Card className="flex h-full items-center justify-center rounded-2xl border border-dashed text-muted-foreground">
				Set VITE_MAPBOX_TOKEN to view map.
			</Card>
		);
	}

	return <div className="h-full w-full" ref={mapContainerRef} />;
}
