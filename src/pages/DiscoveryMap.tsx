import React, { useEffect, useRef, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from 'react-router-dom';
import * as tt from '@tomtom-international/web-sdk-maps';
import * as ttServices from '@tomtom-international/web-sdk-services';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { getNearbyEquipment, MedicalEquipment } from '../data/dummyEquipment';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Locate, Search, Clock } from 'lucide-react';
import { toast } from "sonner";

const DiscoveryMap = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<tt.Map | null>(null);
    // TomTom markers are just maplibregl markers under the hood, but typed as any in some versions or specific types
    const markers = useRef<any[]>([]);
    const userMarker = useRef<HTMLDivElement | null>(null);
    const [equipment, setEquipment] = useState<MedicalEquipment[]>([]);
    const [filteredEquipment, setFilteredEquipment] = useState<MedicalEquipment[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [locationSearchQuery, setLocationSearchQuery] = useState("");
    // Store ETAs for all items: itemId -> etaString
    const [etas, setEtas] = useState<Record<string, string>>({});

    const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

    // Helper: Haversine Distance in km
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    // Calculate fallback ETA based on 30km/h average speed
    const getFallbackEta = (startLat: number, startLon: number, endLat: number, endLon: number) => {
        const distKm = calculateDistance(startLat, startLon, endLat, endLon);
        // Assume 30 km/h average speed in city
        const hours = distKm / 30;
        const minutes = Math.round(hours * 60);

        if (minutes < 1) return "< 1 min";
        if (minutes < 60) return `${minutes} mins (approx)`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h} hr ${m} mins (approx)`;
    };

    // Function to fetch ETAs for all filtered items
    const fetchAllEtas = async () => {
        if (!userLocation || filteredEquipment.length === 0 || !TOMTOM_API_KEY) return;

        const newEtas: Record<string, string> = {};

        // Process in parallel
        const promises = filteredEquipment.map(async (item) => {
            try {
                const response = await ttServices.services.calculateRoute({
                    key: TOMTOM_API_KEY,
                    locations: `${userLocation.lon},${userLocation.lat}:${item.lon},${item.lat}`,
                    traffic: true
                });

                if (response.routes && response.routes.length > 0) {
                    const durationSeconds = response.routes[0].summary.travelTimeInSeconds;
                    const minutes = Math.round(durationSeconds / 60);
                    if (minutes < 60) {
                        newEtas[item.id] = `${minutes} mins`;
                    } else {
                        const hours = Math.floor(minutes / 60);
                        const remainingMins = minutes % 60;
                        newEtas[item.id] = `${hours} hr ${remainingMins} mins`;
                    }
                } else {
                    newEtas[item.id] = getFallbackEta(userLocation.lat, userLocation.lon, item.lat, item.lon);
                }
            } catch (error) {
                console.error("Route calculation error for item " + item.id, error);
                newEtas[item.id] = getFallbackEta(userLocation.lat, userLocation.lon, item.lat, item.lon);
            }
        });

        await Promise.all(promises);
        setEtas(prev => ({ ...prev, ...newEtas }));
    };

    // Initial Fetch of ETAs when location or equipment changes
    useEffect(() => {
        fetchAllEtas();
    }, [userLocation, filteredEquipment]); // Removed fetchAllEtas dependency to avoid loop if it was stable, but it's defined inside render so it would loop if added. keeping it outside or using logic inside.

    // Live Routing Update: Refresh ETAs every 2 minutes
    useEffect(() => {
        const intervalId = setInterval(() => {
            console.log("Refreshing ETAs...");
            // We need to call the function with current state. 
            // Since fetchAllEtas depends on state variables, we should probably wrap it in useCallback or just let the effect handle it.
            // However, to capture fresh state in interval, it's easiest to just re-trigger.
            // But wait, the interval closure will capture old state if not careful.
            // Better approach: Use a ref or just rely on the fact that we can call a function that uses refs, 
            // OR simpler: Just toggle a 'refreshTrigger' state every 2 mins to cause the main useEffect to run.
            // ACTUALLY, simpler: Just use a separate useEffect with interval that calls a version of fetchAllEtas or sets a trigger.
            fetchAllEtas();
        }, 120000); // 2 minutes

        return () => clearInterval(intervalId);
    }, [userLocation, filteredEquipment]); // dependencies ensure we have fresh state when creating the interval


    // Update markers when filtered equipment changes
    useEffect(() => {
        if (!map.current) return;

        // Remove existing markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // Add new markers
        filteredEquipment.forEach((item) => {
            const markerElement = document.createElement('div');
            markerElement.className = 'marker-icon';
            markerElement.style.backgroundImage = 'url(https://api.tomtom.com/maps-sdk-for-web/cdn/static/s/images/marker-icon.png)'; // Default TomTom marker or custom
            markerElement.style.width = '30px';
            markerElement.style.height = '30px';
            markerElement.style.backgroundSize = 'cover';
            markerElement.style.cursor = 'pointer';

            // Use default marker for simplicity if custom div is tricky, but TomTom default is good.
            // Actually tt.Marker() usage:
            const marker = new tt.Marker()
                .setLngLat([item.lon, item.lat])
                .setPopup(new tt.Popup({ offset: 30 }).setHTML(`
                  <div class="p-2">
                    <h3 class="font-bold">${item.name}</h3>
                    <p class="text-sm">${item.hospitalName}</p>
                    <p class="text-xs text-green-600">${item.available ? 'Available' : 'Unavailable'}</p>
                  </div>
                `))
                .addTo(map.current!);

            marker.getElement().addEventListener('click', () => {
                flyToLocation(item.lat, item.lon, item.id);
            });

            markers.current.push(marker);
        });
    }, [filteredEquipment]);

    // Handle search text filter
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredEquipment(equipment);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = equipment.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.type.toLowerCase().includes(query) ||
            item.hospitalName.toLowerCase().includes(query)
        );
        setFilteredEquipment(filtered);
    }, [searchQuery, equipment]);

    const fetchEquipment = async (lat: number, lon: number) => {
        try {
            let query = supabase.from('items').select('*');

            // Exclude own items if logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                query = query.neq('owner_id', session.user.id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching equipment:', error);
                toast.error('Failed to load equipment');
                return;
            }

            if (data) {
                const mappedEquipment: MedicalEquipment[] = data.map((item: any) => ({
                    id: item.id,
                    name: item.title,
                    type: item.category || 'General',
                    hospitalName: "Verified Seller",
                    lat: item.lat,
                    lon: item.lng,
                    available: item.is_available,
                    pricePerDay: item.price_per_day,
                    address: item.address_text || 'Address not available',
                    contact: "+91 98765 43210"
                }));

                // Sort by distance
                const sorted = mappedEquipment.sort((a, b) => {
                    const distA = Math.sqrt(Math.pow(a.lat - lat, 2) + Math.pow(a.lon - lon, 2));
                    const distB = Math.sqrt(Math.pow(b.lat - lat, 2) + Math.pow(b.lon - lon, 2));
                    return distA - distB;
                });

                setEquipment(sorted);

                // Re-apply search filter
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    const filtered = sorted.filter(item =>
                        item.name.toLowerCase().includes(query) ||
                        item.type.toLowerCase().includes(query) ||
                        item.hospitalName.toLowerCase().includes(query)
                    );
                    setFilteredEquipment(filtered);
                } else {
                    setFilteredEquipment(sorted);
                }
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        }
    };

    const updateMapLocation = (lat: number, lon: number) => {
        setUserLocation({ lat, lon });

        if (map.current) {
            map.current.flyTo({ center: [lon, lat], zoom: 14 } as any);

            // Update user marker
            if (userMarker.current) {
                // If we saved the marker instance, update it. 
                // But I defined userMarker as HTMLDivElement ref above, need to fix that logic.
                // Let's stick to using a stored marker instance in a ref.
            }

            // Re-create user marker to be safe or update position if we stored the instance. 
            // The previous code stored it in userMarker ref (which I typed as any or Marker).
            // Let's fix the ref type usage.
        }

        // Fetch and display nearby equipment
        fetchEquipment(lat, lon);
    };

    const handleLocationSearch = async () => {
        if (!locationSearchQuery.trim() || !TOMTOM_API_KEY) return;

        try {
            const response = await ttServices.services.fuzzySearch({
                key: TOMTOM_API_KEY,
                query: locationSearchQuery
            });

            if (response.results && response.results.length > 0) {
                const position = response.results[0].position;
                // @ts-ignore
                const { lat, lng } = position;
                if (lat && lng) {
                    updateMapLocation(lat, lng);
                    toast.success(`Moved to ${locationSearchQuery}`);
                }
            } else {
                toast.error(`Could not find location: ${locationSearchQuery}`);
            }
        } catch (error) {
            console.error("Geocoding error:", error);
            toast.error("Error finding location.");
        }
    };

    const handleUseMyLocation = () => {
        if (navigator.geolocation) {
            toast.info("Getting your location...");
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    updateMapLocation(latitude, longitude);
                    setLocationSearchQuery("Current Location");
                    toast.success("Updated to your current location");
                },
                (error) => {
                    console.error("Error getting location:", error);
                    toast.error("Could not get your location.");
                }
            );
        } else {
            toast.error("Geolocation is not supported by this browser.");
        }
    };

    // Initialize Map
    useEffect(() => {
        if (map.current || !TOMTOM_API_KEY) return;

        const initializeMap = (lat: number, lon: number) => {
            if (mapContainer.current) {
                map.current = tt.map({
                    key: TOMTOM_API_KEY,
                    container: mapContainer.current,
                    center: [lon, lat],
                    zoom: 14,
                    style: 'https://api.tomtom.com/map/1/style/22.2.1-9/basic_main.json',
                    dragPan: true,
                    dragRotate: true,
                });

                map.current.addControl(new tt.NavigationControl(), 'top-right');

                // User Location Marker
                const markerElement = document.createElement('div');
                markerElement.className = 'user-marker';
                markerElement.style.width = '20px';
                markerElement.style.height = '20px';
                markerElement.style.borderRadius = '50%';
                markerElement.style.backgroundColor = '#FF0000';
                markerElement.style.border = '2px solid white';
                markerElement.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

                const marker = new tt.Marker({ element: markerElement })
                    .setLngLat([lon, lat])
                    .setPopup(new tt.Popup().setHTML("<h3>You are here</h3>"))
                    .addTo(map.current);

                // Store/Track user marker if needed, or just let it exist. 
                // We said we want to update it.
                // We can't easily update a custom element marker position without re-instantiating or keeping ref.
                // Let's keep a ref to the marker instance.
                // @ts-ignore
                userMarker.current = marker;

                setUserLocation({ lat, lon });
                fetchEquipment(lat, lon);
            }
        };

        const handleLocationInit = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlSearchQuery = params.get('search');
            const urlLocationQuery = params.get('location');

            if (urlSearchQuery) {
                setSearchQuery(urlSearchQuery);
            }

            if (urlLocationQuery) {
                setLocationSearchQuery(urlLocationQuery);
                try {
                    const response = await ttServices.services.fuzzySearch({
                        key: TOMTOM_API_KEY,
                        query: urlLocationQuery
                    });

                    if (response.results && response.results.length > 0) {
                        // @ts-ignore
                        const { lat, lng } = response.results[0].position;
                        if (lat && lng) initializeMap(lat, lng);
                        return;
                    }
                } catch (error) {
                    console.error("Geocoding error:", error);
                }
            }

            // Fallback to Geolocation
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        initializeMap(latitude, longitude);
                        if (!urlLocationQuery) setLocationSearchQuery("Current Location");
                    },
                    (error) => {
                        console.error("Error getting location:", error);
                        toast.error("Could not get your location. Defaulting to Mumbai.");
                        initializeMap(19.0760, 72.8777);
                    }
                );
            } else {
                initializeMap(19.0760, 72.8777);
            }
        };

        handleLocationInit();
    }, [TOMTOM_API_KEY]);

    // Update user marker position when userLocation changes
    useEffect(() => {
        if (userLocation && userMarker.current) {
            // @ts-ignore
            userMarker.current.setLngLat([userLocation.lon, userLocation.lat]);
        }
    }, [userLocation]);


    const flyToLocation = (lat: number, lon: number, id: string) => {
        map.current?.flyTo({ center: [lon, lat], zoom: 16 } as any);
        setSelectedId(id);
    };

    // Draw Route for Selected Item
    useEffect(() => {
        if (!map.current || !selectedId || !userLocation || !TOMTOM_API_KEY) {
            // Clear route if no selection
            if (map.current?.getLayer('route')) {
                map.current.removeLayer('route');
                map.current.removeSource('route');
            }
            return;
        }

        const drawRoute = async () => {
            const item = equipment.find(e => e.id === selectedId);
            if (!item) return;

            try {
                const response = await ttServices.services.calculateRoute({
                    key: TOMTOM_API_KEY,
                    locations: `${userLocation.lon},${userLocation.lat}:${item.lon},${item.lat}`,
                    traffic: true
                });

                if (response.routes && response.routes.length > 0) {
                    const geojson = response.routes[0].legs[0].points.map(point => [point.lng, point.lat]);

                    const routeGeoJson = {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: geojson
                        },
                        properties: {}
                    };

                    if (map.current?.getLayer('route')) {
                        map.current.removeLayer('route');
                        map.current.removeSource('route');
                    }

                    map.current?.addSource('route', {
                        type: 'geojson',
                        data: routeGeoJson as any
                    });

                    map.current?.addLayer({
                        id: 'route',
                        type: 'line',
                        source: 'route',
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': '#3388ff',
                            'line-width': 6,
                            'line-opacity': 0.8
                        }
                    });

                    // Zoom to fit bounds
                    const bounds = new tt.LngLatBounds();
                    geojson.forEach(point => bounds.extend(point as any));
                    map.current?.fitBounds(bounds, { padding: 50 });
                }
            } catch (error) {
                console.error("Error drawing route:", error);
                toast.error("Could not draw route.");
            }
        };

        drawRoute();
    }, [selectedId, userLocation, equipment]); // Re-draw if selection or location changes

    return (
        <div className="flex flex-col h-screen md:flex-row">
            {/* Sidebar / List View */}
            <div className="w-full md:w-1/3 p-4 overflow-y-auto bg-gray-50 border-r flex flex-col">
                <div className="mb-4 space-y-3">
                    <h1 className="text-2xl font-bold text-primary">Medical Equipment Nearby</h1>

                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search equipment, hospital..."
                            className="w-full pl-9 p-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Location Input */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Enter location..."
                                className="w-full pl-9 p-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                value={locationSearchQuery}
                                onChange={(e) => setLocationSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleUseMyLocation}
                            title="Use my location"
                        >
                            <Locate className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleLocationSearch}>
                            Go
                        </Button>
                    </div>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto">
                    {filteredEquipment.length === 0 ? (
                        <p className="text-center text-gray-500 mt-4">No equipment found matching your search.</p>
                    ) : (
                        filteredEquipment.map((item) => (
                            <Card
                                key={item.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${selectedId === item.id ? 'border-primary ring-1 ring-primary' : ''}`}
                                onClick={() => flyToLocation(item.lat, item.lon, item.id)}
                            >
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg flex justify-between items-start">
                                        <span>{item.name}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${item.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {item.available ? 'Available' : 'Busy'}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-gray-600 font-medium">{item.hospitalName}</p>
                                    <p className="text-xs text-gray-500 mb-2">{item.address}</p>

                                    {/* ETA Display for ALL Items */}
                                    <div className="flex items-center gap-2 text-sm text-blue-600 my-2 bg-blue-50 p-2 rounded">
                                        <Clock className="h-4 w-4" />
                                        <span className="font-medium">
                                            {etas[item.id] ? `Est. Travel: ${etas[item.id]}` : "Calculating ETA..."}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between mt-3">
                                        <span className="font-bold text-primary">${item.pricePerDay}/day</span>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                                                <Navigation className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" className="h-8 w-8 p-0">
                                                <Phone className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Map Container */}
            <div className="w-full md:w-2/3 h-[50vh] md:h-full relative">
                <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
                {!userLocation && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
                        <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-2">
                            <MapPin className="animate-bounce text-primary" />
                            <span>Locating you...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiscoveryMap;
