// ============================================================
// Trade taxonomy — Tree Service
// ============================================================
//
// Ordered by commercial importance: removal, trimming and storm work
// first, plant health care next, specialty and commercial work last.

export default {
  id: "tree-service",
  label: "Tree Service",
  services: [
    { id: "tree-removal", label: "Tree Removal", subs: ["Emergency Tree Removal", "Large Tree Removal", "Dead Tree Removal", "Hazardous Tree Removal"] },
    { id: "tree-trimming", label: "Tree Trimming", subs: ["Crown Reduction", "Canopy Thinning", "Tree Shaping"] },
    { id: "emergency-tree-service", label: "Emergency Tree Service", subs: ["24/7 Tree Service", "Fallen Tree Removal", "Storm Damage Tree Removal"] },
    { id: "stump-grinding", label: "Stump Grinding", subs: ["Stump Removal", "Stump Grinding Cleanup"] },
    { id: "tree-pruning", label: "Tree Pruning", subs: ["Deadwooding", "Structural Pruning", "Fruit Tree Pruning"] },
    { id: "storm-damage-cleanup", label: "Storm Damage Cleanup", subs: ["Downed Limb Removal", "Debris Hauling"] },
    { id: "tree-health-care", label: "Tree Health & Disease Treatment", subs: ["Disease Diagnosis", "Fungus Treatment", "Tree Injections"] },
    { id: "tree-pest-control", label: "Tree Pest Control", subs: ["Emerald Ash Borer Treatment", "Spotted Lanternfly Treatment", "Insect & Mite Treatment"] },
    { id: "deep-root-fertilization", label: "Deep Root Fertilization", subs: ["Soil Amendment", "Root Aeration"] },
    { id: "hedge-shrub-trimming", label: "Hedge & Shrub Trimming", subs: ["Bush Trimming", "Shrub Pruning", "Hedge Shaping"] },
    { id: "palm-tree-service", label: "Palm Tree Service", subs: ["Palm Tree Trimming", "Palm Tree Removal", "Palm Skinning"] },
    { id: "tree-cabling-bracing", label: "Tree Cabling & Bracing", subs: ["Cable Installation", "Tree Support Systems"] },
    { id: "crane-tree-removal", label: "Crane-Assisted Tree Removal", subs: ["Bucket Truck Service", "Tight-Access Removal"] },
    { id: "land-clearing", label: "Land Clearing", subs: ["Lot Clearing", "Forestry Mulching", "Underbrush Clearing"] },
    { id: "brush-removal", label: "Brush & Debris Removal", subs: ["Yard Waste Hauling", "Log Removal"] },
    { id: "root-removal", label: "Root Pruning & Removal", subs: ["Surface Root Removal", "Root Barrier Installation"] },
    { id: "tree-planting", label: "Tree Planting", subs: ["Tree Installation", "Tree Transplanting", "Tree Selection"] },
    { id: "arborist-consultation", label: "Arborist Consultation", subs: ["Tree Risk Assessment", "Tree Health Inspection", "Arborist Reports"] },
    { id: "cabling-lightning-protection", label: "Tree Lightning Protection", subs: [] },
    { id: "mulch-delivery", label: "Mulch Delivery & Installation", subs: ["Bulk Mulch", "Mulch Spreading"] },
    { id: "wood-chipping", label: "Wood Chipping & Firewood", subs: ["Wood Chip Delivery", "Firewood", "Log Splitting"] },
    { id: "tree-topping", label: "Tree Topping", subs: [] },
    { id: "utility-line-clearance", label: "Utility Line Clearance", subs: ["Power Line Trimming", "Right-of-Way Clearing"] },
    { id: "tree-preservation", label: "Tree Preservation", subs: ["Construction Tree Protection", "Heritage Tree Care"] },
    { id: "maintenance-plan", label: "Tree Care Maintenance Plans", subs: ["Seasonal Tree Care", "Annual Inspections"] },
    { id: "commercial", label: "Commercial Tree Service", subs: ["HOA Tree Service", "Property Management Tree Care", "Municipal Tree Service"] },
  ],
};
