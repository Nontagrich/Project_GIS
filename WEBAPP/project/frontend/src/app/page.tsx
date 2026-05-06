"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import "./globals.css";

// Dynamically import map component with SSR disabled
const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="loading-overlay">
      <div className="spinner"></div>
      Loading Map...
    </div>
  ),
});

interface PredictionResult {
  prediction: number;
  features: Record<string, number>;
  has_autogluon: boolean;
}

const getVCILabel = (value: number) => {
  if (value >= 61) return { text: "Healthy", color: "#22c55e" }; // Green
  if (value >= 21) return { text: "Moderate", color: "#f59e0b" }; // Amber
  return { text: "Critical", color: "#ef4444" }; // Red
};

export default function Home() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<Record<number, PredictionResult> | null>(null);
  const [activeQuarter, setActiveQuarter] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number>(2022);
  const [overlayData, setOverlayData] = useState<{ image: string; bounds: [[number, number], [number, number]] } | null>(null);
  const [loadingOverlay, setLoadingOverlay] = useState<boolean>(false);
  const [activeBand, setActiveBand] = useState<string | null>(null);

  useEffect(() => {
    if (activeBand) {
      const fetchOverlay = async () => {
        setLoadingOverlay(true);
        try {
          const res = await fetch(`/api/render-band?year=${year}&quarter=${activeQuarter}&band=${activeBand}`);
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to load overlay");
          }
          const data = await res.json();
          setOverlayData({ image: data.image, bounds: data.bounds });
        } catch (err: any) {
          alert("Error loading overlay: " + err.message);
          setOverlayData(null);
          setActiveBand(null);
        } finally {
          setLoadingOverlay(false);
        }
      };
      fetchOverlay();
    } else {
      setOverlayData(null);
    }
  }, [activeBand, activeQuarter, year]);

  const loadOverlay = (band: string) => {
    setActiveBand(band);
  };

  const handleLocationSelect = useCallback(async (lat: number, lon: number) => {
    setLocation({ lat, lon });
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const promises = [1, 2, 3, 4].map(async (q) => {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, quarter: q, year }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(`Q${q}: ` + (errData.detail || "Failed to fetch"));
        }
        return await response.json();
      });

      const dataArray = await Promise.all(promises);
      const newResults: Record<number, PredictionResult> = {};
      dataArray.forEach(d => { newResults[d.quarter] = d; });
      setResults(newResults);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (location) {
      handleLocationSelect(location.lat, location.lon);
    }
  }, [year, handleLocationSelect]);

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">VCI Prediction Model</h1>
        <p className="subtitle">Interactive Spatial Analysis for Raster Data</p>
      </div>

      <div className="main-layout">
        <div className="map-container">
          <MapComponent
            onLocationSelect={handleLocationSelect}
            selectedLocation={location}
            overlayData={overlayData}
            activePrediction={results ? results[activeQuarter].prediction : null}
          />
          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              Analyzing Pixel Data...
            </div>
          )}
          {loadingOverlay && (
            <div className="skeleton-overlay">
              <div className="skeleton-map"></div>
              <div style={{ marginTop: "1.5rem", color: "#60a5fa", fontWeight: "600", letterSpacing: "1px" }}>
                Rendering Map Layer...
              </div>
            </div>
          )}
        </div>

        <div className="glass controls-panel" style={{ maxHeight: "800px", overflowY: "auto" }}>
          <div className="instructions" style={{ marginBottom: "1rem" }}>
            <strong>How to use:</strong> Select a year and click anywhere on the map. The system will extract raster values and predict VCI for all 4 quarters to compare.
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Select Year:</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[2022, 2023].map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    borderRadius: "8px",
                    background: year === y ? "var(--accent-color)" : "rgba(255,255,255,0.1)",
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: year === y ? "bold" : "normal"
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Map Overlay Layer (Q{activeQuarter}):</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["Target_VCI", "Salinity_Index", "LST_Thermal", "Soil_Moisture"].map((b) => (
                <button
                  key={b}
                  onClick={() => loadOverlay(b)}
                  disabled={loadingOverlay}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "8px",
                    background: activeBand === b ? "var(--accent-color)" : "rgba(255,255,255,0.1)",
                    border: "1px solid var(--accent-color)",
                    color: "white",
                    cursor: loadingOverlay ? "wait" : "pointer",
                    fontSize: "0.8rem",
                    fontWeight: activeBand === b ? "bold" : "normal"
                  }}
                >
                  {loadingOverlay && activeBand === b ? "..." : b}
                </button>
              ))}
              <button
                onClick={() => setActiveBand(null)}
                style={{
                  padding: "0.5rem",
                  borderRadius: "8px",
                  background: "#ef4444",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                Clear Overlay
              </button>
            </div>
          </div>

          {location && (
            <div className="coordinate-display">
              Lat: {location.lat.toFixed(4)}, Lon: {location.lon.toFixed(4)}
            </div>
          )}

          {error && (
            <div className="results-card" style={{ borderLeft: "4px solid #ef4444" }}>
              <div className="result-label" style={{ color: "#ef4444" }}>Error</div>
              <div className="result-value" style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>{error}</div>
            </div>
          )}

          {results && !error && (
            <>
              <div className="results-card">
                <div className="result-label" style={{ marginBottom: "1rem" }}>Quarterly VCI Comparison</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                  {[1, 2, 3, 4].map(q => (
                    <div
                      key={q}
                      onClick={() => setActiveQuarter(q)}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "8px",
                        background: activeQuarter === q ? "rgba(59, 130, 246, 0.2)" : "rgba(0,0,0,0.2)",
                        border: activeQuarter === q ? "1px solid var(--accent-color)" : "1px solid transparent",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Quarter {q}</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: getVCILabel(results[q].prediction).color }}>
                        {results[q].prediction.toFixed(2)}
                      </div>
                      <div style={{ fontSize: "0.85rem", fontWeight: "bold", marginTop: "0.25rem", color: getVCILabel(results[q].prediction).color, padding: "0.1rem 0.5rem", borderRadius: "4px", background: "rgba(255,255,255,0.1)", display: "inline-block" }}>
                        {getVCILabel(results[q].prediction).text}
                      </div>
                    </div>
                  ))}
                </div>
                {!results[1].has_autogluon && (
                  <div style={{ fontSize: "0.75rem", color: "#fbbf24", textAlign: "center" }}>
                    ⚠️ Autogluon model not loaded. Using fallback prediction.
                  </div>
                )}
              </div>

              <div className="results-card">
                <div className="result-label" style={{ marginBottom: "1rem" }}>
                  Key Indicators (Q{activeQuarter})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.75rem" }}>
                  {[
                    { label: "Salinity Index", key: "Salinity_Index", color: "#facc15" },
                    { label: "Thermal (LST)", key: "LST_Thermal", color: "#ef4444" },
                    { label: "Soil Moisture", key: "Soil_Moisture", color: "#60a5fa" }
                  ].map(indicator => (
                    <div
                      key={indicator.key}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "8px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                        {indicator.label}
                      </div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: indicator.color }}>
                        {results[activeQuarter].features[indicator.key] !== undefined
                          ? (() => {
                            let val = results[activeQuarter].features[indicator.key];
                            if (indicator.key === "LST_Thermal") {
                              // Convert Kelvin to Celsius if the value seems to be in Kelvin
                              if (val > 200) val -= 273.15;
                              return val.toFixed(1) + " °C";
                            }
                            return val.toFixed(2);
                          })()
                          : "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
