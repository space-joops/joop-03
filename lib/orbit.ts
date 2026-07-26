export interface OrbitParams {
  radius: number; // Scale relative to earth (e.g. 1.2 to 2.5)
  inclination: number; // in degrees (0 to 180)
  raan: number; // Right Ascension of Ascending Node in degrees (0 to 360)
  phase0: number; // Initial phase angle in radians (0 to 2PI)
  angularVelocity: number; // Radians per millisecond
}

export interface JoopData {
  id: string;
  name: string;
  color: string;
  orbit: OrbitParams;
  collected: number;
}

export interface OrbitalSnapshot {
  serverTime: number;
  tickSeconds: number;
  totals: { debris: number; percent: number };
  joops: JoopData[];
}

/**
 * Calculates the 2D projected (X, Y) coordinates of a Joop at a given time.
 * @param orbit The orbital parameters of the Joop
 * @param elapsedTimeMs Time elapsed since the snapshot (serverTime)
 * @param scale The pixel scale (e.g., Earth radius in pixels)
 * @returns { x, y, z } coordinates (z can be used for depth sorting/opacity)
 */
export function calculatePosition(orbit: OrbitParams, elapsedTimeMs: number, scale: number) {
  // Current angle theta
  const theta = orbit.phase0 + orbit.angularVelocity * elapsedTimeMs;

  // Convert degrees to radians
  const i = (orbit.inclination * Math.PI) / 180;
  const omega = (orbit.raan * Math.PI) / 180;

  // 3D coordinates in orbital plane
  const xOrbit = Math.cos(theta);
  const yOrbit = Math.sin(theta);

  // Rotate by inclination (around X axis)
  // y' = y * cos(i)
  // z' = y * sin(i)
  const yInc = yOrbit * Math.cos(i);
  const zInc = yOrbit * Math.sin(i);

  // Rotate by RAAN (around Z axis - which is our screen Y axis for isometric feel, but let's stick to standard 2D projection)
  // Actually, standard 2D screen: Z is depth, X and Y are screen coords.
  const x = (xOrbit * Math.cos(omega) - yInc * Math.sin(omega)) * orbit.radius * scale;
  const y = (xOrbit * Math.sin(omega) + yInc * Math.cos(omega)) * orbit.radius * scale;
  const z = zInc * orbit.radius * scale;

  return { x, y, z };
}

/**
 * Helper to generate mock snapshot data for M1 testing.
 */
export function generateMockSnapshot(): OrbitalSnapshot {
  const colors = ["#39ff14", "#ffb000", "#00ffff", "#ff3333", "#00ff66"];
  const joops: JoopData[] = Array.from({ length: 100 }).map((_, idx) => ({
    id: `joop-${idx}`,
    name: `Joop-${idx}`,
    color: colors[Math.floor(Math.random() * colors.length)],
    orbit: {
      radius: 1.1 + Math.random() * 0.8, // 1.1x to 1.9x Earth radius
      inclination: Math.random() * 180,
      raan: Math.random() * 360,
      phase0: Math.random() * Math.PI * 2,
      // Orbital speed varies by radius (Kepler's third law approx)
      angularVelocity: (Math.random() > 0.5 ? 1 : -1) * (0.0005 + Math.random() * 0.001) / Math.pow(1.5, 1.5), 
    },
    collected: Math.floor(Math.random() * 50000),
  }));

  return {
    serverTime: Date.now(),
    tickSeconds: 10,
    totals: { debris: 1284000, percent: 62.0 },
    joops,
  };
}
