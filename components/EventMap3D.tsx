
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TeamLocation, CustomMarker, Track, MarkerType } from '../types';
import { initDB } from '../services/db';
import { storageService } from '../services/storageService';
import { Battery, BatteryCharging, Mountain, Radio, Target, Move, Trash2, Tent, Truck, AlertTriangle, MapPin, User, Car, Zap, Compass, Layers, Save, X, Phone, Activity, CheckCircle2, Monitor } from 'lucide-react';
import { generateUUID } from '../utils/security';
import { OPS_DATA } from '../data/opsData';
import { Button } from './Button';

const STALE_LOCATION_THRESHOLD = 15 * 60 * 1000; // 15 minutes

const LAYER_LABELS: Record<string, string> = {
    pointsPerso: "Points Perso",
    deadZones: "Zones Blanches",
    tracks: "Tracés GPX",
    radar: "Radar Pluie",
    hospitals: "Hôpitaux",
    fireStations: "Pompiers",
    medicalHomes: "Maisons Médicales",
    dz: "DZ Hélico",
    dae: "DAE Public"
};

// --- ZONES BLANCHES (RÉSEAU / RADIO) ---
const KNOWN_DEAD_ZONES = [
    {
        id: 1,
        name: "Vallon de Pouey Trenous (Gavarnie)",
        type: "Réseau Mobile & Radio",
        positions: [[-0.05, 42.75], [-0.04, 42.76], [-0.03, 42.75]] as [number, number][] // [lng, lat] for MapLibre
    },
    {
        id: 2,
        name: "Fond du Cirque de Gavarnie",
        type: "Réseau Mobile",
        positions: [[-0.01, 42.69], [0.01, 42.70], [0.02, 42.68]] as [number, number][]
    },
    {
        id: 3,
        name: "Col du Tourmalet (Versant Ouest)",
        type: "Réseau Mobile",
        positions: [[0.13, 42.91], [0.14, 42.92], [0.15, 42.90]] as [number, number][]
    },
    {
        id: 4,
        name: "Réserve du Néouvielle (Lacs)",
        type: "Réseau Mobile & Radio",
        positions: [[0.12, 42.83], [0.15, 42.84], [0.16, 42.81], [0.13, 42.80]] as [number, number][]
    }
];

interface Props {
  eventId: string;
  isFullscreen?: boolean;
}

