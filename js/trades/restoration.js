// ============================================================
// Trade taxonomy — Restoration & Water Damage
// ============================================================
//
// Almost entirely emergency-driven: 24/7 mitigation and the insurance
// work sit at the top, specialty abatement and rebuild work last.

export default {
  id: "restoration",
  label: "Restoration & Water Damage",
  services: [
    { id: "water-damage-restoration", label: "Water Damage Restoration", subs: ["Emergency Water Removal", "Structural Drying", "Flooded Basement Cleanup", "Ceiling Water Damage"] },
    { id: "emergency-restoration", label: "24/7 Emergency Restoration", subs: ["Emergency Response", "Same-Day Service"] },
    { id: "water-extraction", label: "Water Extraction", subs: ["Standing Water Removal", "Carpet Water Extraction"] },
    { id: "flood-damage-cleanup", label: "Flood Damage Cleanup", subs: ["Basement Flood Cleanup", "Crawl Space Flooding"] },
    { id: "mold-remediation", label: "Mold Remediation", subs: ["Mold Removal", "Mold Inspection", "Mold Testing", "Black Mold Remediation"] },
    { id: "fire-damage-restoration", label: "Fire Damage Restoration", subs: ["Fire Cleanup", "Soot Removal", "Structural Fire Repair"] },
    { id: "smoke-damage", label: "Smoke Damage Cleanup", subs: ["Smoke Odor Removal", "Puffback Cleanup"] },
    { id: "sewage-cleanup", label: "Sewage Cleanup", subs: ["Sewage Backup Cleanup", "Black Water Cleanup", "Toilet Overflow Cleanup"] },
    { id: "storm-damage-restoration", label: "Storm Damage Restoration", subs: ["Hurricane Damage", "Wind Damage", "Hail Damage", "Fallen Tree Damage"] },
    { id: "burst-pipe-cleanup", label: "Burst Pipe & Frozen Pipe Cleanup", subs: ["Pipe Leak Water Damage", "Supply Line Failure"] },
    { id: "appliance-leak-cleanup", label: "Appliance Leak Cleanup", subs: ["Washing Machine Leak", "Water Heater Leak", "Dishwasher & Fridge Leak"] },
    { id: "structural-drying", label: "Structural Drying & Dehumidification", subs: ["Moisture Mapping", "Wall Cavity Drying", "Hardwood Floor Drying"] },
    { id: "emergency-board-up", label: "Emergency Board-Up", subs: ["Roof Tarping", "Window & Door Board-Up"] },
    { id: "insurance-claims", label: "Insurance Claim Assistance", subs: ["Claim Documentation", "Adjuster Coordination", "Direct Insurance Billing"] },
    { id: "roof-leak-damage", label: "Roof Leak Water Damage", subs: ["Ice Dam Damage", "Attic Water Damage"] },
    { id: "crawl-space-restoration", label: "Crawl Space Restoration", subs: ["Crawl Space Drying", "Encapsulation", "Vapor Barrier Installation"] },
    { id: "basement-waterproofing", label: "Basement Waterproofing", subs: ["Sump Pump Installation", "Foundation Drainage", "French Drains"] },
    { id: "carpet-flooring-restoration", label: "Carpet & Flooring Restoration", subs: ["Carpet Drying", "Carpet Removal & Replacement", "Subfloor Repair"] },
    { id: "contents-restoration", label: "Contents Restoration", subs: ["Pack-Out Services", "Contents Cleaning", "Document & Electronics Drying"] },
    { id: "odor-removal", label: "Odor Removal", subs: ["Ozone Treatment", "Thermal Fogging", "Deodorization"] },
    { id: "disinfection-sanitizing", label: "Disinfection & Sanitizing", subs: ["Viral Disinfection", "Antimicrobial Treatment"] },
    { id: "moisture-inspection", label: "Moisture & Damage Inspection", subs: ["Thermal Imaging", "Free Damage Assessment"] },
    { id: "air-duct-cleaning", label: "Air Duct Cleaning", subs: ["HVAC Cleaning & Sanitizing"] },
    { id: "biohazard-cleanup", label: "Biohazard Cleanup", subs: ["Trauma Scene Cleanup", "Crime Scene Cleanup", "Unattended Death Cleanup"] },
    { id: "hoarding-cleanup", label: "Hoarding Cleanup", subs: ["Junk & Debris Removal"] },
    { id: "asbestos-abatement", label: "Asbestos Abatement", subs: ["Asbestos Testing", "Asbestos Removal"] },
    { id: "lead-paint-removal", label: "Lead Paint Removal", subs: ["Lead Testing"] },
    { id: "reconstruction", label: "Reconstruction & Repairs", subs: ["Drywall Repair", "Full-Service Rebuild", "Kitchen & Bath Rebuild"] },
    { id: "commercial", label: "Commercial Restoration", subs: ["Commercial Water Damage", "Large Loss Restoration", "Property Management Services"] },
  ],
};
