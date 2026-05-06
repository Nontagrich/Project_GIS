from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import rasterio
from rasterio.enums import Resampling
import pandas as pd
import os
import base64
import numpy as np
from io import BytesIO
from PIL import Image
import matplotlib.pyplot as plt

app = FastAPI(title="VCI Predictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Autogluon model with fallback
MODEL_PATH = "D:/work/GIS/project/autogluon_vci_model/autogluon_vci_model"
try:
    from autogluon.tabular import TabularPredictor
    predictor = TabularPredictor.load(MODEL_PATH)
    HAS_AUTOGLUON = True
    print("Successfully loaded Autogluon model.")
except Exception as e:
    predictor = None
    HAS_AUTOGLUON = False
    print(f"Failed to load Autogluon model ({e}). Using fallback prediction.")

class PredictionRequest(BaseModel):
    lat: float
    lon: float
    quarter: int
    year: int = 2022

# Define bands for the TIFF based on our discovery
BANDS = [
    "Blue", "Green", "Red", "NIR", "LST_Thermal", "Rain_Sum", 
    "Soil_Moisture", "Air_Temp", "ET", "DEM", "Soil_Texture", "Salinity_Index", "Target_VCI"
]

# Features expected by Autogluon:
# ['Blue', 'Green', 'Red', 'NIR', 'NDVI', 'NDWI', 'SAVI', 'thermal', 'et', 'dem', 'soil_texture']

@app.post("/predict")
def predict(req: PredictionRequest):
    if req.quarter not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Quarter must be between 1 and 4")
        
    tiff_path = f"D:/work/GIS/project/Geotiff_Data/{req.year}/VCI_{req.year}_Q{req.quarter}.tif"
    if not os.path.exists(tiff_path):
        raise HTTPException(status_code=404, detail=f"TIFF file for {req.year} Q{req.quarter} not found")
        
    try:
        with rasterio.open(tiff_path) as src:
            # Check if point is within bounds
            row, col = src.index(req.lon, req.lat)
            if row < 0 or col < 0 or row >= src.height or col >= src.width:
                raise HTTPException(status_code=400, detail="Coordinates are out of bounds for the raster data.")
            
            # Read pixel values for all bands at the given location
            # Read a 1x1 window
            window = rasterio.windows.Window(col, row, 1, 1)
            data = src.read(window=window)
            
            # Flatten the data
            band_values = data[:, 0, 0].tolist()
            
            if len(band_values) < 12:
                raise HTTPException(status_code=500, detail="TIFF file does not have enough bands.")
            
            # Create raw features dictionary from TIFF
            raw_features = {BANDS[i]: band_values[i] for i in range(13)}
            
            # --- Outlier & NoData Check ---
            # 1. Check for -9999 in any band (NoData)
            for band_name, val in raw_features.items():
                if float(val) <= -9999:
                    raise HTTPException(status_code=400, detail=f"NoData (-9999) found in band '{band_name}' at this location.")
            
    
            
            # Calculate spectral indices (add 1e-8 to avoid division by zero)
            blue = float(raw_features["Blue"])
            green = float(raw_features["Green"])
            red = float(raw_features["Red"])
            nir = float(raw_features["NIR"])
            
            ndvi = (nir - red) / (nir + red + 1e-8)
            ndwi = (green - nir) / (green + nir + 1e-8)
            savi = ((nir - red) / (nir + red + 0.5)) * 1.5
            
            # Prepare features dictionary matching EXACTLY what Autogluon expects
            features = {
                "Blue": [blue],
                "Green": [green],
                "Red": [red],
                "NIR": [nir],
                "NDVI": [float(ndvi)],
                "NDWI": [float(ndwi)],
                "SAVI": [float(savi)],
                "thermal": [float(raw_features["LST_Thermal"])],
                "et": [float(raw_features["ET"])],
                "dem": [float(raw_features["DEM"])],
                "soil_texture": [float(raw_features["Soil_Texture"])]
            }
            
            # Prepare dataframe for prediction
            df = pd.DataFrame(features)
            
            # Predict
            if HAS_AUTOGLUON:
                prediction = predictor.predict(df).iloc[0]
            else:
                # Fallback mock prediction
                prediction = float(features["NIR"][0] * 0.5 + features["NDVI"][0] * 10.0)
                
            # Handle NaN values for JSON compatibility
            import numpy as np
            def sanitize(v):
                if isinstance(v, (float, np.float32, np.float64)) and (np.isnan(v) or np.isinf(v)):
                    return 0.0
                return v

            # Prepare features to display in frontend (All raw bands + calculated indices, excluding Target_VCI)
            display_features = {}
            for k, v in raw_features.items():
                if k != "Target_VCI":
                    display_features[k] = v
            display_features["NDVI"] = float(ndvi)
            display_features["NDWI"] = float(ndwi)
            display_features["SAVI"] = float(savi)

            return {
                "success": True,
                "lat": req.lat,
                "lon": req.lon,
                "year": req.year,
                "quarter": req.quarter,
                "prediction": sanitize(float(prediction)),
                "features": {k: sanitize(float(v)) for k, v in display_features.items()},
                "has_autogluon": HAS_AUTOGLUON
            }
            
    except rasterio.errors.RasterioIOError:
        raise HTTPException(status_code=500, detail="Error reading raster file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/render-band")
def render_band(year: int, quarter: int, band: str):
    tiff_path = f"D:/work/GIS/project/{year}/VCI_{year}_Q{quarter}.tif"
    if not os.path.exists(tiff_path):
        raise HTTPException(status_code=404, detail=f"TIFF file for {year} Q{quarter} not found")
        
    try:
        with rasterio.open(tiff_path) as src:
            if band not in BANDS:
                raise HTTPException(status_code=400, detail=f"Invalid band. Available: {BANDS}")
            
            band_idx = BANDS.index(band)
            
            # Downsample for faster rendering (limit max dimension to 800px)
            scale = 1.0
            max_dim = max(src.height, src.width)
            if max_dim > 800:
                scale = 800.0 / max_dim
                
            out_shape = (int(src.height * scale), int(src.width * scale))
            
            # Read only the requested band with nearest resampling (fastest)
            data = src.read(
                band_idx + 1,
                out_shape=out_shape,
                resampling=Resampling.nearest
            )
            
            # Create a mask for valid data
            valid_mask = data > -9999
            
            if not np.any(valid_mask):
                raise HTTPException(status_code=404, detail="No valid data in this band")
                
            # Get bounding box for Leaflet ImageOverlay: [[lat1, lon1], [lat2, lon2]]
            bounds = src.bounds
            leaflet_bounds = [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]
            
            # Select Colormap based on band
            cmap_name = 'RdYlGn' if 'VCI' in band or 'NDVI' in band else 'plasma'
            if 'Salinity' in band:
                cmap_name = 'YlOrRd'
                
            # Normalize data to 0-1 range based on percentiles for better contrast
            data_valid = data[valid_mask]
            
            # Subsample for faster percentile calculation if the array is large
            if len(data_valid) > 10000:
                data_sample = np.random.choice(data_valid, 10000, replace=False)
            else:
                data_sample = data_valid
                
            vmin, vmax = np.percentile(data_sample, 2), np.percentile(data_sample, 98)
            
            # Avoid division by zero
            if vmax == vmin:
                vmax = vmin + 0.1
                
            norm_data = np.clip((data - vmin) / (vmax - vmin), 0, 1)
            
            # Apply colormap
            cm = plt.get_cmap(cmap_name)
            rgba_img = cm(norm_data)
            
            # Set alpha channel to 0 (transparent) for invalid data (-9999)
            rgba_img[~valid_mask, 3] = 0.0
            
            # Convert to uint8 (0-255)
            rgba_img_uint8 = (rgba_img * 255).astype(np.uint8)
            
            # Encode as PNG Base64
            img = Image.fromarray(rgba_img_uint8)
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            return {
                "success": True,
                "bounds": leaflet_bounds,
                "image": f"data:image/png;base64,{img_str}",
                "band": band,
                "colormap": cmap_name
            }
            
    except rasterio.errors.RasterioIOError:
        raise HTTPException(status_code=500, detail="Error reading raster file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
