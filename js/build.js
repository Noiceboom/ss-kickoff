// The build stamp, on its own so anything can read it.
//
// It used to live in app.js. The readout needs it to stamp exports, and
// app.js imports every module — so reading it from there closed an import
// cycle and left MODULES uninitialised at load time.
export const BUILD = "b50";
