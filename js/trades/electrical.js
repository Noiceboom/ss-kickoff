// ============================================================
// Trade taxonomy — Electrical
// ============================================================

export default {
  id: "electrical",
  label: "Electrical",
  services: [
    { id: "emergency", label: "Emergency Electrician", subs: ["24 Hour Electrical Repair", "Power Outage Repair"] },
    { id: "electrical-repairs", label: "Electrical Repairs", subs: ["Electrical Troubleshooting", "Electrical Diagnosis"] },
    { id: "panel-upgrades", label: "Electrical Panel Upgrades", subs: ["Panel Replacement", "Sub Panel Installation", "200 Amp Service Upgrade"] },
    { id: "circuit-breakers", label: "Circuit Breakers", subs: ["Breaker Replacement", "Tripping Breaker Repair"] },
    { id: "wiring-rewiring", label: "Wiring & Rewiring", subs: ["Whole-home Rewiring", "Aluminum Wiring Replacement", "Knob & Tube Replacement"] },
    { id: "outlets-switches", label: "Outlets & Switches", subs: ["Outlet Installation", "Outlet Repair", "GFCI Outlets", "Dimmer Switches"] },
    { id: "lighting-installation", label: "Lighting Installation", subs: ["Recessed Lighting", "Chandelier Installation", "Under Cabinet Lighting", "Light Fixture Replacement"] },
    { id: "ceiling-fans", label: "Ceiling Fans", subs: ["Ceiling Fan Installation", "Ceiling Fan Repair"] },
    { id: "generators", label: "Generators", subs: ["Generator Installation", "Whole-home Standby Generators", "Generator Repair", "Generator Maintenance"] },
    { id: "ev-chargers", label: "EV Charger Installation", subs: ["Level 2 Charger Installation", "Tesla Charger Installation"] },
    { id: "outdoor-lighting", label: "Outdoor & Landscape Lighting", subs: ["Security Lighting", "Landscape Lighting", "Holiday Lighting"] },
    { id: "surge-protection", label: "Whole-home Surge Protection", subs: [] },
    { id: "electrical-inspection", label: "Electrical Inspections", subs: ["Home Safety Inspection", "Code Compliance Inspection"] },
    { id: "smoke-detectors", label: "Smoke & Carbon Monoxide Detectors", subs: [] },
    { id: "appliance-wiring", label: "Appliance Wiring & Hookups", subs: ["Dryer Outlet Installation", "Range & Oven Hookups"] },
    { id: "dedicated-circuits", label: "Dedicated Circuits", subs: [] },
    { id: "hot-tub-wiring", label: "Hot Tub & Pool Wiring", subs: [] },
    { id: "home-automation", label: "Smart Home & Automation", subs: ["Smart Switches", "Smart Home Wiring"] },
    { id: "security-cameras", label: "Security Cameras & Doorbells", subs: ["Video Doorbell Installation", "Camera Installation"] },
    { id: "data-cabling", label: "Data & Network Cabling", subs: ["Ethernet Wiring", "Low Voltage Wiring"] },
    { id: "exhaust-fans", label: "Exhaust & Attic Fans", subs: ["Bathroom Fan Installation"] },
    { id: "meter-service", label: "Meter Base & Service Entrance", subs: ["Weatherhead Repair", "Service Riser Repair"] },
    { id: "underground-wiring", label: "Underground Wiring & Trenching", subs: [] },
    { id: "battery-backup", label: "Battery Backup & Solar Storage", subs: ["Solar Panel Hookups"] },
    { id: "remodel-wiring", label: "Remodel & Addition Wiring", subs: ["Basement Wiring", "Kitchen & Bath Wiring"] },
    { id: "residential", label: "Residential Electrical", subs: [] },
    { id: "commercial", label: "Commercial Electrical", subs: ["Commercial Lighting", "Tenant Improvements", "Three Phase Power"] },
    { id: "new-construction", label: "New Construction Wiring", subs: [] },
    { id: "maintenance-plan", label: "Maintenance Plans", subs: [] },
  ],
};
