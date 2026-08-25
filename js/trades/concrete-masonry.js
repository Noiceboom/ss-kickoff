// ============================================================
// Trade taxonomy — Concrete & Masonry
// ============================================================
//
// Ordered by commercial importance: flatwork and repair revenue first,
// masonry trades next, specialty coatings and commercial work last.

export default {
  id: "concrete-masonry",
  label: "Concrete & Masonry",
  services: [
    { id: "driveways", label: "Concrete Driveways", subs: ["Driveway Replacement", "Driveway Repair", "Driveway Extensions"] },
    { id: "patios", label: "Concrete Patios", subs: ["Patio Installation", "Patio Extensions", "Patio Resurfacing"] },
    { id: "concrete-repair", label: "Concrete Repair", subs: ["Crack Repair", "Concrete Resurfacing", "Spalling Repair"] },
    { id: "sidewalks-walkways", label: "Sidewalks & Walkways", subs: ["Sidewalk Repair", "Walkway Installation"] },
    { id: "concrete-slabs", label: "Concrete Slabs", subs: ["Garage Slabs", "Shed & Equipment Pads", "Slab Repair"] },
    { id: "stamped-concrete", label: "Stamped & Decorative Concrete", subs: ["Concrete Staining", "Colored Concrete", "Exposed Aggregate"] },
    { id: "retaining-walls", label: "Retaining Walls", subs: ["Block Retaining Walls", "Stone Retaining Walls", "Retaining Wall Repair"] },
    { id: "concrete-steps", label: "Concrete Steps & Stoops", subs: ["Step Repair", "Porch & Stoop Replacement"] },
    { id: "pavers", label: "Pavers & Hardscaping", subs: ["Paver Patios", "Paver Driveways", "Paver Walkways", "Paver Repair"] },
    { id: "concrete-leveling", label: "Concrete Leveling & Mudjacking", subs: ["Polyurethane Foam Jacking", "Slab Jacking", "Sunken Slab Repair"] },
    { id: "foundations", label: "Concrete Foundations", subs: ["Foundation Repair", "Footings", "Foundation Pouring"] },
    { id: "brickwork", label: "Brickwork", subs: ["Brick Repair", "Brick Laying", "Brick Veneer", "Brick Mailboxes & Columns"] },
    { id: "tuckpointing", label: "Tuckpointing & Repointing", subs: ["Mortar Repair", "Mortar Matching"] },
    { id: "stonework", label: "Stonework", subs: ["Natural Stone", "Stone Veneer", "Manufactured Stone"] },
    { id: "block-work", label: "Concrete Block Work", subs: ["CMU Walls", "Block Wall Repair"] },
    { id: "chimney-masonry", label: "Chimney Masonry", subs: ["Chimney Repair", "Chimney Rebuild", "Chimney Crown Repair"] },
    { id: "concrete-sealing", label: "Concrete Sealing", subs: ["Driveway Sealing", "Paver Sealing"] },
    { id: "epoxy-floor-coating", label: "Epoxy Floor Coating", subs: ["Garage Floor Coating", "Polyaspartic Coating", "Basement Floor Coating"] },
    { id: "concrete-removal", label: "Concrete Removal & Demolition", subs: ["Concrete Tear-Out", "Haul Away"] },
    { id: "pool-decks", label: "Concrete Pool Decks", subs: ["Pool Deck Resurfacing", "Cool Deck Coating"] },
    { id: "waterproofing", label: "Masonry Waterproofing", subs: ["Basement Waterproofing", "Foundation Waterproofing", "Masonry Sealing"] },
    { id: "stucco", label: "Stucco", subs: ["Stucco Repair", "Stucco Installation", "Stucco Refinishing"] },
    { id: "firepits-outdoor-living", label: "Fire Pits & Outdoor Kitchens", subs: ["Outdoor Fireplaces", "Built-In Grills", "Seat Walls"] },
    { id: "concrete-polishing", label: "Concrete Polishing", subs: ["Polished Concrete Floors", "Concrete Grinding"] },
    { id: "curbs-gutters", label: "Curbs & Gutters", subs: ["Concrete Curbing", "Landscape Curbing"] },
    { id: "parking-lots", label: "Parking Lots", subs: ["Parking Lot Paving", "Parking Lot Repair", "Striping & Wheel Stops"] },
    { id: "drainage-grading", label: "Drainage & Grading", subs: ["Site Grading", "Trench Drains", "Excavation"] },
    { id: "commercial", label: "Commercial Concrete & Masonry", subs: ["Tilt-Up & Structural Concrete", "Loading Docks"] },
    { id: "new-construction", label: "New Construction Concrete", subs: [] },
  ],
};
