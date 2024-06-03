"use client";

import { useEffect, useState } from "react";
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
import Modify from "ol/interaction/Modify";

const KEY_RASTER_LAYER = "OfUznJ15NTmFXjk0lB4s";
const URL_GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL as string;
const ENCODE_BASIC_AUTH_GEOSERVER = btoa(`${process.env.NEXT_PUBLIC_GEOSERVER_USERNAME}:${process.env.NEXT_PUBLIC_GEOSERVER_PASSWORD}`);

const getFeatures = async () => {
  const config: AxiosRequestConfig = {
    params: {
      service: "WFS",
      version: "1.0.0",
      request: "GetFeature",
      typeName: "test:test",
      maxFeatures: 50,
      outputFormat: "application/json",
    },
    headers: {
      Authorization: `Basic ${ENCODE_BASIC_AUTH_GEOSERVER}`,
    },
  };

  try {
    const response = await axios.get(`${URL_GEOSERVER}/test/ows`, config);
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};

const MapPage = () => {
  const [modifiedFeatures, setModifiedFeatures] = useState<Feature<Geometry>[]>([]);

  useEffect(() => {
    // Create map view
    const view = new View({
      center: fromLonLat([99, 14]),
      maxZoom: 19,
      zoom: 2,
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
          const features = new GeoJSON()?.readFeatures(data, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
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

    // Add modify interaction
    const modify = new Modify({ source: vectorSource });
    map.addInteraction(modify);

    modify.on("modifyend", (event) => {
      const features = event.features.getArray().slice();
      setModifiedFeatures((prevFeatures) => {
        const updatedFeatures = [...prevFeatures];
        features.forEach((newFeature) => {
          const featureIndex = updatedFeatures.findIndex((feature) => feature.getId() === newFeature.getId());
          if (featureIndex > -1) {
            updatedFeatures[featureIndex] = newFeature;
          } else {
            updatedFeatures.push(newFeature);
          }
        });
        return updatedFeatures;
      });
    });
  }, []);

  // Save modified features
  const handleOnClickSave = async () => {
    if (modifiedFeatures.length === 0) {
      alert("No features modified.");
      return;
    }

    const geojson = new GeoJSON().writeFeaturesObject(modifiedFeatures, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });

    const wfsTransaction = `<Transaction service="WFS" version="1.1.0"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:gml="http://www.opengis.net/gml"
        xmlns:ogc="http://www.opengis.net/ogc"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        ${geojson.features
          .map(
            (feature: { properties: { plot_code: string }; geometry: { coordinates: number[][][] }; id: string }) =>
              `<Update typeName="test:test">
                <Property>
                  <Name>plot_code</Name>
                  <Value>${feature.properties.plot_code}</Value>
                </Property>
                <Property>
                  <Name>geometry</Name>
                  <Value>
                      <gml:Polygon srsName="EPSG:4326">
                          <gml:exterior>
                              <gml:LinearRing>
                                  <gml:posList>
                                    ${feature.geometry.coordinates[0].map((coord: number[]) => coord.join(" ")).join(" ")}
                                  </gml:posList>
                              </gml:LinearRing>
                          </gml:exterior>
                      </gml:Polygon>
                  </Value>
                </Property>
                <Filter>
                  <FeatureId fid="${feature.id}"/>
                </Filter>
              </Update>`
          )
          .join("")}
    </Transaction>`;

    const config: AxiosRequestConfig = {
      headers: {
        "Content-Type": "text/xml",
        Authorization: `Basic ${ENCODE_BASIC_AUTH_GEOSERVER}`,
      },
    };

    try {
      const response = await axios.post(`${URL_GEOSERVER}/ows`, wfsTransaction, config);
      if (response.status === 200) {
        alert("Features saved successfully.");
        setModifiedFeatures([]);
        console.log(response.data);
      }
    } catch (error) {
      console.error("Error saving features:", error);
      alert("Error saving features.");
    }
  };

  return (
    <>
      <div id="map" style={{ width: "100%", height: "100vh" }}></div>
      <button onClick={handleOnClickSave} className="button-save-polygon">
        Save
      </button>
    </>
  );
};

export default MapPage;
