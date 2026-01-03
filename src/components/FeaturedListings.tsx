import { useEffect, useState } from "react";
import { MapPin, ShieldCheck, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Listing {
  id: string;
  title: string;
  price_per_day: number;
  image_url: string;
  address_text: string;
  lat: number;
  lng: number;
  ai_status: string;
  distance?: number; // Calculated field
}

const FeaturedListings = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const navigate = useNavigate();

  // Get User Location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to Mumbai if denied/error
          setUserLocation({ lat: 19.0760, lng: 72.8777 });
        }
      );
    } else {
      setUserLocation({ lat: 19.0760, lng: 72.8777 });
    }
  }, []);

  // Fetch and Sort Listings
  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);
        const { data: items, error } = await supabase
          .from("items")
          .select("*")
          .eq("is_available", true);

        if (error) throw error;

        if (items && userLocation) {
          // Calculate Distances
          const itemsWithDistance = items.map((item: any) => {
            if (item.lat && item.lng) {
              const dist = calculateDistance(
                userLocation.lat,
                userLocation.lng,
                item.lat,
                item.lng
              );
              return { ...item, distance: dist };
            }
            return { ...item, distance: Infinity };
          });

          // Sort by distance and take top 4
          const sorted = itemsWithDistance
            .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity))
            .slice(0, 4);

          setListings(sorted);
        }
      } catch (err) {
        console.error("Error fetching listings:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userLocation) {
      fetchListings();
    }
  }, [userLocation]);

  // Haversine Formula for Distance (km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const formatDistance = (dist: number | undefined) => {
    if (dist === undefined || dist === Infinity) return "Unknown";
    if (dist < 1) return `${Math.round(dist * 1000)} m`;
    return `${dist.toFixed(1)} km`;
  };

  return (
    <section className="py-16 md:py-24 px-4 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Nearby Listings
            </h2>
            <p className="text-lg text-muted-foreground">
              Equipment available near you, ready for immediate rental
            </p>
          </div>
          <button
            onClick={() => navigate('/map')}
            className="text-primary font-semibold hover:underline underline-offset-4 transition-all"
          >
            View all listings →
          </button>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 bg-white/50 rounded-2xl border border-dashed">
            <p className="text-muted-foreground mb-4">No equipment found nearby.</p>
            <button onClick={() => navigate('/map')} className="text-primary font-medium hover:underline">
              Check Map View
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listings.map((listing, index) => (
              <div
                key={listing.id}
                className="group bg-card rounded-3xl overflow-hidden shadow-soft hover-lift cursor-pointer border border-border/50"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(`/map?search=${encodeURIComponent(listing.title)}`)} // Simple redirect to map with search
              >
                {/* Image Container */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={listing.image_url || "https://images.unsplash.com/photo-1584515933487-779824d29309?w=400&h=300&fit=crop"}
                    alt={listing.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Distance Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-foreground/80 backdrop-blur-sm text-primary-foreground px-3 py-1.5 rounded-full text-sm font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    {formatDistance(listing.distance)}
                  </div>

                  {/* Verified Badge */}
                  {listing.ai_status === 'verified' && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-md">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
                    {listing.title}
                  </h3>
                  <div className="flex items-baseline gap-1 justify-between w-full">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-primary">
                        ₹{listing.price_per_day}
                      </span>
                      <span className="text-muted-foreground">/day</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded truncate max-w-[50%]">
                      {listing.address_text || "Mumbai"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedListings;
