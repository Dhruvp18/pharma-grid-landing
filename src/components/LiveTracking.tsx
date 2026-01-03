import { useEffect, useRef, useState } from 'react';
import * as tt from '@tomtom-international/web-sdk-maps';
import * as ttServices from '@tomtom-international/web-sdk-services';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bike, MapPin } from 'lucide-react';

interface LiveTrackingProps {
    source: { lat: number; lng: number }; // Item Location
    destinationName: string; // User Address
    trigger?: React.ReactNode;
}

export function LiveTracking({ source, destinationName, trigger }: LiveTrackingProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<tt.Map | null>(null);
    const bikeMarker = useRef<tt.Marker | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [eta, setEta] = useState<string>("Calculating...");
    const [status, setStatus] = useState("Finding Driver...");
    const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

    useEffect(() => {
        if (!isOpen || !mapContainer.current || !TOMTOM_API_KEY) return;

        let animationFrameId: number;
        let routeCoordinates: tt.LngLat[] = [];

        // 1. Initialize Map Immediately
        try {
            map.current = tt.map({
                key: TOMTOM_API_KEY,
                container: mapContainer.current!,
                center: [source.lng, source.lat],
                zoom: 13,
            });
            // Add Source Marker immediately
            new tt.Marker().setLngLat([source.lng, source.lat]).addTo(map.current);
        } catch (error) {
            console.error("Map initialization failed:", error);
            setStatus("Map Error");
            return;
        }

        const calcRoute = async () => {
            // 2. Geocode Destination
            try {
                const geoRes = await ttServices.services.fuzzySearch({
                    key: TOMTOM_API_KEY,
                    query: destinationName
                });

                if (!geoRes.results || geoRes.results.length === 0) {
                    setStatus("Address not found.");
                    return;
                }

                const destCoords = geoRes.results[0].position;

                // 3. Add Dest Marker
                if (map.current) {
                    new tt.Marker({ color: '#FF0000' })
                        .setLngLat([destCoords.lng || 0, destCoords.lat || 0])
                        .addTo(map.current);
                }

                // 4. Calculate Route
                const routeRes = await ttServices.services.calculateRoute({
                    key: TOMTOM_API_KEY,
                    locations: `${source.lng},${source.lat}:${destCoords.lng},${destCoords.lat}`
                });

                if (routeRes.routes && routeRes.routes.length > 0) {
                    const route = routeRes.routes[0];
                    const geojson = route.legs[0].points.map(p => [p.lng || 0, p.lat || 0]); // GeoJSON format

                    // Draw Route
                    map.current?.on('load', () => {
                        map.current?.addLayer({
                            id: 'route',
                            type: 'line',
                            source: {
                                type: 'geojson',
                                data: {
                                    type: 'Feature',
                                    properties: {},
                                    geometry: {
                                        type: 'LineString',
                                        coordinates: geojson
                                    }
                                }
                            },
                            paint: {
                                'line-color': '#22d3ee', // Cyan
                                'line-width': 6
                            }
                        });
                    });

                    // 5. Animate Bike
                    const points = route.legs[0].points;
                    routeCoordinates = points.map(p => new tt.LngLat(p.lng || 0, p.lat || 0));

                    // Create Bike Marker element
                    const el = document.createElement('div');
                    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary fill-background"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';
                    el.className = 'bike-marker';

                    if (map.current) {
                        bikeMarker.current = new tt.Marker({ element: el })
                            .setLngLat([source.lng, source.lat])
                            .addTo(map.current);
                    }

                    setStatus("Driver on the way");
                    setEta(`${Math.ceil(route.summary.travelTimeInSeconds / 60)} mins`);

                    // Animation Loop
                    let progress = 0;
                    const speed = 0.005;

                    const animate = () => {
                        progress += speed;
                        if (progress >= 1) progress = 0;

                        const index = Math.floor(progress * (routeCoordinates.length - 1));
                        const nextIndex = Math.min(index + 1, routeCoordinates.length - 1);
                        const p1 = routeCoordinates[index];
                        const p2 = routeCoordinates[nextIndex];

                        const segmentProgress = (progress * (routeCoordinates.length - 1)) - index;
                        const lng = p1.lng + (p2.lng - p1.lng) * segmentProgress;
                        const lat = p1.lat + (p2.lat - p1.lat) * segmentProgress;

                        bikeMarker.current?.setLngLat([lng, lat]);

                        animationFrameId = requestAnimationFrame(animate);
                    };
                    animate();
                }
            } catch (err) {
                console.error("Routing error:", err);
                setStatus("Routing failed");
            }
        };

        calcRoute();

        return () => {
            if (map.current) map.current.remove();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isOpen, source, destinationName]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline" className="gap-2"><Bike className="w-4 h-4" /> Track Delivery</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span>Live Delivery Tracking</span>
                        <div className="flex gap-4 text-sm font-normal">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <span className={`w-2 h-2 rounded-full ${status.includes('way') ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                                {status}
                            </div>
                            <div className="font-bold text-primary">ETA: {eta}</div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 rounded-xl overflow-hidden border border-border relative bg-muted">
                    <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
                </div>
            </DialogContent>
        </Dialog>
    );
}
