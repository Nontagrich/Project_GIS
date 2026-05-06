# CODE EXPLANATION 

**Project:** VCI (Vegetation Condition Index) Prediction Frontend Dashboard  
**Framework:** Next.js, React, React-Leaflet  

---

## FILE 1: next.config.ts
**PURPOSE:** Configuration file for Next.js routing and API proxying.

### OVERVIEW
This configuration file sets up a proxy rewrite rule. It ensures that any frontend requests made to `/api/` are seamlessly forwarded to the FastAPI backend without running into Cross-Origin Resource Sharing (CORS) issues.

### SECTION-BY-SECTION EXPLANATION

#### [API Proxy Setup]
- Intercepts all requests starting with `/api/:path*`.
- Routes these requests to the local backend server running at `http://127.0.0.1:8000/:path*`.
- Keeps frontend API calls clean and relative (e.g., `fetch('/api/predict')`).

---

## FILE 2: src/app/page.tsx
**PURPOSE:** The main dashboard component handling state management, API communication, and UI layout.

### OVERVIEW
This is the "Brain" of the frontend. It manages the primary application state such as the selected geographical location, the time period (Year/Quarter), and the fetched prediction results. It acts as the bridge connecting user interactions on the map with the backend machine learning models.

### SECTION-BY-SECTION EXPLANATION

#### [State Management]
- **`location`**: Stores the exact `{ lat, lon }` coordinates clicked by the user.
- **`year` & `activeQuarter`**: Tracks the selected temporal data to query.
- **`results`**: Stores the JSON prediction data returned from the backend models.
- **`overlayData` & `activeBand`**: Manages the currently selected raster image (e.g., Soil Moisture) and its geographical bounding box.

#### [The Prediction Flow (Clicking the Map)]
- Triggered by the `handleLocationSelect` function when the map is clicked.
- **Loading State:** Activates a visual spinner while processing.
- **Concurrent API Calls:** Utilizes `Promise.all()` to fire 4 concurrent POST requests to `/api/predict` (Q1 through Q4) to fetch yearly data simultaneously.
- **Data Processing & UI Update:** Consolidates the 4 quarters of data into a single state object, dynamically updating the VCI comparisons (color-coded Green/Amber/Red) and key indicators.

#### [The Overlay Flow (Loading Map Layers)]
- Triggered when a user selects a raster band (like "Soil_Moisture").
- The `useEffect` hook monitors changes to `activeBand` and calls `fetchOverlay()`.
- Requests a rendered image from `/api/render-band`.
- Updates the map with the returned Base64 image and its precise geographical coordinates.

---

## FILE 3: src/app/MapComponent.tsx
**PURPOSE:** Interactive map visualization component using Leaflet and React-Leaflet.

### OVERVIEW
This is the "Visual" layer of the application. It renders the interactive map, overlays the Nakhon Sawan provincial boundary, and displays data-driven custom markers. Because Leaflet relies on the browser's `window` object, this component is dynamically imported into `page.tsx` with SSR disabled.

### SECTION-BY-SECTION EXPLANATION

#### [Rendering the Map & Masking]
- Uses `<MapContainer>` centered on Nakhon Sawan with a base `<TileLayer>` from Carto.
- **The Masking Trick:** Fetches the `prov_nakhon_sawan.geojson` boundary. It creates an "Inverted Polygon" by drawing a massive world-sized polygon and cutting a hole matching the province's shape.
- Fills the world polygon with 75% black opacity, creating a spotlight effect that visually highlights only Nakhon Sawan.

#### [Dynamic Image Overlays]
- Listens for `overlayData` passed down from `page.tsx`.
- Uses the `<ImageOverlay>` component to stretch the returned `.tif` raster image perfectly over the provided bounding box coordinates.

#### [Smart Location Markers]
- Implements `useMapEvents` to listen for map `click` events, passing the resulting coordinates back up to the parent component.
- **Custom Marker (`createCustomIcon`):** Replaces the standard blue pin with dynamic HTML/CSS circles.
- Color-codes the marker based on the predicted VCI value (Green for >=70, Amber for >=35, Red for <35) and displays the numerical value directly inside the pin on the map.
