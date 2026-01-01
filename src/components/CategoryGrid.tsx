import { Wind, Accessibility, BedDouble, Activity } from "lucide-react";

const CategoryGrid = () => {
  const categories = [
    {
      name: "Oxygen Equipment",
      icon: Wind,
      count: "234 available",
      color: "from-primary/10 to-teal-light",
      iconColor: "text-primary",
    },
    {
      name: "Mobility Aids",
      icon: Accessibility,
      count: "189 available",
      color: "from-coral/10 to-coral-light",
      iconColor: "text-coral",
    },
    {
      name: "Hospital Beds",
      icon: BedDouble,
      count: "156 available",
      color: "from-emerald/10 to-emerald-light",
      iconColor: "text-emerald",
    },
    {
      name: "Monitors",
      icon: Activity,
      count: "312 available",
      color: "from-primary/10 to-teal-light",
      iconColor: "text-primary",
    },
  ];

  return (
    <section className="py-16 md:py-24 px-4" id="equipment">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Browse by Category
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find exactly what you need from our verified network of equipment providers
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-3xl p-8 shadow-soft hover-lift cursor-pointer border border-border/50"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              
              <div className="relative">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <category.icon className={`w-8 h-8 ${category.iconColor}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                <p className="text-muted-foreground font-medium">
                  {category.count}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;
