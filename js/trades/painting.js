// ============================================================
// Trade taxonomy — Painting
// ============================================================

export default {
  id: "painting",
  label: "Painting",
  services: [
    { id: "interior-painting", label: "Interior Painting", subs: ["Wall Painting", "Ceiling Painting", "Trim & Baseboard Painting", "Accent Walls"] },
    { id: "exterior-painting", label: "Exterior Painting", subs: ["House Painting", "Siding Painting", "Trim & Fascia Painting", "Front Door Painting"] },
    { id: "cabinet-painting", label: "Cabinet Painting", subs: ["Kitchen Cabinet Painting", "Cabinet Refinishing", "Bathroom Vanity Painting"] },
    { id: "residential", label: "Residential Painting", subs: ["Whole-Home Painting", "Single Room Painting"] },
    { id: "commercial", label: "Commercial Painting", subs: ["Office Painting", "Retail & Restaurant Painting", "Warehouse Painting", "Apartment & Multi-Family Painting"] },
    { id: "drywall-repair", label: "Drywall Repair", subs: ["Patching & Texturing", "Water Damage Repair", "Drywall Installation"] },
    { id: "popcorn-ceiling-removal", label: "Popcorn Ceiling Removal", subs: ["Ceiling Texturing", "Smooth Ceiling Refinishing"] },
    { id: "wallpaper", label: "Wallpaper Removal & Installation", subs: ["Wallpaper Removal", "Wallpaper Installation"] },
    { id: "deck-fence-staining", label: "Deck & Fence Staining", subs: ["Deck Staining", "Deck Sealing", "Fence Painting"] },
    { id: "pressure-washing", label: "Pressure Washing", subs: ["House Washing", "Deck & Patio Cleaning", "Surface Prep Washing"] },
    { id: "wood-rot-repair", label: "Wood Rot & Carpentry Repair", subs: ["Siding Replacement", "Trim Replacement"] },
    { id: "stucco-painting", label: "Stucco Painting & Repair", subs: ["Stucco Patching", "Elastomeric Coatings"] },
    { id: "brick-painting", label: "Brick Painting & Limewash", subs: ["Brick Staining", "German Schmear"] },
    { id: "epoxy-flooring", label: "Epoxy Floor Coatings", subs: ["Garage Floor Coating", "Basement Floor Coating", "Commercial Epoxy Floors"] },
    { id: "concrete-coatings", label: "Concrete Staining & Sealing", subs: ["Driveway Sealing", "Patio Staining"] },
    { id: "color-consultation", label: "Color Consultation", subs: [] },
    { id: "specialty-finishes", label: "Specialty & Faux Finishes", subs: ["Venetian Plaster", "Faux Wood Graining", "Metallic Finishes"] },
    { id: "staining-varnishing", label: "Staining & Varnishing", subs: ["Cabinet Staining", "Trim & Door Staining"] },
    { id: "garage-door-painting", label: "Garage Door Painting", subs: [] },
    { id: "metal-painting", label: "Metal & Railing Painting", subs: ["Handrail Painting", "Rust Treatment"] },
    { id: "lead-paint", label: "Lead Paint Removal & Encapsulation", subs: [] },
    { id: "graffiti-removal", label: "Graffiti Removal", subs: [] },
    { id: "industrial-coatings", label: "Industrial Coatings", subs: ["Warehouse Floor Coatings", "Tank & Equipment Coatings"] },
    { id: "line-striping", label: "Parking Lot Line Striping", subs: ["ADA Striping", "Warehouse Floor Marking"] },
    { id: "power-washing-roof", label: "Roof Cleaning & Coating", subs: [] },
    { id: "hoa-painting", label: "HOA & Property Management Painting", subs: [] },
    { id: "new-construction", label: "New Construction Painting", subs: [] },
    { id: "maintenance-plan", label: "Painting Maintenance Programs", subs: [] },
  ],
};
