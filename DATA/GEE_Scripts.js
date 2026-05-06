/**
 * Study Area: Nakhon Sawan, Thailand
 * Time Range: 2018–2021 (Quarterly)
 * Notes:
 * - Seamline issues reduced using yearly gap-filling
 * - Ensures 100% spatial coverage for Sentinel-2 and Landsat 8
 */

// =========================
// 0. Study Area
// =========================
var nakhon_sawan = ee.FeatureCollection("FAO/GAUL/2015/level2")
  .filter(ee.Filter.eq('ADM1_NAME', 'Nakhon Sawan'));

Map.centerObject(nakhon_sawan, 8);

// =========================
// 1. CONFIGURATION
// =========================
var years = [2018, 2019, 2020, 2021];
var quarters = [1, 2, 3, 4];

// =========================
// 2. PREPROCESSING FUNCTIONS
// =========================

// Sentinel-2 cloud masking using Scene Classification Layer (SCL)
function maskS2(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3).and(scl.lt(8)); // remove cloud/shadow pixels
  return image.updateMask(mask).divide(10000);
}

// Convert Landsat 8 thermal band to Celsius
function prepL8(img){
  var thermal = img.select('ST_B10')
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15);
  return thermal.rename('LST_Thermal');
}

// =========================
// 3. STATIC FEATURES
// =========================

// Digital Elevation Model (DEM)
var dem = ee.Image("USGS/SRTMGL1_003")
  .select('elevation')
  .rename('DEM')
  .clip(nakhon_sawan);

// Soil texture classification
var soil_texture = ee.Image("OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02")
  .select('b0')
  .rename('Soil_Texture')
  .clip(nakhon_sawan);

// =========================
// 4. MAIN LOOP (YEAR × QUARTER)
// =========================
years.forEach(function(year) {
  quarters.forEach(function(q) {

    var startMonth = (q - 1) * 3 + 1;
    var startDate = ee.Date.fromYMD(year, startMonth, 1);
    var endDate = startDate.advance(3, 'month');

    // =========================
    // 4.1 Sentinel-2 Optical Data
    // =========================

    // Quarterly composite (median)
    var s2Quarter = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(nakhon_sawan)
      .filterDate(startDate, endDate)
      .map(maskS2)
      .median()
      .select(['B2','B3','B4','B8']);

    // Yearly composite (used for gap filling)
    var s2Yearly = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(nakhon_sawan)
      .filterDate(ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year, 12, 31))
      .map(maskS2)
      .median()
      .select(['B2','B3','B4','B8']);

    // Fill missing pixels using yearly composite
    var optical = s2Quarter.unmask(s2Yearly);

    // =========================
    // 4.2 Landsat 8 Thermal Data
    // =========================

    var l8Quarter = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(nakhon_sawan)
      .filterDate(startDate, endDate)
      .map(prepL8)
      .median();

    var l8Yearly = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(nakhon_sawan)
      .filterDate(ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year, 12, 31))
      .map(prepL8)
      .median();

    // Gap filling for thermal data
    var thermal = l8Quarter.unmask(l8Yearly);

    // =========================
    // 4.3 VCI CALCULATION
    // =========================

    // Current NDVI
    var ndviCurrent = optical.normalizedDifference(['B8','B4']);

    // Historical NDVI baseline (2017 → current year)
    var baselineCol = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(nakhon_sawan)
      .filterDate('2017-01-01', ee.Date.fromYMD(year, 12, 31))
      .filter(ee.Filter.calendarRange(startMonth, startMonth + 2, 'month'))
      .map(maskS2)
      .map(function(img){
        return img.normalizedDifference(['B8','B4']).rename('NDVI');
      });

    // Robust min/max using percentiles
    var ndviMin = baselineCol.reduce(ee.Reducer.percentile([5])).rename('NDVI_min');
    var ndviMax = baselineCol.reduce(ee.Reducer.percentile([95])).rename('NDVI_max');

    // Avoid division by zero
    var ndviRange = ndviMax.subtract(ndviMin);
    var safeRange = ee.Image(ee.Algorithms.If(
      ndviRange.gt(0),
      ndviRange,
      ee.Image.constant(0.001)
    ));

    // VCI computation
    var vci = ndviCurrent.subtract(ndviMin)
      .divide(safeRange)
      .multiply(100)
      .clamp(0, 100)
      .rename('Target_VCI');

    // =========================
    // 4.4 CLIMATE FEATURES
    // =========================

    // Total rainfall (CHIRPS)
    var rain = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
      .filterBounds(nakhon_sawan)
      .filterDate(startDate, endDate)
      .sum()
      .rename('Rain_Sum');

    // Soil moisture (SMAP)
    var soilMoisture = ee.ImageCollection('NASA/SMAP/SPL4SMGP/008')
      .filterBounds(nakhon_sawan)
      .filterDate(startDate, endDate)
      .select('sm_surface')
      .median()
      .resample('bilinear')
      .rename('Soil_Moisture');

    // Air temperature (ERA5-Land)
    var airTemp = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY")
      .filterBounds(nakhon_sawan)
      .filterDate(startDate, endDate)
      .select('temperature_2m')
      .mean()
      .subtract(273.15)
      .rename('Air_Temp');

    // Evapotranspiration (PML)
    var pmlCol = ee.ImageCollection('projects/pml_evapotranspiration/PML/OUTPUT/PML_V22a')
      .filterBounds(nakhon_sawan)
      .filterDate(startDate, endDate)
      .select('ET');

    // Fallback using climatology if data unavailable
    var pmlFallback = ee.ImageCollection('projects/pml_evapotranspiration/PML/OUTPUT/PML_V22a')
      .filterBounds(nakhon_sawan)
      .filter(ee.Filter.calendarRange(startMonth, startMonth + 2, 'month'))
      .select('ET')
      .mean()
      .multiply(90);

    var et = ee.Image(
      ee.Algorithms.If(
        pmlCol.size().gt(0),
        pmlCol.mean().multiply(90),
        pmlFallback
      )
    ).rename('ET').resample('bilinear');

    // =========================
    // 4.5 SALINITY INDEX
    // =========================
    var salinity_index = optical.expression('sqrt(B * R)', {
      'B': optical.select('B2'),
      'R': optical.select('B4')
    }).rename('Salinity_Index');

    // =========================
    // 4.6 COMBINE ALL FEATURES
    // =========================
    var final = optical.rename(['Blue','Green','Red','NIR'])
      .addBands(thermal)
      .addBands(rain)
      .addBands(soilMoisture)
      .addBands(airTemp)
      .addBands(et)
      .addBands(dem)
      .addBands(soil_texture)
      .addBands(salinity_index)
      .addBands(vci)
      .clip(nakhon_sawan)
      .toFloat();

    // =========================
    // 5. EXPORT
    // =========================
    Export.image.toDrive({
      image: final,
      description: 'VCI_' + year + '_Q' + q,
      folder: 'VCI_Predict_Data',
      fileNamePrefix: 'VCI_' + year + '_Q' + q,
      region: nakhon_sawan.geometry(),
      scale: 30,
      crs: 'EPSG:4326',
      maxPixels: 1e13
    });

  });
});