export const EventMap3D: React.FC<Props> = ({ eventId, isFullscreen = false }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [latestLocations, setLatestLocations] = useState<Record<string, TeamLocation>>({});
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([]);
  const [eventTracks, setEventTracks] = useState<Track[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<'satellite' | 'topo' | 'standard'>('satellite');
  const [rainViewerTimestamp, setRainViewerTimestamp] = useState<number | null>(null);

  // Custom Marker States (Edit Mode)
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMarkerModal, setShowMarkerModal] = useState(false);
  const [newMarkerPos, setNewMarkerPos] = useState<{lat: number, lng: number} | null>(null);
  const [newMarkerLabel, setNewMarkerLabel] = useState('');
  const [newMarkerType, setNewMarkerType] = useState<MarkerType>('POST');

  // Layer Visibility States
  const [layersVisibility, setLayersVisibility] = useState({
    pointsPerso: true,
    deadZones: true,
    tracks: true,
    radar: false,
    hospitals: false,
    fireStations: false,
    medicalHomes: false,
    dz: false,
    dae: false
  });

  const [showLayersControl, setShowLayersControl] = useState(false);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);

  // Fetch RainViewer latest data
  useEffect(() => {
    const fetchRainViewer = async () => {
        try {
            const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            const data = await res.json();
            if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
                setRainViewerTimestamp(data.radar.past[data.radar.past.length - 1].time);
            }
        } catch (e) { console.error(e); }
    };
    fetchRainViewer();
    const interval = setInterval(fetchRainViewer, 300000);
    return () => clearInterval(interval);
  }, []);

  // Markers refs to update them without re-rendering the whole map
  const teamMarkersRef = useRef<Record<string, maplibregl.Marker>>({});
  const customMarkersRef = useRef<Record<string, maplibregl.Marker>>({});

  // --- DATA LOADING ---
  useEffect(() => {
    const loadEventData = async () => {
        try {
            const event = await storageService.getEventById(eventId);
            if (event && event.tracks) setEventTracks(event.tracks);
        } catch(e) { console.error(e); }
    };

    const loadLocs = async () => {
        try {
            const db = await initDB();
            const locs = await db.getAll('team_locations') as TeamLocation[];
            const latest: Record<string, TeamLocation> = {};
            
            locs.sort((a: TeamLocation, b: TeamLocation) => a.timestamp - b.timestamp).forEach((l: TeamLocation) => {
                const isStale = (Date.now() - l.timestamp) > STALE_LOCATION_THRESHOLD;
                if (!isStale && (!l.event_id || l.event_id === eventId)) {
                    latest[l.team_name] = l;
                }
            });
            setLatestLocations(latest);
        } catch (e) { console.error("Erreur chargement locs:", e); }
    };

    const loadMarkers = async () => {
        try {
            const markers = await storageService.getCustomMarkers(eventId);
            setCustomMarkers(markers);
        } catch (e) { console.error(e); }
    };

    loadEventData();
    loadLocs();
    loadMarkers();
    
    const interval = setInterval(loadLocs, 5000); 
    const bc = new BroadcastChannel('dps65_gps_channel');
    bc.onmessage = (e) => {
        if (e.data.type === 'NEW_LOCATION') loadLocs();
    };

    return () => {
        clearInterval(interval);
        bc.close();
    };
  }, [eventId]);

  // --- MAP INITIALIZATION ---
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
          'terrain-rgb': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            tileSize: 256,
            encoding: 'terrarium'
          },
          'hillshade-source': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            tileSize: 256,
            encoding: 'terrarium'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
          },
          {
            id: 'hillshade-layer',
            type: 'hillshade',
            source: 'hillshade-source',
            paint: {
              'hillshade-shadow-color': '#000',
              'hillshade-illumination-direction': 315,
              'hillshade-exaggeration': 0.3, // Réduit pour éviter les reflets blanchâtres
              'hillshade-accent-color': '#111'
            }
          }
        ],
        terrain: {
          source: 'terrain-rgb',
          exaggeration: 1.2 // Softer relief like Google Earth
        }
      },
      center: [1.888334, 46.603354],
      zoom: 5,
      pitch: 45, // Softer initial pitch
      bearing: 0,
      antialias: true,
      maxPitch: 85
    });

    // Navigation control moved to top-left to match 2D map zoom position
    mapInstance.addControl(new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true
    }), 'top-left');

    mapInstance.on('click', (e) => {
        // We handle click via a ref check in the render or a state
    });

    mapInstance.on('load', () => {
      setMapLoaded(true);
      
      // Add sky layer for better 3D effect
      mapInstance.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 5 // Lowered to reduce glare
        }
      } as any);

      // Add Dead Zones
      KNOWN_DEAD_ZONES.forEach(zone => {
          const id = `deadzone-${zone.id}`;
          mapInstance.addSource(id, {
              type: 'geojson',
              data: {
                  type: 'Feature',
                  properties: { name: zone.name, type: zone.type },
                  geometry: {
                      type: 'Polygon',
                      coordinates: [[...zone.positions, zone.positions[0]]]
                  }
              }
          });
          mapInstance.addLayer({
              id: `${id}-fill`,
              type: 'fill',
              source: id,
              paint: {
                  'fill-color': '#ef4444',
                  'fill-opacity': 0.2
              }
          });
          mapInstance.addLayer({
              id: `${id}-outline`,
              type: 'line',
              source: id,
              paint: {
                  'line-color': '#ef4444',
                  'line-width': 2,
                  'line-dasharray': [2, 2]
              }
          });
      });
    });

    map.current = mapInstance;

    return () => {
      mapInstance.remove();
    };
  }, []);

  // --- UPDATE STYLES ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sources: any = {
        'satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '&copy; Esri'
        },
        'topo': {
            type: 'raster',
            tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenTopoMap'
        },
        'standard': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OSM'
        }
    };

    const currentSource = sources[currentStyle];
    
    // Remove any existing base layers
    ['base-layer', 'osm-layer'].forEach(id => {
        if (map.current!.getLayer(id)) map.current!.removeLayer(id);
    });
    
    if (map.current.getSource('base-source')) {
        map.current.removeSource('base-source');
    }

    map.current.addSource('base-source', currentSource);
    
    // Determine where to insert the layer (must be BELOW hillshade to see relief)
    const beforeId = map.current.getLayer('hillshade-layer') ? 'hillshade-layer' : 
                     map.current.getLayer('sky') ? 'sky' : undefined;
    
    map.current.addLayer({
        id: 'base-layer',
        type: 'raster',
        source: 'base-source',
        paint: {
            'raster-contrast': 0.15, // Increase contrast for sharpness
            'raster-saturation': 0.15, // Increase saturation for "Google Earth" feel
            'raster-brightness-min': 0,
            'raster-resampling': 'linear'
        }
    }, beforeId); 

  }, [currentStyle, mapLoaded]);

  // --- UPDATE LAYERS VISIBILITY ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Dead Zones
    KNOWN_DEAD_ZONES.forEach(zone => {
        const id = `deadzone-${zone.id}`;
        if (map.current!.getLayer(`${id}-fill`)) {
            map.current!.setLayoutProperty(`${id}-fill`, 'visibility', layersVisibility.deadZones ? 'visible' : 'none');
            map.current!.setLayoutProperty(`${id}-outline`, 'visibility', layersVisibility.deadZones ? 'visible' : 'none');
        }
    });

    // Radar
    if (rainViewerTimestamp) {
        const radarId = 'radar-layer';
        const radarSourceId = 'radar-source';
        
        if (layersVisibility.radar) {
            if (!map.current!.getSource(radarSourceId)) {
                map.current!.addSource(radarSourceId, {
                    type: 'raster',
                    tiles: [`https://tilecache.rainviewer.com/v2/radar/${rainViewerTimestamp}/256/{z}/{x}/{y}/2/1_1.png`],
                    tileSize: 256
                });
                map.current!.addLayer({
                    id: radarId,
                    type: 'raster',
                    source: radarSourceId,
                    paint: { 'raster-opacity': 0.7 }
                }, 'sky');
            }
        } else {
            if (map.current!.getLayer(radarId)) map.current!.removeLayer(radarId);
            if (map.current!.getSource(radarSourceId)) map.current!.removeSource(radarSourceId);
        }
    }

    // Tracks
    eventTracks.forEach(track => {
        const layerId = `track-layer-${track.id}`;
        if (map.current!.getLayer(layerId)) {
            map.current!.setLayoutProperty(layerId, 'visibility', layersVisibility.tracks ? 'visible' : 'none');
        }
    });

  }, [layersVisibility, mapLoaded, rainViewerTimestamp, eventTracks]);

  // --- UPDATE POI MARKERS (OPS_DATA) ---
  const poiMarkersRef = useRef<Record<string, maplibregl.Marker[]>>({
    hospitals: [],
    fireStations: [],
    medicalHomes: [],
    dz: [],
    dae: []
  });

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const updatePoiLayer = (key: keyof typeof poiMarkersRef.current, data: any[], type: 'HOSP' | 'FIRE' | 'DZ' | 'DAE' | 'MMG', color: string) => {
        // Clear old
        poiMarkersRef.current[key].forEach(m => m.remove());
        poiMarkersRef.current[key] = [];

        if (layersVisibility[key as keyof typeof layersVisibility]) {
            data.forEach(item => {
                const el = document.createElement('div');
                el.className = `w-8 h-8 rounded-full ${color} border-2 border-white shadow-lg flex items-center justify-center text-white cursor-pointer`;
                
                let svg = '';
                if (type === 'HOSP') svg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2v20M2 12h20"/></svg>';
                else if (type === 'FIRE') svg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
                else if (type === 'DZ') svg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>';
                else if (type === 'DAE') svg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
                else if (type === 'MMG') svg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6"/><path d="M12 10v6"/></svg>';

                el.innerHTML = svg;

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([item.pos[1], item.pos[0]])
                    .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
                        <div class="p-2 text-center text-slate-900">
                            <div class="font-bold text-sm">${item.name}</div>
                            ${item.tel ? `<div class="text-xs font-mono mt-1 bg-slate-100 p-1 rounded text-slate-700">${item.tel}</div>` : ''}
                            ${item.info ? `<div class="text-xs mt-1 text-slate-600">${item.info}</div>` : ''}
                            ${item.type ? `<div class="text-xs mt-1 text-slate-500">Type: ${item.type}</div>` : ''}
                        </div>
                    `))
                    .addTo(map.current!);
                
                poiMarkersRef.current[key].push(marker);
            });
        }
    };

    updatePoiLayer('hospitals', OPS_DATA.hospitals, 'HOSP', 'bg-red-600');
    updatePoiLayer('fireStations', OPS_DATA.fireStations, 'FIRE', 'bg-red-500');
    updatePoiLayer('medicalHomes', OPS_DATA.medicalHomes, 'MMG', 'bg-emerald-600');
    updatePoiLayer('dz', OPS_DATA.dz, 'DZ', 'bg-blue-600');
    updatePoiLayer('dae', OPS_DATA.dae, 'DAE', 'bg-green-600');

  }, [layersVisibility, mapLoaded]);

  // --- EDIT MODE CLICK HANDLER ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
        if (isEditMode) {
            setNewMarkerPos({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            setNewMarkerLabel('');
            setNewMarkerType('POST');
            setShowMarkerModal(true);
        }
    };

    map.current.on('click', onClick);
    return () => { map.current?.off('click', onClick); };
  }, [isEditMode, mapLoaded]);

  const handleSaveMarker = async () => {
    if (!newMarkerPos || !newMarkerLabel) return;
    const marker: CustomMarker = {
        id: generateUUID(),
        eventId,
        lat: newMarkerPos.lat,
        lng: newMarkerPos.lng,
        label: newMarkerLabel,
        type: newMarkerType,
        createdAt: Date.now()
    };
    await storageService.addCustomMarker(marker);
    setCustomMarkers([...customMarkers, marker]);
    setShowMarkerModal(false);
    setNewMarkerPos(null);
    setIsEditMode(false);
  };

  const handleDeleteMarker = useCallback(async (id: string) => {
    if (confirm("Supprimer ce point ?")) {
        await storageService.deleteCustomMarker(id);
        setCustomMarkers(prev => prev.filter(m => m.id !== id));
    }
  }, []);

  // --- UPDATE TEAM MARKERS ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentTeams = Object.values(latestLocations);
    
    // Remove markers for teams no longer present
    Object.keys(teamMarkersRef.current).forEach(name => {
        if (!latestLocations[name]) {
            teamMarkersRef.current[name].remove();
            delete teamMarkersRef.current[name];
        }
    });

    // Add or update markers
    currentTeams.forEach(loc => {
        if (teamMarkersRef.current[loc.team_name]) {
            teamMarkersRef.current[loc.team_name].setLngLat([loc.lng, loc.lat]);
            // Update popup content or marker element if needed
        } else {
            const el = document.createElement('div');
            el.className = 'team-marker-3d';
            el.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="bg-white border-2 border-slate-800 rounded shadow-lg px-2 py-1 flex flex-col items-center min-w-[60px] mb-1">
                        <span class="text-[10px] font-black text-slate-800 uppercase leading-tight">${loc.team_name}</span>
                        <div class="w-full h-1 bg-slate-200 rounded-full mt-0.5 overflow-hidden">
                            <div class="h-full ${loc.battery_level && loc.battery_level < 20 ? 'bg-red-500' : 'bg-green-500'}" style="width: ${loc.battery_level || 100}%"></div>
                        </div>
                    </div>
                    <div class="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>
                </div>
            `;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([loc.lng, loc.lat])
                .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
                    <div class="p-2 text-slate-900">
                        <h3 class="font-bold">${loc.team_name}</h3>
                        <p class="text-xs text-slate-500">Altitude: ${Math.round(loc.altitude || 0)}m</p>
                        <p class="text-xs text-slate-500">Batterie: ${loc.battery_level || 0}%</p>
                    </div>
                `))
                .addTo(map.current!);
            
            teamMarkersRef.current[loc.team_name] = marker;
        }
    });
  }, [latestLocations, mapLoaded]);

  // --- UPDATE CUSTOM MARKERS ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove old markers
    Object.keys(customMarkersRef.current).forEach(id => {
        customMarkersRef.current[id].remove();
        delete customMarkersRef.current[id];
    });

    if (!layersVisibility.pointsPerso) return;

    // Add new ones
    customMarkers.forEach(m => {
        const el = document.createElement('div');
        el.className = 'custom-marker-3d cursor-pointer';
        
        let bgColor = '';
        let iconSvg = '';

        switch (m.type) {
            case 'POST': iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/></svg>'; bgColor = 'bg-blue-600'; break;
            case 'VEHICLE': iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'; bgColor = 'bg-red-600'; break;
            case 'QUAD': iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>'; bgColor = 'bg-orange-500'; break;
            case 'DANGER': iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'; bgColor = 'bg-yellow-500'; break;
            case 'POI': iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'; bgColor = 'bg-cyan-500'; break;
            case 'TEAM': iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; bgColor = 'bg-green-600'; break;
        }

        el.innerHTML = `
            <div class="w-8 h-8 rounded-xl ${bgColor} border-2 border-white shadow-xl flex items-center justify-center text-white">
                ${iconSvg}
            </div>
        `;

        const marker = new maplibregl.Marker({ element: el, draggable: true })
            .setLngLat([m.lng, m.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
                <div class="p-2 text-center text-slate-900">
                    <h3 class="font-bold">${m.label}</h3>
                    <p class="text-[10px] uppercase text-slate-500 mb-2">${m.type}</p>
                    <button id="delete-marker-${m.id}" class="w-full py-1 bg-red-50 text-red-600 rounded border border-red-100 hover:bg-red-100 flex items-center justify-center gap-1 text-xs font-bold">
                        Supprimer
                    </button>
                </div>
            `))
            .addTo(map.current!);
        
        marker.on('dragend', async () => {
            const lngLat = marker.getLngLat();
            await storageService.updateCustomMarkerPosition(m.id, lngLat.lat, lngLat.lng);
            setCustomMarkers(prev => prev.map(old => old.id === m.id ? { ...old, lat: lngLat.lat, lng: lngLat.lng } : old));
        });

        marker.getPopup().on('open', () => {
            const btn = document.getElementById(`delete-marker-${m.id}`);
            if (btn) btn.onclick = () => handleDeleteMarker(m.id);
        });
        
        customMarkersRef.current[m.id] = marker;
    });
  }, [customMarkers, mapLoaded, layersVisibility.pointsPerso, handleDeleteMarker]);

  // --- UPDATE TRACKS ---
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    eventTracks.forEach(track => {
        const sourceId = `track-source-${track.id}`;
        const layerId = `track-layer-${track.id}`;

        if (map.current!.getSource(sourceId)) {
            (map.current!.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: track.data.map((p: [number, number]) => [p[1], p[0]]) // MapLibre uses [lng, lat]
                }
            });
        } else {
            map.current!.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: track.data.map((p: [number, number]) => [p[1], p[0]])
                    }
                }
            });

            map.current!.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': track.color || '#2563eb',
                    'line-width': 4,
                    'line-opacity': 0.8
                }
            });
        }
    });
  }, [eventTracks, mapLoaded]);

  const recenter = useCallback(() => {
    if (!map.current) return;
    const points: [number, number][] = [];
    Object.values(latestLocations).forEach(l => points.push([l.lng, l.lat]));
    customMarkers.forEach(m => points.push([m.lng, m.lat]));
    eventTracks.forEach(t => t.data.forEach((p: [number, number]) => points.push([p[1], p[0]])));

    if (points.length > 0) {
        const bounds = points.reduce((acc, coord) => acc.extend(coord), new maplibregl.LngLatBounds(points[0], points[0]));
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 16 });
    }
  }, [latestLocations, customMarkers, eventTracks]);

  // Initial auto-center
  useEffect(() => {
    if (mapLoaded && !hasInitialCentered) {
        const pointsCount = Object.keys(latestLocations).length + customMarkers.length + eventTracks.length;
        if (pointsCount > 0) {
            recenter();
            setHasInitialCentered(true);
        }
    }
  }, [mapLoaded, hasInitialCentered, latestLocations, customMarkers, eventTracks, recenter]);

  return (
    <div className={`${isFullscreen ? 'h-full' : 'h-[60vh]'} w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm relative z-0`}>
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* BOUTONS MODE ÉDITION & BLITZORTUNG - Positionnés à gauche (sous le zoom) comme en 2D */}
      <div className="absolute top-48 left-3 z-[1000] flex flex-col gap-2">
          <button 
              onClick={() => setIsEditMode(!isEditMode)} 
              className={`p-3 rounded-full shadow-lg border-2 transition-all active:scale-95 ${isEditMode ? 'bg-orange-500 border-orange-600 text-white animate-pulse' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`}
              title={isEditMode ? "Quitter mode ajout" : "Ajouter un point"}
          >
              {isEditMode ? <X className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
          </button>

          <a 
              href="https://www.lightningmaps.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-3 rounded-full shadow-lg border-2 bg-yellow-500 border-yellow-600 text-white transition-all active:scale-95 flex items-center justify-center"
              title="Ouvrir Carte Foudre (Blitzortung)"
          >
              <Zap className="w-6 h-6" />
          </a>
      </div>

      {/* INSTRUCTION FLOTTANTE */}
      {isEditMode && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-orange-600 text-white px-4 py-2 rounded-full shadow-xl text-xs font-bold uppercase animate-in slide-in-from-top-4 pointer-events-none">
              Touchez la carte pour ajouter
          </div>
      )}

      {/* MODAL AJOUT MARQUEUR */}
      {showMarkerModal && (
          <div className="fixed inset-0 z-[5000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setShowMarkerModal(false); }}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-xs border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2"><MapPin className="w-5 h-5"/> Nouveau Point</h3>
                  
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom du point</label>
                  <input autoFocus type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg mb-4 font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" placeholder="ex: PC Avançé, Danger..." value={newMarkerLabel} onChange={e => setNewMarkerLabel(e.target.value)} />
                  
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                  <div className="grid grid-cols-3 gap-2 mb-6">
                      <button onClick={() => setNewMarkerType('POST')} className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${newMarkerType === 'POST' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}><Tent className="w-5 h-5 text-blue-600"/><span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Poste</span></button>
                      <button onClick={() => setNewMarkerType('VEHICLE')} className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${newMarkerType === 'VEHICLE' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 ring-2 ring-red-500/20' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}><Truck className="w-5 h-5 text-red-600"/><span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">VPSP</span></button>
                      <button onClick={() => setNewMarkerType('QUAD')} className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${newMarkerType === 'QUAD' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 ring-2 ring-orange-500/20' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}><Car className="w-5 h-5 text-orange-500"/><span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Quad</span></button>
                      <button onClick={() => setNewMarkerType('DANGER')} className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${newMarkerType === 'DANGER' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 ring-2 ring-yellow-500/20' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}><AlertTriangle className="w-5 h-5 text-yellow-500"/><span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Danger</span></button>
                      <button onClick={() => setNewMarkerType('POI')} className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${newMarkerType === 'POI' ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30 ring-2 ring-cyan-500/20' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}><MapPin className="w-5 h-5 text-cyan-500"/><span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Info</span></button>
                      <button onClick={() => setNewMarkerType('TEAM')} className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${newMarkerType === 'TEAM' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 ring-2 ring-green-500/20' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}><User className="w-5 h-5 text-green-600"/><span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Équipe</span></button>
                  </div>

                  <div className="flex gap-3">
                      <Button onClick={() => setShowMarkerModal(false)} variant="outline" fullWidth>Annuler</Button>
                      <Button onClick={handleSaveMarker} fullWidth icon={<Save className="w-4 h-4"/>}>Placer</Button>
                  </div>
              </div>
          </div>
      )}

      {/* RECENTER BUTTON - TOP RIGHT */}
      <div className="absolute top-20 right-4 z-[1000]">
          <button 
              onClick={recenter}
              className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:scale-110 transition-transform flex items-center justify-center"
              title="Recentrer"
          >
              <Target className="w-6 h-6" />
          </button>
      </div>

      {/* LAYERS CONTROL - TOP RIGHT (UNDER RECENTER) */}
      <div className="absolute top-36 right-4 z-[1000] flex flex-col items-end gap-2">
          <button 
              onClick={() => setShowLayersControl(!showLayersControl)}
              className={`p-3 rounded-full shadow-xl border transition-all ${showLayersControl ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white'}`}
          >
              <Layers className="w-6 h-6" />
          </button>

          {showLayersControl && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 w-64 animate-in slide-in-from-right-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Fonds de carte</h4>
                  <div className="grid grid-cols-1 gap-1 mb-4">
                      <button onClick={() => setCurrentStyle('standard')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentStyle === 'standard' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Zap className="w-4 h-4"/> Plan Standard</button>
                      <button onClick={() => setCurrentStyle('topo')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentStyle === 'topo' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Mountain className="w-4 h-4"/> Relief (Topo)</button>
                      <button onClick={() => setCurrentStyle('satellite')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentStyle === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Layers className="w-4 h-4"/> Satellite (ESRI)</button>
                  </div>

                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Calques</h4>
                  <div className="space-y-1">
                      {Object.entries(layersVisibility).map(([key, visible]) => (
                          <button 
                              key={key}
                              onClick={() => setLayersVisibility(prev => ({ ...prev, [key]: !visible }))}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition-all ${visible ? 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                          >
                              <span>{LAYER_LABELS[key] || key}</span>
                              <div className={`w-2 h-2 rounded-full ${visible ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                          </button>
                      ))}
                  </div>
              </div>
          )}
      </div>

    </div>
  );
};
