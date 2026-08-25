// ============================================================
// Trade taxonomy — Pool & Spa
// ============================================================
//
// Ordered by commercial importance: recurring service and repair
// revenue first, equipment and renovation next, new builds last.

export default {
  id: "pool-spa",
  label: "Pool & Spa",
  services: [
    { id: "pool-cleaning", label: "Pool Cleaning", subs: ["Weekly Pool Service", "One-Time Pool Cleaning", "Green Pool Cleanup"] },
    { id: "pool-maintenance", label: "Pool Maintenance", subs: ["Chemical Balancing", "Filter Cleaning", "Pool Tune-Up", "Maintenance Plans"] },
    { id: "pool-repair", label: "Pool Repair", subs: ["Pool Plumbing Repair", "Pool Crack Repair", "Skimmer Repair"] },
    { id: "equipment-repair", label: "Pool Equipment Repair", subs: ["Pool Pump Repair", "Pool Filter Repair", "Pool Heater Repair", "Salt System Repair"] },
    { id: "leak-detection", label: "Pool Leak Detection", subs: ["Pool Leak Repair", "Underground Leak Detection"] },
    { id: "opening-closing", label: "Pool Opening & Closing", subs: ["Pool Opening", "Pool Closing", "Winterization"] },
    { id: "pool-pumps", label: "Pool Pumps", subs: ["Pump Replacement", "Variable Speed Pumps"] },
    { id: "pool-filters", label: "Pool Filters", subs: ["Cartridge Filters", "Sand Filters", "DE Filters"] },
    { id: "pool-heaters", label: "Pool Heaters", subs: ["Pool Heater Installation", "Heat Pumps", "Gas Pool Heaters", "Solar Pool Heating"] },
    { id: "salt-water-systems", label: "Salt Water Systems", subs: ["Salt Cell Replacement", "Chlorine to Salt Conversion"] },
    { id: "pool-lighting", label: "Pool Lighting", subs: ["LED Pool Lights", "Color-Changing Lights", "Pool Light Repair"] },
    { id: "pool-automation", label: "Pool Automation", subs: ["Smart Pool Controls", "Remote Control Systems"] },
    { id: "pool-resurfacing", label: "Pool Resurfacing", subs: ["Replastering", "Pebble Finish", "Quartz Finish"] },
    { id: "tile-repair", label: "Pool Tile Repair", subs: ["Waterline Tile Replacement", "Pool Tile Cleaning"] },
    { id: "drain-acid-wash", label: "Pool Draining & Acid Wash", subs: ["Chlorine Wash", "Stain Removal"] },
    { id: "pool-liners", label: "Pool Liners", subs: ["Vinyl Liner Replacement", "Liner Repair"] },
    { id: "pool-remodeling", label: "Pool Remodeling", subs: ["Pool Renovation", "Coping Replacement", "Pool Conversions"] },
    { id: "pool-decks", label: "Pool Decks", subs: ["Pool Deck Resurfacing", "Pool Deck Repair", "Cool Deck Coating"] },
    { id: "pool-covers", label: "Pool Covers", subs: ["Safety Covers", "Automatic Pool Covers", "Solar Covers"] },
    { id: "hot-tub-repair", label: "Hot Tub Repair", subs: ["Spa Leak Repair", "Hot Tub Heater Repair", "Spa Pump Repair"] },
    { id: "hot-tub-service", label: "Hot Tub Service", subs: ["Hot Tub Cleaning", "Water Change", "Spa Maintenance Plans"] },
    { id: "hot-tub-installation", label: "Hot Tub Installation", subs: ["Hot Tub Delivery", "Hot Tub Removal", "Spa Electrical Hookup"] },
    { id: "swim-spas", label: "Swim Spas", subs: [] },
    { id: "water-features", label: "Water Features", subs: ["Waterfalls", "Fountains & Bubblers", "Water Feature Repair"] },
    { id: "pool-fencing", label: "Pool Fencing & Safety", subs: ["Pool Safety Fence", "Pool Gates", "Safety Nets"] },
    { id: "pool-inspections", label: "Pool Inspections", subs: ["Pre-Purchase Pool Inspection", "Equipment Inspection"] },
    { id: "commercial", label: "Commercial Pool Service", subs: ["HOA Pool Service", "Hotel & Apartment Pools", "Commercial Pool Repair"] },
    { id: "pool-construction", label: "Pool Construction", subs: ["Gunite Pools", "Fiberglass Pools", "Vinyl Liner Pools", "Spa Installation"] },
    { id: "pool-removal", label: "Pool Removal", subs: ["Pool Demolition", "Pool Fill-In"] },
  ],
};
