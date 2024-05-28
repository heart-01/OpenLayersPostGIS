"use client";

import { useEffect } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat } from "ol/proj";
import { Feature } from "ol";
import { Geometry } from "ol/geom";
import axios, { AxiosRequestConfig } from "axios";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";

const KEY_RASTER_LAYER = "OfUznJ15NTmFXjk0lB4s";
const URL_GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL as string;
const ENCODE_BASIC_AUTH_GEOSERVER = btoa(`${process.env.NEXT_PUBLIC_GEOSERVER_USERNAME}:${process.env.NEXT_PUBLIC_GEOSERVER_PASSWORD}`);

const getFeatures = async () => {
  const config: AxiosRequestConfig = {
    params: {
      service: "WFS",
      version: "1.0.0",
      request: "GetFeature",
      typeName: "	test:test",
      maxFeatures: 50,
      outputFormat: "application/json",
    },
    headers: {
      Authorization: `Basic ${ENCODE_BASIC_AUTH_GEOSERVER}`,
    },
  };

  try {
    const response = await axios.get(URL_GEOSERVER, config);
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};

const MapPage = () => {
  useEffect(() => {
    // Create map view
    const view = new View({
      center: fromLonLat([99, 14]),
      maxZoom: 19,
      zoom: 12,
    });

    // Create reater layer
    const rasterLayer = new TileLayer({
      source: new XYZ({
        url: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${KEY_RASTER_LAYER}`,
        tileSize: 512,
        maxZoom: 20,
      }),
    });

    // Create vector source for WFS
    const vectorSource = new VectorSource({
      format: new GeoJSON(),
      loader: async (extent, resolution, projection) => {
        try {
          const data = await getFeatures();
          const features = vectorSource?.getFormat()?.readFeatures(data, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
          if (features) {
            vectorSource.addFeatures(features as Feature<Geometry>[]);
          }
        } catch (error) {
          console.error("Error loading features:", error);
        }
      },
    });

    // Create vector layer
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        stroke: new Stroke({
          color: "white",
          width: 0.75,
        }),
        fill: new Fill({
          color: "rgba(100,100,100,0.25)",
        }),
      }),
    });

    // Create map
    const map = new Map({
      layers: [rasterLayer, vectorLayer],
      target: "map",
      view: view,
    });
  }, []);

  return <div id="map" style={{ width: "100%", height: "100vh" }}></div>;
};

export default MapPage;
