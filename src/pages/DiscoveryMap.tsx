import React, { useEffect, useRef, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from 'react-router-dom';
import * as maptilersdk from '@maptiler/sdk';
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { getNearbyEquipment, MedicalEquipment } from '../data/dummyEquipment';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Locate, Search } from 'lucide-react';
import { toast } from "sonner";

const DiscoveryMap = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maptilersdk.Map | null>(null);
    const markers = useRef<maptilersdk.Marker[]>([]);
    const userMarker = useRef<maptilersdk.Marker | null>(null);
    const [equipment, setEquipment] = useState<MedicalEquipment[]>([]);
    const [filteredEquipment, setFilteredEquipment] = useState<MedicalEquipment[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [locationSearchQuery, setLocationSearchQuery] = useState("");

    // REPLACE WITH YOUR ACTUAL API KEY
    maptilersdk.config.apiKey = '2emv9KcGYsrDGXqCzf6k';

    // Update markers when filtered equipment changes
    useEffect(() => {
        if (!map.current) return;

        // Remove existing markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // Add new markers
        filteredEquipment.forEach((item) => {
            const marker = new maptilersdk.Marker({ color: "#0000FF" })
                .setLngLat([item.lon, item.lat])
                .setPopup(new maptilersdk.Popup().setHTML(`
                  <div class="p-2">
                    <h3 class="font-bold">${item.name}</h3>
                    <p class="text-sm">${item.hospitalName}</p>
                    <p class="text-xs text-green-600">${item.available ? 'Available' : 'Unavailable'}</p>
                  </div>
                `))
                .addTo(map.current!);

            marker.getElement().addEventListener('click', () => {
                setSelectedId(item.id);
            });

            markers.current.push(marker);
        });
    }, [filteredEquipment]);

    // Handle search
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
            const { data, error } = await supabase
                .from('items')
                .select('*');

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
                    hospitalName: "Verified Seller", // Placeholder as we don't have profile name yet
                    lat: item.lat,
                    lon: item.lng,
                    available: item.is_available,
                    pricePerDay: item.price_per_day,
                    address: item.address_text || 'Address not available',
                    contact: "+91 98765 43210" // Placeholder contact
                }));

                // Sort by distance
                const sorted = mappedEquipment.sort((a, b) => {
                    const distA = Math.sqrt(Math.pow(a.lat - lat, 2) + Math.pow(a.lon - lon, 2));
                    const distB = Math.sqrt(Math.pow(b.lat - lat, 2) + Math.pow(b.lon - lon, 2));
                    return distA - distB;
                });

                setEquipment(sorted);

                // Re-apply search filter if exists
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
            map.current.flyTo({ center: [lon, lat], zoom: 14 });

            // Update user marker
            if (userMarker.current) {
                userMarker.current.setLngLat([lon, lat]);
            } else {
                userMarker.current = new maptilersdk.Marker({ color: "#FF0000" })
                    .setLngLat([lon, lat])
                    .setPopup(new maptilersdk.Popup().setHTML("<h3>You are here</h3>"))
                    .addTo(map.current);
            }
        }

        // Fetch and display nearby equipment
        fetchEquipment(lat, lon);
    };

    const handleLocationSearch = async () => {
        if (!locationSearchQuery.trim()) return;

        try {
            const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(locationSearchQuery)}.json?key=${maptilersdk.config.apiKey}`);
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                const [lon, lat] = data.features[0].center;
                updateMapLocation(lat, lon);
                toast.success(`Moved to ${locationSearchQuery}`);
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

    // Initialize Map and Location
    useEffect(() => {
        if (map.current) return; // stops map from intializing more than once

        const initializeMap = (lat: number, lon: number) => {
            if (mapContainer.current) {
                map.current = new maptilersdk.Map({
                    container: mapContainer.current,
                    style: maptilersdk.MapStyle.STREETS,
                    center: [lon, lat],
                    zoom: 14,
                });

                userMarker.current = new maptilersdk.Marker({ color: "#FF0000" })
                    .setLngLat([lon, lat])
                    .setPopup(new maptilersdk.Popup().setHTML("<h3>You are here</h3>"))
                    .addTo(map.current);

                setUserLocation({ lat, lon });

                // Fetch and display nearby equipment
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
                    const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(urlLocationQuery)}.json?key=${maptilersdk.config.apiKey}`);
                    const data = await response.json();
                    if (data.features && data.features.length > 0) {
                        const [lon, lat] = data.features[0].center;
                        initializeMap(lat, lon);
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
    }, []);

    const flyToLocation = (lat: number, lon: number, id: string) => {
        map.current?.flyTo({ center: [lon, lat], zoom: 16 });
        setSelectedId(id);
    };

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
