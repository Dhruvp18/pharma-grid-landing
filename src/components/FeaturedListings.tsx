import { MapPin, ShieldCheck, Heart } from "lucide-react";

const FeaturedListings = () => {
  const listings = [
    {
      id: 1,
      title: "Philips Oxygen Concentrator",
      price: "₹350",
      period: "day",
      distance: "1.2 km",
      image: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=400&h=300&fit=crop",
      verified: true,
      emergency: false,
    },
    {
      id: 2,
      title: "Premium Wheelchair",
      price: "₹200",
      period: "day",
      distance: "0.8 km",
      image: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400&h=300&fit=crop",
      verified: true,
      emergency: true,
    },
    {
      id: 3,
      title: "Adjustable Hospital Bed",
      price: "₹500",
      period: "day",
      distance: "2.5 km",
      image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400&h=300&fit=crop",
      verified: true,
      emergency: false,
    },
    {
      id: 4,
      title: "Pulse Oximeter Set",
      price: "₹80",
      period: "day",
      distance: "1.8 km",
      image: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=400&h=300&fit=crop",
      verified: true,
      emergency: false,
    },
  ];

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
          <a
            href="#"
            className="text-primary font-semibold hover:underline underline-offset-4 transition-all"
          >
            View all listings →
          </a>
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {listings.map((listing, index) => (
            <div
              key={listing.id}
              className="group bg-card rounded-3xl overflow-hidden shadow-soft hover-lift cursor-pointer border border-border/50"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={listing.image}
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Distance Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-foreground/80 backdrop-blur-sm text-primary-foreground px-3 py-1.5 rounded-full text-sm font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  {listing.distance}
                </div>

                {/* Emergency Badge */}
                {listing.emergency && (
                  <div className="absolute top-3 right-3 bg-coral text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-coral-glow">
                    Emergency
                  </div>
                )}

                {/* Verified Badge */}
                {listing.verified && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-emerald text-white px-3 py-1.5 rounded-full text-sm font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified
                  </div>
                )}

                {/* Favorite Button */}
                <button className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white">
                  <Heart className="w-4 h-4 text-muted-foreground hover:text-coral transition-colors" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
                  {listing.title}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-primary">
                    {listing.price}
                  </span>
                  <span className="text-muted-foreground">/{listing.period}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedListings;
