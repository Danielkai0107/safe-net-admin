import type { Gateway } from "../types";

export interface ClusterPoint {
  lat: number;
  lng: number;
  gateways: Gateway[];
}

/**
 * Calculate distance between two points in meters
 */
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Cluster gateways based on distance
 * @param gateways Array of gateways to cluster
 * @param distanceThreshold Distance threshold in meters (default 100m)
 * @returns Array of cluster points
 */
export const clusterGateways = (
  gateways: Gateway[],
  distanceThreshold: number = 100,
): ClusterPoint[] => {
  const validGateways = gateways.filter(
    (g) => g.latitude !== undefined && g.longitude !== undefined,
  );

  if (validGateways.length === 0) return [];

  const clusters: ClusterPoint[] = [];
  const visited = new Set<string>();

  validGateways.forEach((gateway) => {
    if (visited.has(gateway.id)) return;

    const cluster: Gateway[] = [gateway];
    visited.add(gateway.id);

    // Find nearby gateways
    validGateways.forEach((otherGateway) => {
      if (visited.has(otherGateway.id)) return;

      const distance = calculateDistance(
        gateway.latitude!,
        gateway.longitude!,
        otherGateway.latitude!,
        otherGateway.longitude!,
      );

      if (distance <= distanceThreshold) {
        cluster.push(otherGateway);
        visited.add(otherGateway.id);
      }
    });

    // Calculate cluster center
    const centerLat =
      cluster.reduce((sum, g) => sum + g.latitude!, 0) / cluster.length;
    const centerLng =
      cluster.reduce((sum, g) => sum + g.longitude!, 0) / cluster.length;

    clusters.push({
      lat: centerLat,
      lng: centerLng,
      gateways: cluster,
    });
  });

  return clusters;
};

/**
 * Calculate distance-based cluster threshold based on map zoom level
 * @param zoomLevel Current map zoom level
 * @returns Distance threshold in meters
 */
export const getClusterThresholdByZoom = (zoomLevel: number): number => {
  // 平衡的聚合閾值設定
  if (zoomLevel <= 10) return 3000; // 3km
  if (zoomLevel <= 12) return 1000; // 1km
  if (zoomLevel <= 14) return 300; // 300m
  if (zoomLevel <= 16) return 100; // 100m
  return 50; // 50m
};
