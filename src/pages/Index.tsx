import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import LiveTicker from "@/components/LiveTicker";
import CategoryGrid from "@/components/CategoryGrid";
import FeaturedListings from "@/components/FeaturedListings";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Pharma-Grid | P2P Medical Equipment Marketplace</title>
        <meta
          name="description"
          content="Rent oxygen concentrators, wheelchairs, hospital beds and more from verified neighbors. AI verified, insured, with 24/7 support."
        />
        <meta name="keywords" content="medical equipment rental, oxygen concentrator, wheelchair rental, hospital bed, P2P marketplace, healthcare" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <HeroSection />
          <LiveTicker />
          <CategoryGrid />
          <FeaturedListings />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
