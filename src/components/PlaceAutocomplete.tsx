import { useRef, useState } from "react";
import { LoadScript, Autocomplete } from "@react-google-maps/api";

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: { name: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

const libraries: "places"[] = ["places"];

export const PlaceAutocomplete = ({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "搜尋地點...",
  className = "input",
}: PlaceAutocompleteProps) => {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [shouldLoadMaps, setShouldLoadMaps] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();

      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const name = place.name || place.formatted_address || "";

        onPlaceSelected({ name, lat, lng });
      }
    }
  };

  const handleLoadError = (error: Error) => {
    console.error("Google Maps API 載入失敗:", error);
    setLoadError(true);
  };

  const handleFocus = () => {
    if (!shouldLoadMaps && !loadError) {
      setShouldLoadMaps(true);
    }
  };

  // 如果尚未開始載入，顯示普通 input
  if (!shouldLoadMaps) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  // 如果載入失敗，顯示普通 input 加上提示
  if (loadError) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
        <p className="text-xs text-amber-600">
          ⚠️ 地圖自動完成無法使用，請手動輸入地點名稱
        </p>
      </div>
    );
  }

  // 載入 Google Maps
  return (
    <LoadScript
      googleMapsApiKey="AIzaSyCdFLTXzYPQlYeBxZWaboqWYTJRDNsKydo"
      libraries={libraries}
      loadingElement={
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={className}
            placeholder="載入地圖服務中..."
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg
              className="animate-spin h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
      }
      onError={handleLoadError}
    >
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          componentRestrictions: { country: "tw" },
          fields: ["name", "formatted_address", "geometry"],
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
      </Autocomplete>
    </LoadScript>
  );
};
