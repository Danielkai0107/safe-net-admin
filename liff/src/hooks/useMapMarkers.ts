import { useEffect, useState } from "react";
import type { Gateway, Elder } from "../types";
import {
  clusterGateways,
  getClusterThresholdByZoom,
} from "../utils/clusterHelper";

interface UseMapMarkersOptions {
  map: google.maps.Map | null;
  gateways: Gateway[];
  selectedElder: Elder | null;
  currentLocation: { lat: number; lng: number } | null;
  onGatewayClick?: (gateway: Gateway) => void;
}

export const useMapMarkers = ({
  map,
  gateways,
  selectedElder,
  currentLocation,
  onGatewayClick,
}: UseMapMarkersOptions) => {
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(15);

  // Listen to zoom changes
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener("zoom_changed", () => {
      const zoom = map.getZoom();
      if (zoom !== undefined) {
        setZoomLevel(zoom);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    // 清除舊的標記
    markers.forEach((marker) => marker.setMap(null));

    const newMarkers: google.maps.Marker[] = [];

    // 添加當前位置標記（藍色圓點）
    if (currentLocation) {
      const currentLocationMarker = new google.maps.Marker({
        position: currentLocation,
        map,
        title: "您的位置",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 1000,
      });

      newMarkers.push(currentLocationMarker);
    }

    // 決定是否使用聚合
    const shouldCluster = gateways.length > 15 || zoomLevel < 15;

    if (shouldCluster) {
      // 使用聚合顯示
      const threshold = getClusterThresholdByZoom(zoomLevel);
      const clusters = clusterGateways(gateways, threshold);

      console.log(
        `[useMapMarkers] 聚合 ${gateways.length} 個 gateways 成 ${clusters.length} 個集群`,
      );

      clusters.forEach((cluster) => {
        if (cluster.gateways.length === 1) {
          // 單個 gateway，正常顯示
          const gateway = cluster.gateways[0];
          const marker = new google.maps.Marker({
            position: { lat: gateway.latitude!, lng: gateway.longitude! },
            map,
            title: gateway.name,
            icon: createGatewayIcon(gateway),
            optimized: false,
          });

          marker.addListener("click", () => {
            onGatewayClick?.(gateway);
          });

          newMarkers.push(marker);
        } else {
          // 多個 gateway，顯示集群圖標
          const marker = new google.maps.Marker({
            position: { lat: cluster.lat, lng: cluster.lng },
            map,
            title: `${cluster.gateways.length} 個接收點`,
            icon: createClusterIcon(cluster.gateways.length),
            optimized: false,
            zIndex: 999,
          });

          // 點擊集群時放大地圖或顯示列表
          marker.addListener("click", () => {
            if (zoomLevel < 18) {
              map.setZoom(Math.min(zoomLevel + 2, 20));
              map.panTo({ lat: cluster.lat, lng: cluster.lng });
            }
          });

          newMarkers.push(marker);
        }
      });
    } else {
      // 不使用聚合，正常顯示所有 gateway
      console.log(`[useMapMarkers] 處理 ${gateways.length} 個 gateways`);
      gateways.forEach((gateway) => {
        if (gateway.latitude && gateway.longitude) {
          const marker = new google.maps.Marker({
            position: { lat: gateway.latitude, lng: gateway.longitude },
            map,
            title: gateway.name,
            icon: createGatewayIcon(gateway),
            optimized: false,
          });

          marker.addListener("click", () => {
            onGatewayClick?.(gateway);
          });

          newMarkers.push(marker);
        } else {
          console.warn(
            `[useMapMarkers] Gateway "${gateway.name}" 缺少經緯度資料，跳過`,
          );
        }
      });
    }

    // 添加長者位置標記（使用頭像或預設圖標）
    if (selectedElder?.lastSeenLocation) {
      const location = selectedElder.lastSeenLocation;
      if (location.latitude && location.longitude) {
        const icon = selectedElder.photo
          ? {
              url: selectedElder.photo,
              scaledSize: new google.maps.Size(56, 56),
              anchor: new google.maps.Point(28, 28),
            }
          : {
              url: createElderIconDataUrl(),
              scaledSize: new google.maps.Size(56, 56),
              anchor: new google.maps.Point(28, 28),
            };

        const marker = new google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map,
          title: selectedElder.name,
          icon,
          optimized: false,
        });

        newMarkers.push(marker);
      }
    }

    setMarkers(newMarkers);

    return () => {
      newMarkers.forEach((marker) => marker.setMap(null));
    };
  }, [map, gateways, selectedElder, zoomLevel]);

  return { markers };
};

