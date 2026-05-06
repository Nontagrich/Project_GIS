"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, GeoJSON, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet icon issue in Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const createCustomIcon = (value: number) => {
  let color = "#ef4444"; // Critical (Red) - VCI < 21
  if (value >= 61) color = "#22c55e"; // Healthy (Green)
  else if (value >= 21) color = "#f59e0b"; // Moderate (Amber)
  
  const htmlString = `
    <div style="
      background-color: ${color};
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.4);
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    ">
      ${value.toFixed(1)}
    </div>
  `;
  
  return L.divIcon({
    html: htmlString,
    className: "custom-leaflet-icon", 
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
};

interface MapComponentProps {
  onLocationSelect: (lat: number, lon: number) => void;
  selectedLocation: { lat: number; lon: number } | null;
  overlayData?: { image: string; bounds: [[number, number], [number, number]] } | null;
  activePrediction?: number | null;
}

function LocationMarker({ onLocationSelect, selectedLocation, activePrediction }: MapComponentProps) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  if (selectedLocation === null) return null;

  const icon = activePrediction !== undefined && activePrediction !== null
    ? createCustomIcon(activePrediction)
    : defaultIcon;

  return (
    <Marker position={selectedLocation} icon={icon} />
  );
}

export default function MapComponent({ onLocationSelect, selectedLocation, overlayData, activePrediction }: MapComponentProps) {
  const [boundary, setBoundary] = useState<any>(null);
  const [mask, setMask] = useState<any>(null);

  useEffect(() => {
    fetch("/prov_nakhon_sawan.geojson")
      .then((res) => res.json())
      .then((data) => {
        setBoundary(data);
        
        if (data && data.features && data.features.length > 0) {
          const geomType = data.features[0].geometry.type;
          let originalCoords = data.features[0].geometry.coordinates;
          
          // Ensure we have the right coordinates for the hole
          let holeCoords = geomType === 'MultiPolygon' ? originalCoords[0][0] : originalCoords[0];

          const worldCoords = [
            [180, 90],
            [-180, 90],
            [-180, -90],
            [180, -90],
            [180, 90]
          ];
          
          const invertedPolygon = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    worldCoords,
                    holeCoords
                  ]
                }
              }
            ]
          };
          setMask(invertedPolygon);
        }
      })
      .catch((err) => console.error("Error loading boundary:", err));
  }, []);

  return (
    <MapContainer
      center={[15.6, 100.0]} // Center around Nakhon Sawan
      zoom={8}
      scrollWheelZoom={true}
      className="leaflet-container"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {overlayData && (
        <ImageOverlay
          url={overlayData.image}
          bounds={overlayData.bounds}
          opacity={0.65}
        />
      )}
      {mask && (
        <GeoJSON 
          data={mask} 
          style={{
            color: "transparent",
            fillColor: "#000000",
            fillOpacity: 0.75
          }} 
        />
      )}
      {boundary && (
        <GeoJSON 
          data={boundary} 
          style={{
            color: "#3b82f6",
            weight: 2,
            opacity: 1,
            fillColor: "transparent"
          }} 
        />
      )}
      <LocationMarker 
        onLocationSelect={onLocationSelect} 
        selectedLocation={selectedLocation} 
        activePrediction={activePrediction} 
      />
    </MapContainer>
  );
}
