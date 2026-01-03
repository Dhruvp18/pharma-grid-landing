import { Link } from "react-router-dom";

const LiveTicker = () => {
  const activities = [
    { location: "Dadar", item: "Wheelchair", time: "2 mins ago" },
    { location: "Andheri", item: "Oxygen Concentrator", time: "5 mins ago" },
    { location: "Bandra", item: "Hospital Bed", time: "8 mins ago" },
    { location: "Thane", item: "BP Monitor", time: "12 mins ago" },
    { location: "Powai", item: "Nebulizer", time: "15 mins ago" },
    { location: "Juhu", item: "CPAP Machine", time: "18 mins ago" },
    { location: "Vashi", item: "Walker", time: "22 mins ago" },
    { location: "Malad", item: "Pulse Oximeter", time: "25 mins ago" },
  ];

  // Duplicate for seamless loop
  const duplicatedActivities = [...activities, ...activities];

  return (
    <section className="py-4 bg-teal-light/50 overflow-hidden border-y border-border/50">
      <div className="relative">
        <div className="ticker-scroll flex gap-8 whitespace-nowrap">
          {duplicatedActivities.map((activity, index) => (
            <Link to={`/map?search=${encodeURIComponent(activity.item)}`} key={index} className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse-soft" />
              <span className="text-muted-foreground">
                Someone in <span className="font-semibold text-foreground">{activity.location}</span> just rented a{" "}
                <span className="font-semibold text-primary">{activity.item}</span>
              </span>
              <span className="text-muted-foreground/60">• {activity.time}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LiveTicker;