const getGatewayColor = (gateway: Gateway): string => {
  // 如果是商家且有優惠活動，顯示黃色
  if (gateway.isAD && gateway.activityTitle?.trim()) {
    return "#FFC107"; // 黃色
  }

  // 根據類型顯示顏色
  switch (gateway.type) {
    case "SAFE_ZONE":
      return "#4ECDC4";
    case "SCHOOL_ZONE":
      return "#FF6A95";
    case "OBSERVE_ZONE":
      return "#00CCEA";
    case "INACTIVE":
      return "#C4C4C4";
    default:
      return "#4ECDC4";
  }
};

const createGatewayIcon = (gateway: Gateway) => {
  const color = getGatewayColor(gateway);
  const svgPath = getGatewaySvgPath(gateway);

  // 創建 SVG 圖標 - 縮小尺寸
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2" />
      <g transform="translate(6, 6) scale(0.83)">
        ${svgPath}
      </g>
    </svg>
  `;

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
  };
};

const getGatewaySvgPath = (gateway: Gateway): string => {
  // 如果是商家且有優惠活動，顯示 campaign 圖標
  if (gateway.isAD && gateway.activityTitle?.trim()) {
    // Material Symbols: campaign (擴音器/活動圖標)
    return '<path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" fill="white"/>';
  }

  switch (gateway.type) {
    case "SCHOOL_ZONE":
      // Material Symbols Rounded: apartment
      return '<path d="M17 11V4c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v3H4c-.55 0-1 .45-1 1v13c0 .55.45 1 1 1h7v-4h2v4h7c.55 0 1-.45 1-1V12c0-.55-.45-1-1-1h-3zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm4 4H9v-2h2v2zm0-4H9V9h2v2zm0-4H9V5h2v2zm4 8h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2z" fill="white"/>';
    case "SAFE_ZONE":
    case "OBSERVE_ZONE":
    case "INACTIVE":
    default:
      // 原來的 wifi_tethering 圖標
      return '<path d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 2c0-3.31-2.69-6-6-6s-6 2.69-6 6c0 2.22 1.21 4.15 3 5.19l1-1.74c-1.19-.7-2-1.97-2-3.45 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.48-.81 2.75-2 3.45l1 1.74c1.79-1.04 3-2.97 3-5.19zM12 3C6.48 3 2 7.48 2 13c0 3.7 2.01 6.92 4.99 8.65l1-1.73C5.61 18.53 4 15.96 4 13c0-4.42 3.58-8 8-8s8 3.58 8 8c0 2.96-1.61 5.53-4 6.92l1 1.73c2.99-1.73 5-4.95 5-8.65 0-5.52-4.48-10-10-10z" fill="white"/>';
  }
};

const createElderIconDataUrl = (): string => {
  const svg = `
    <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="26" fill="#FFC107" stroke="white" stroke-width="4" />
      <g transform="translate(16, 16)">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="white"/>
      </g>
    </svg>
  `;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
};

const createClusterIcon = (count: number) => {
  // 根據數量調整大小和顏色 - 縮小尺寸
  const size = Math.min(36 + count * 1.5, 56);
  const color = count > 20 ? "#FF6A95" : count > 10 ? "#FFA500" : "#4ECDC4";

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="2" opacity="0.9" />
      <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${size / 2.8}" font-family="Arial Black, Helvetica, sans-serif" font-weight="900">
        ${count}
      </text>
    </svg>
  `;

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
};
