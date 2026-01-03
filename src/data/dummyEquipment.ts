export interface MedicalEquipment {
  id: string;
  name: string;
  type: "Oxygen Concentrator" | "ICU Bed" | "Ventilator" | "Ambulance";
  hospitalName: string;
  address: string;
  lat: number;
  lon: number;
  available: boolean;
  contact: string;
  pricePerDay?: number;
  owner?: {
    full_name: string;
    phone: string;
    email: string;
  };
}

// Helper to generate random coordinates around a center point
const getRandomOffset = (radius: number) => {
  return (Math.random() - 0.5) * 2 * radius;
};

export const getNearbyEquipment = (lat: number, lon: number): MedicalEquipment[] => {
  // Generate dummy data around the user's location
  const equipmentTypes = ["Oxygen Concentrator", "ICU Bed", "Ventilator", "Ambulance"] as const;
  const hospitalNames = ["City General Hospital", "St. Mary's Clinic", "Community Health Center", "Rapid Response Unit"];

  return Array.from({ length: 15 }).map((_, i) => ({
    id: `eq-${i}`,
    name: `${equipmentTypes[i % equipmentTypes.length]} - Unit ${i + 1}`,
    type: equipmentTypes[i % equipmentTypes.length],
    hospitalName: hospitalNames[i % hospitalNames.length],
    address: `${Math.floor(Math.random() * 100)} Main St, City`,
    lat: lat + getRandomOffset(0.05), // Approx 5km radius
    lon: lon + getRandomOffset(0.05),
    available: Math.random() > 0.2, // 80% chance of being available
    contact: "+1 (555) 123-4567",
    pricePerDay: Math.floor(Math.random() * 100) + 50,
  }));
};
