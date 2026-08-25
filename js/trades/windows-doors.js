// ============================================================
// Trade taxonomy — Windows & Doors
// ============================================================
//
// Ordered by commercial importance: replacement and repair revenue
// first, product lines next, niche and new-construction work last.

export default {
  id: "windows-doors",
  label: "Windows & Doors",
  services: [
    { id: "window-replacement", label: "Window Replacement", subs: ["Full-Frame Window Replacement", "Insert Window Replacement", "Whole-Home Window Replacement"] },
    { id: "window-repair", label: "Window Repair", subs: ["Broken Window Repair", "Foggy Window Repair", "Window Seal Repair", "Window Balance & Hardware Repair"] },
    { id: "entry-doors", label: "Entry Doors", subs: ["Front Door Replacement", "Fiberglass Entry Doors", "Steel Entry Doors", "Wood Entry Doors"] },
    { id: "patio-doors", label: "Patio Doors", subs: ["Sliding Patio Doors", "French Doors", "Multi-Slide & Folding Doors"] },
    { id: "glass-replacement", label: "Glass Replacement", subs: ["Insulated Glass Replacement", "Tempered Glass", "Emergency Glass Board-Up"] },
    { id: "window-installation", label: "Window Installation", subs: ["New Window Installation", "Custom Window Installation"] },
    { id: "door-installation", label: "Door Installation", subs: ["Exterior Door Installation", "Prehung Door Installation"] },
    { id: "door-repair", label: "Door Repair", subs: ["Sliding Door Roller Repair", "Door Frame Repair", "Door Hardware & Lock Repair"] },
    { id: "vinyl-windows", label: "Vinyl Windows", subs: [] },
    { id: "double-hung-windows", label: "Double-Hung Windows", subs: ["Single-Hung Windows"] },
    { id: "casement-windows", label: "Casement Windows", subs: ["Awning Windows"] },
    { id: "sliding-windows", label: "Sliding Windows", subs: [] },
    { id: "bay-bow-windows", label: "Bay & Bow Windows", subs: ["Garden Windows"] },
    { id: "picture-windows", label: "Picture Windows", subs: [] },
    { id: "energy-efficient-windows", label: "Energy-Efficient Windows", subs: ["Low-E Glass", "Double-Pane Windows", "Triple-Pane Windows"] },
    { id: "impact-windows", label: "Hurricane & Impact Windows", subs: ["Impact Doors", "Hurricane Shutters"] },
    { id: "storm-doors", label: "Storm Doors", subs: ["Storm Windows"] },
    { id: "security-doors", label: "Security Doors", subs: ["Screen Security Doors"] },
    { id: "screen-repair", label: "Screen Repair & Replacement", subs: ["Window Screen Repair", "Screen Door Repair"] },
    { id: "skylights", label: "Skylights", subs: ["Skylight Installation", "Skylight Repair", "Skylight Replacement"] },
    { id: "interior-doors", label: "Interior Doors", subs: ["Closet Doors", "Barn Doors", "Pocket Doors"] },
    { id: "egress-windows", label: "Egress Windows", subs: ["Basement Egress Windows", "Window Well Installation"] },
    { id: "window-door-hardware", label: "Window & Door Hardware", subs: ["Locks & Handles", "Weatherstripping"] },
    { id: "wood-rot-repair", label: "Wood Rot & Frame Repair", subs: ["Sill Replacement", "Trim & Casing Repair"] },
    { id: "sunrooms", label: "Sunrooms & Enclosures", subs: ["Three-Season Rooms", "Patio Enclosures"] },
    { id: "garage-entry-doors", label: "Garage Entry Doors", subs: [] },
    { id: "commercial", label: "Commercial Windows & Doors", subs: ["Storefront Doors", "Commercial Glass", "Commercial Window Replacement"] },
    { id: "new-construction", label: "New Construction Windows & Doors", subs: [] },
  ],
};
