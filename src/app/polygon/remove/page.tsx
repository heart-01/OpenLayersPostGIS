"use client";

import React, { useEffect, useRef, useState } from "react";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { OSM } from "ol/source";
import VectorSource from "ol/source/Vector";
import { Polygon, Point } from "ol/geom";
import Feature from "ol/Feature";
import { fromLonLat, toLonLat } from "ol/proj";
import { Stroke, Style, Circle as CircleStyle, Fill, Text } from "ol/style";
import Modify, { ModifyEvent } from "ol/interaction/Modify";
import { Map, View } from "ol";

const App = () => {
  const mapRef = useRef<HTMLDivElement>() as React.MutableRefObject<HTMLDivElement>;
  const [lineVectorSource] = useState(new VectorSource());
  const [pointVectorSource] = useState(new VectorSource());
  const [polygonData, setPolygonData] = useState([
    { coord: [-1, -1], name: "Point 1" },
    { coord: [3, -1], name: "Point 2" },
    { coord: [3, 2.999999999999986], name: "Point 3" },
    { coord: [-1, 2.999999999999986], name: "Point 4" },
    { coord: [-1, -1], name: "Point 5" },
  ]);
  const [selectedFeature, setSelectedFeature] = useState<Feature<Point> | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const createPolygon = (polygon: Array<{ coord: number[]; name: string }>) => {
    lineVectorSource.clear();
    pointVectorSource.clear();

    // Add polygon feature
    const polygonFeature = new Feature(new Polygon([polygon.map(({ coord }) => fromLonLat(coord))]));
    lineVectorSource.addFeature(polygonFeature);

    // Add point features
    polygon.forEach(({ coord, name }) => {
      const pointFeature = new Feature(new Point(fromLonLat(coord)));
      pointFeature.set("name", name);
      pointVectorSource.addFeature(pointFeature);
    });
  };

  const removeCoordinate = (coord: number[]) => {
    const newCoords = polygonData.filter(({ coord: c }) => c[0] !== coord[0] || c[1] !== coord[1]);
    setPolygonData(newCoords);
  };

  const handleOnClickDelete = () => {
    if (selectedFeature) {
      const featureCoord = toLonLat((selectedFeature.getGeometry() as Point).getCoordinates());
      removeCoordinate(featureCoord);
      setSelectedFeature(null);
      hideContextMenu();
    }
  };

  const showContextMenu = (event: MouseEvent, feature: Feature<Point>) => {
    setSelectedFeature(feature);
    if (contextMenuRef.current) {
      contextMenuRef.current.style.display = "block";
      contextMenuRef.current.style.left = `${event.clientX}px`;
      contextMenuRef.current.style.top = `${event.clientY}px`;
    }
  };

  const hideContextMenu = () => {
    if (contextMenuRef.current) {
      contextMenuRef.current.style.display = "none";
    }
  };

  useEffect(() => {
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: lineVectorSource,
          style: new Style({
            stroke: new Stroke({
              color: "blue",
              width: 2,
            }),
          }),
        }),
        new VectorLayer({
          source: pointVectorSource,
          style: (feature) => {
            return new Style({
              image: new CircleStyle({
                radius: 5,
                fill: new Fill({ color: "red" }),
              }),
              text: new Text({
                text: feature.get("name"),
                offsetY: -15,
                fill: new Fill({ color: "black" }),
              }),
            });
          },
        }),
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 6.5,
      }),
    });

    createPolygon(polygonData);

    const modify = new Modify({ source: lineVectorSource });
    map.addInteraction(modify);

    modify.on("modifyend", (event: ModifyEvent) => {
      const modifiedCoords = (event.features.item(0).getGeometry() as Polygon).getCoordinates()[0];
      const transformedCoords = modifiedCoords.map((coord) => {
        const [lon, lat] = toLonLat(coord);
        return { coord: [lon, lat], name: `Point ${modifiedCoords.indexOf(coord)}` };
      });
      setPolygonData(transformedCoords);
    });

    // Add right-click event listener to the map
    map.getViewport().addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const features = map.getFeaturesAtPixel(map.getEventPixel(event));

      // Filter features to check only points from pointVectorSource
      const pointFeatures = features.filter((feature) => {
        return (feature.getGeometry() as Point).getType() === "Point" && pointVectorSource.hasFeature(feature as Feature<Point>);
      });

      if (pointFeatures.length > 0) {
        showContextMenu(event, pointFeatures[0] as Feature<Point>);
      } else {
        hideContextMenu();
      }
    });

    // Add click event listener to the map to hide the context menu
    map.getViewport().addEventListener("click", () => {
      hideContextMenu();
    });

    return () => {
      map.setTarget(undefined);
    };
  }, [polygonData]);

  useEffect(() => {
    createPolygon(polygonData);
  }, [polygonData]);

  return (
    <div>
      <div ref={mapRef} style={{ width: "100%", height: "70vh" }} />
      <div>
        <h3>Polygon Coordinates:</h3>
        <ul>
          {polygonData.map(({ coord, name }, index) => (
            <li key={index}>
              {name}: {coord[0]}, {coord[1]}{" "}
              <button style={{ color: "red", backgroundColor: "#ffc6c6" }} onClick={() => removeCoordinate(coord)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div ref={contextMenuRef} style={{ display: "none", position: "absolute", backgroundColor: "white", border: "1px solid black", zIndex: 10 }}>
        <button onClick={handleOnClickDelete}>Delete</button>
      </div>
    </div>
  );
};

export default App;
