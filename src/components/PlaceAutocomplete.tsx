import { useRef } from 'react';
import { LoadScript, Autocomplete } from '@react-google-maps/api';

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: { name: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

const libraries: ("places")[] = ["places"];

export const PlaceAutocomplete = ({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "搜尋地點...",
  className = "input"
}: PlaceAutocompleteProps) => {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const name = place.name || place.formatted_address || '';
        
        onPlaceSelected({ name, lat, lng });
      }
    }
  };

  return (
    <LoadScript
      googleMapsApiKey="AIzaSyCdFLTXzYPQlYeBxZWaboqWYTJRDNsKydo"
      libraries={libraries}
      loadingElement={<input type="text" className={className} placeholder="載入中..." disabled />}
    >
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          componentRestrictions: { country: "tw" }, // 限制搜尋範圍在台灣
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
