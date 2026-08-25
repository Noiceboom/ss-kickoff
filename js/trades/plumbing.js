// ============================================================
// Trade taxonomy — Plumbing
// ============================================================
//
// Reference implementation for every other trade file.
//
// `id` values are load-bearing: a scraped service whose id matches one
// here merges into that row rather than appearing twice. The first 20
// below deliberately match the ids the Benjamin Franklin scrape produces.

export default {
  id: "plumbing",
  label: "Plumbing",
  services: [
    { id: "emergency", label: "Emergency Plumbing", subs: [] },
    { id: "drains", label: "Drains", subs: ["Drain Cleaning", "Drain Installation", "Hydrojetting", "Clogged Drains"] },
    { id: "water-heaters", label: "Water Heaters", subs: ["Tankless Water Heaters", "Water Heater Installation", "Water Heater Repair"] },
    { id: "sewers", label: "Sewers", subs: ["Sewer Line Repair", "Sewer Line Replacement and Installation", "Trenchless Sewers"] },
    { id: "toilets", label: "Toilets", subs: ["Toilet Repair", "Toilet Installation"] },
    { id: "leak-detection", label: "Leak Detection", subs: ["Leak Repair", "Slab Leaks"] },
    { id: "piping-repiping", label: "Piping & Repiping", subs: ["Frozen Pipes", "Leaking Pipes", "Pipe Repair", "Whole-home Repipe"] },
    { id: "plumbing-repairs", label: "Plumbing Repairs", subs: ["Plumbing Installation", "Plumbing Inspection & Diagnosis"] },
    { id: "sinks", label: "Sinks", subs: ["Sink Installation", "Sink Repair"] },
    { id: "faucets", label: "Faucets", subs: [] },
    { id: "showers", label: "Showers", subs: ["Shower Installation", "Shower Repair"] },
    { id: "bathtubs", label: "Bathtubs", subs: [] },
    { id: "garbage-disposals", label: "Garbage Disposals", subs: ["Garbage Disposal Installation", "Garbage Disposal Repair"] },
    { id: "pumps", label: "Pumps", subs: ["Sump Pumps", "Well Pumps", "Ejector Pumps"] },
    { id: "gas-lines", label: "Gas Lines", subs: ["Gas Line Repair", "Gas Line Installation"] },
    { id: "water-lines", label: "Water Lines", subs: ["Water Main Repair", "Water Line Replacement"] },
    { id: "water-treatment", label: "Water Treatment", subs: ["Water Softeners", "Filtration Systems", "Reverse Osmosis"] },
    { id: "bathroom", label: "Bathroom Plumbing", subs: ["Bathroom Remodel Plumbing"] },
    { id: "residential", label: "Residential Plumbing", subs: [] },
    { id: "commercial", label: "Commercial Plumbing", subs: [] },
    { id: "backflow-testing", label: "Backflow Testing & Certification", subs: [] },
    { id: "hydro-jetting", label: "Hydro Jetting", subs: [] },
    { id: "camera-inspection", label: "Sewer Camera Inspection", subs: [] },
    { id: "septic", label: "Septic Services", subs: ["Septic Pumping", "Septic Repair"] },
    { id: "sprinkler-irrigation", label: "Sprinkler & Irrigation Lines", subs: [] },
    { id: "water-pressure", label: "Water Pressure & Regulators", subs: [] },
    { id: "new-construction", label: "New Construction Plumbing", subs: [] },
    { id: "maintenance-plan", label: "Maintenance Plans", subs: [] },
  ],
};
