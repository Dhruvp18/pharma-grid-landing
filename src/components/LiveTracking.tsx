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
    status?: string; // 'accepted', 'picked_up', 'delivered'
    onArrival?: () => void;
    pickupTime?: string;
}

export function LiveTracking({ source, destinationName, trigger, status: bookingStatus = 'accepted', onArrival, pickupTime, variant = 'delivery' }: LiveTrackingProps & { variant?: 'delivery' | 'return' }) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<tt.Map | null>(null);
    const bikeMarker = useRef<tt.Marker | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [eta, setEta] = useState<string>("");
    const [internalStatus, setInternalStatus] = useState("Initializing...");
    const [retry, setRetry] = useState(0);
    const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

    // Define Steps based on Variant
    const steps = variant === 'delivery'
        ? ['Order Accepted', 'On the Way', 'Delivered']
        : ['Return Accepted', 'On the Way', 'Returned'];

    // Map Booking Status to Step Index (0, 1, 2)
    const getStep = () => {
        if (variant === 'return') {
            if (bookingStatus === 'return_accepted') return 0;
            else if (bookingStatus === 'return_picked_up') return 1;
            else if (bookingStatus === 'return_delivered') return 2;
            else if (bookingStatus === 'returned' || bookingStatus === 'completed') return 2; // 'Returned' is the final step
            return 0;
        } else {
            // Delivery / Pickup
            if (bookingStatus === 'requested' || bookingStatus === 'accepted') return 0;
            else if (bookingStatus === 'picked_up' || bookingStatus === 'in_use') return 1;
            else if (bookingStatus === 'delivered' || bookingStatus === 'completed') return 2; // Arrived / Delivered
            return 0;
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const isDeliveryWait = variant === 'delivery' && bookingStatus === 'accepted';
        const isReturnWait = variant === 'return' && (bookingStatus === 'return_requested' || bookingStatus === 'return_accepted'); // Maybe just return_accepted if we only show tracking then

        // If not picked up yet (Step 1)
        if (isDeliveryWait || (variant === 'return' && bookingStatus === 'return_accepted')) {
            setInternalStatus("Waiting for driver...");
            return;
        }

        const isComplete = (variant === 'delivery' && bookingStatus === 'delivered') || (variant === 'return' && (bookingStatus === 'completed' || bookingStatus === 'returned'));

        if (isComplete) {
            setInternalStatus(variant === 'delivery' ? "Delivered" : "Returned");
            return;
        }

        if (!TOMTOM_API_KEY) {
            setInternalStatus("Missing API Key");
            console.error("TOMTOM_API_KEY is missing");
            return;
        }

        if (!mapContainer.current) {
            setInternalStatus("Loading Map...");
            const timer = setTimeout(() => setRetry(r => r + 1), 500);
            return () => clearTimeout(timer);
        }

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
            setInternalStatus("Map Error");
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
                    setInternalStatus("Address not found.");
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
                    const drawRoute = () => {
                        if (map.current?.getLayer('route')) return;
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
                                'line-color': '#0066FF', // Stronger Blue
                                'line-width': 6
                            }
                        });
                    };

                    try {
                        drawRoute();
                    } catch (e) {
                        map.current?.on('load', drawRoute);
                    }

                    // 5. Animate Bike
                    const points = route.legs[0].points;
                    routeCoordinates = points.map(p => new tt.LngLat(p.lng || 0, p.lat || 0));

                    // If returning, we animate FROM dest TO source (Reverse the path)
                    if (variant === 'return') {
                        routeCoordinates.reverse();
                    }

                    // Create Bike Marker element
                    const el = document.createElement('div');
                    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary fill-background"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';
                    el.className = 'bike-marker';

                    if (map.current) {
                        bikeMarker.current = new tt.Marker({ element: el })
                            .setLngLat([source.lng, source.lat])
                            .addTo(map.current);
                    }

                    setInternalStatus("Driver on the way");
                    setEta(`${Math.ceil(route.summary.travelTimeInSeconds / 60)} mins`);

                    // Animation Loop
                    let progress = 0;
                    const duration = 30000; // 30 seconds

                    // IF we have a synced pickup time, use it. Otherwise use local now.
                    const startTime = pickupTime ? new Date(pickupTime).getTime() : performance.now();
                    const usePerformanceNow = !pickupTime; // If no pickup time, we use performance.now local elapsed

                    const animate = (currentTime: number) => {
                        const now = Date.now();
                        // If synced: elapsed = now - pickupTime. If local: elapsed = currentTime - startTime (performance.now)
                        const elapsed = usePerformanceNow ? (currentTime - startTime) : (now - startTime);

                        progress = Math.min(Math.max(elapsed / duration, 0), 1); // Clamp between 0 and 1

                        if (progress >= 1) {
                            if (onArrival) onArrival(); // Trigger delivery completion
                            cancelAnimationFrame(animationFrameId);
                            return;
                        }

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
                    animationFrameId = requestAnimationFrame(animate);
                }
            } catch (err) {
                console.error("Routing error:", err);
                setInternalStatus("Routing failed");
            }
        };

        calcRoute();

        return () => {
            if (map.current) map.current.remove();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isOpen, source, destinationName, bookingStatus, retry, variant]); // Re-run when status changes

    const isStep1 = (variant === 'delivery' && bookingStatus === 'accepted') || (variant === 'return' && bookingStatus === 'return_accepted');
    const isStep3 = (variant === 'delivery' && bookingStatus === 'delivered') || (variant === 'return' && bookingStatus === 'completed');

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline" className="gap-2"><Bike className="w-4 h-4" /> Track {variant === 'return' ? 'Return' : 'Delivery'}</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span>Live {variant === 'return' ? 'Return' : 'Delivery'} Tracking</span>
                        <div className="flex gap-4 text-sm font-normal">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <span className={`w-2 h-2 rounded-full ${internalStatus.includes('way') ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                                {internalStatus}
                            </div>
                            <div className="font-bold text-primary">ETA: {eta}</div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col gap-4">
                    {/* Stepper */}
                    <div className="flex items-center justify-between px-10 py-4 bg-muted/30 relative">
                        {steps.map((label, idx) => {
                            const stepNum = idx + 1;
                            const currentStep = getStep();
                            return (
                                <div key={idx} className="flex flex-col items-center gap-2 relative z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= stepNum ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                                        }`}>
                                        {stepNum}
                                    </div>
                                    <span className={`text-xs font-medium ${currentStep >= stepNum ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
                                </div>
                            );
                        })}
                        {/* Connecting Lines */}
                        <div className="absolute top-9 left-10 right-10 h-0.5 bg-muted-foreground/20 -z-0">
                            <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${((getStep() - 1) / 2) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 rounded-xl overflow-hidden border border-border relative bg-muted mx-4 mb-4">
                        {isStep1 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <Bike className="w-12 h-12 opacity-20" />
                                <p>Waiting for driver to {variant === 'return' ? 'collect return' : 'pickup'}...</p>
                            </div>
                        ) : isStep3 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-600 gap-2 bg-emerald-50">
                                <MapPin className="w-12 h-12" />
                                <h3 className="text-xl font-bold">{variant === 'return' ? 'Returned Successfully!' : 'Delivered!'}</h3>
                                <p className="text-sm text-emerald-800">{variant === 'return' ? 'Item has been returned to owner.' : 'Package has reached the destination.'}</p>
                            </div>
                        ) : (
                            // Map Container for "On the Way"
                            <>
                                <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
                                <div className="absolute top-4 right-4 bg-background/90 backdrop-blur px-3 py-1.5 rounded-md shadow-sm border text-sm font-medium z-10">
                                    ETA: {eta || "Calculating..."}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
