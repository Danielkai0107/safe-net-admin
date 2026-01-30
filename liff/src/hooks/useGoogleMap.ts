import { useEffect, useRef, useState } from "react";

interface UseGoogleMapOptions {
  center: { lat: number; lng: number };
  zoom: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export const useGoogleMap = (options: UseGoogleMapOptions) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    // 檢查 Google Maps API 是否已載入
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsLoaded(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };

    checkGoogleMaps();
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || initializedRef.current) return;

    initializedRef.current = true;

    const mapInstance = new google.maps.Map(mapRef.current, {
      center: options.center,
      zoom: options.zoom,
      minZoom: 13, // 限制最小縮放，約區域範圍
      maxZoom: 20,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      gestureHandling: "greedy",
      disableDefaultUI: true,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "poi.business",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "transit",
          elementType: "labels.icon",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    setMap(mapInstance);
    options.onMapReady?.(mapInstance);
  }, [isLoaded]);

  // 注意：不要在這裡持續更新地圖中心，否則會干擾用戶操作
  // 地圖初始化時已經設定了中心點，之後由用戶自行控制

  return { mapRef, map, isLoaded };
};
