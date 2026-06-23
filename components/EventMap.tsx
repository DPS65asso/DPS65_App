
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, useMapEvents, LayerGroup, Polyline, Polygon } from 'react-leaflet';
import { TeamLocation, CustomMarker, MarkerType, Track, Event } from '../types';
import { initDB } from '../services/db';
import { storageService } from '../services/storageService';
import { normalizeTileUrl } from '../services/offlineMapService';
import { generateUUID } from '../utils/security';
import L from 'leaflet';
import { Battery, BatteryCharging, Mountain, Radio, Map as MapIcon, Target, Phone, Trash2, Tent, Truck, AlertTriangle, MapPin, User, Save, X, Move, Car, Zap, Layers, Check, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { Button } from './Button';
import { OPS_DATA } from '../data/opsData';

// Fix Leaflet Default Icon
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const STALE_LOCATION_THRESHOLD = 15 * 60 * 1000; // 15 minutes
const iconShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

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
        positions: [[42.75, -0.05], [42.76, -0.04], [42.75, -0.03]] as [number, number][]
    },
    {
        id: 2,
        name: "Fond du Cirque de Gavarnie",
        type: "Réseau Mobile",
        positions: [[42.69, -0.01], [42.70, 0.01], [42.68, 0.02]] as [number, number][]
    },
    {
        id: 3,
        name: "Col du Tourmalet (Versant Ouest)",
        type: "Réseau Mobile",
        positions: [[42.91, 0.13], [42.92, 0.14], [42.90, 0.15]] as [number, number][]
    },
    {
        id: 4,
        name: "Réserve du Néouvielle (Lacs)",
        type: "Réseau Mobile & Radio",
        positions: [[42.83, 0.12], [42.84, 0.15], [42.81, 0.16], [42.80, 0.13]] as [number, number][]
    }
];

let DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Intercepteur global Leaflet pour le support de la carte hors-ligne (Voyager, Topo, Esri)
const originalCreateTile = (L.TileLayer.prototype as any).createTile;
(L.TileLayer.prototype as any).createTile = function (this: any, coords: any, done: any) {
    const tile = originalCreateTile.call(this, coords, done) as HTMLImageElement;
    const url = this.getTileUrl(coords);
    if (!url) return tile;

    // Normaliser l'url pour la recherche dans le Cache Storage
    const cacheUrl = normalizeTileUrl(url);

    caches.open('map-tiles-offline').then(cache => {
        cache.match(cacheUrl).then(response => {
            if (response) {
                response.blob().then(blob => {
                    const objectUrl = URL.createObjectURL(blob);
                    tile.src = objectUrl;
                    
                    // Nettoyer l'Object URL pour éviter les fuites mémoire
                    const cleanup = () => {
                        URL.revokeObjectURL(objectUrl);
                        tile.removeEventListener('load', cleanup);
                        tile.removeEventListener('error', cleanup);
                    };
                    tile.addEventListener('load', cleanup);
                    tile.addEventListener('error', cleanup);
                }).catch(() => {});
            } else if (url.includes('basemaps.cartocdn.com/rastertiles/voyager')) {
                // Mettre en cache automatiquement au fil de l'eau si l'utilisateur navigue en ligne
                const handleOnlineTileLoaded = () => {
                    tile.removeEventListener('load', handleOnlineTileLoaded);
                    fetch(cacheUrl, { mode: 'cors', credentials: 'omit' })
                        .then(res => {
                            if (res.ok) {
                                cache.put(cacheUrl, res);
                            }
                        })
                        .catch(() => {});
                };
                tile.addEventListener('load', handleOnlineTileLoaded);
            }
        }).catch(() => {});
    }).catch(() => {});

    return tile;
};

// Helper function to create POI icons (same style as ProfilePage)
const createPoiIcon = (type: 'HOSP' | 'FIRE' | 'DZ' | 'DAE' | 'MMG', color: string) => {
    let svgContent = '';
    if (type === 'HOSP') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2v20M2 12h20"/></svg>'; 
    else if (type === 'FIRE') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
    else if (type === 'DZ') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>'; 
    else if (type === 'DAE') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'; 
    else if (type === 'MMG') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6"/><path d="M12 10v6"/></svg>'; 

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-8 h-8 rounded-full ${color} border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs">
            ${svgContent}
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
};

// --- CUSTOM MARKERS ICON FACTORY ---
const createCustomIcon = (type: MarkerType) => {
    let iconSvg = '';
    let bgColor = '';
    let borderColor = 'border-white';

    switch (type) {
        case 'POST':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/></svg>'; // Tent
            bgColor = 'bg-blue-600';
            break;
        case 'VEHICLE':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'; // Truck
            bgColor = 'bg-red-600';
            break;
        case 'QUAD':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>'; // Car
            bgColor = 'bg-orange-500';
            break;
        case 'DANGER':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'; // AlertTriangle
            bgColor = 'bg-yellow-500 text-black';
            borderColor = 'border-black';
            break;
        case 'POI':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'; // MapPin
            bgColor = 'bg-cyan-500';
            break;
        case 'TEAM':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; // User
            bgColor = 'bg-green-600';
            break;
    }

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-8 h-8 rounded-xl ${bgColor} border-2 ${borderColor} shadow-lg flex items-center justify-center text-white transform hover:scale-110 transition-transform">
            ${iconSvg}
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};

const MapRevalidator = () => {
    const map = useMap();
    useEffect(() => {
        (window as any).leafletMap = map;
        map.invalidateSize();
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(map.getContainer());
        return () => { resizeObserver.disconnect(); };
    }, [map]);
    return null;
};

// Composant pour auto-centrer la carte
const MapBounds = ({ locations, trackData, tracks }: { locations: TeamLocation[], trackData?: [number, number][], tracks?: Track[] }) => {
    const map = useMap();
    const [hasCentered, setHasCentered] = useState(false);

    useEffect(() => {
        if (!hasCentered) {
            const points: L.LatLngExpression[] = [];
            
            // Add teams locations
            locations.forEach(l => points.push([l.lat, l.lng]));
            
            // Add legacy track points
            if (trackData && trackData.length > 0) {
                trackData.forEach(p => points.push(p));
            }

            // Add new tracks points
            if (tracks && tracks.length > 0) {
                tracks.forEach(track => {
                    track.data.forEach(p => points.push(p));
                });
            }

            if (points.length > 0) {
                const bounds = L.latLngBounds(points);
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                    setHasCentered(true);
                }
            }
        }
    }, [locations, trackData, tracks, map, hasCentered]);

    return (
        <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-[1000]">
             <button 
                onClick={() => {
                    const points: L.LatLngExpression[] = [];
                    locations.forEach(l => points.push([l.lat, l.lng]));
                    if (trackData) trackData.forEach(p => points.push(p));
                    if (tracks) {
                        tracks.forEach(track => {
                            track.data.forEach(p => points.push(p));
                        });
                    }

                    if (points.length > 0) {
                        const bounds = L.latLngBounds(points);
                        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                    }
                }}
                className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:scale-110 transition-transform flex items-center justify-center"
                title="Recentrer sur la zone"
             >
                 <Target className="w-6 h-6" />
             </button>
        </div>
    );
};

// Composant pour écouter le zoom
const ZoomListener = ({ onZoom }: { onZoom: (z: number) => void }) => {
    const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
    return null;
};

// Composant pour gérer les clics en mode édition
const MapEvents = ({ isEditMode, onMapClick }: { isEditMode: boolean, onMapClick: (e: L.LeafletMouseEvent) => void }) => {
    useMapEvents({
        click: (e) => {
            if (isEditMode) onMapClick(e);
        }
    });
    return null;
};

// --- COMPOSANT MARQUEUR DÉPLAÇABLE ISOLÉ COMPLÈTEMENT MÉMOÏSÉ (Point 8) ---
const DraggableMarker = React.memo(({ m, onUpdate, onDelete }: { m: CustomMarker, onUpdate: (id: string, lat: number, lng: number) => void, onDelete: (id: string) => void }) => {
    const markerRef = useRef<L.Marker>(null);

    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker) {
                    const { lat, lng } = marker.getLatLng();
                    onUpdate(m.id, lat, lng);
                }
            },
        }),
        [m.id, onUpdate],
    );

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={[m.lat, m.lng]}
            icon={createCustomIcon(m.type)}
            ref={markerRef}
        >
            <Popup>
                <div className="min-w-[120px] text-center text-slate-900">
                    <div className="font-bold text-sm mb-1">{m.label}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1"><Move className="w-3 h-3"/> Déplaçable</div>
                    <button 
                        onClick={() => onDelete(m.id)}
                        className="w-full py-1 bg-red-50 text-red-600 rounded border border-red-100 hover:bg-red-100 flex items-center justify-center gap-1 text-xs font-bold"
                    >
                        <Trash2 className="w-3 h-3"/> Supprimer
                    </button>
                </div>
            </Popup>
        </Marker>
    );
});

// Composant Marqueur Optimisé (Memoized)
const TacticalMarker = React.memo(({ loc, zoomLevel }: { loc: TeamLocation; zoomLevel: number }) => {
    const icon = useMemo(() => {
        const batLevel = loc.battery_level ?? 100;
        let batColor = 'bg-green-500';
        if (batLevel < 20) batColor = 'bg-red-500 animate-pulse';
        else if (batLevel < 50) batColor = 'bg-orange-500';

        let scale = 1;
        if (zoomLevel < 13) scale = 0.6;
        else if (zoomLevel < 16) scale = 0.8;

        return L.divIcon({
            className: 'custom-div-icon', 
            html: `
            <div style="transform: scale(${scale}); transform-origin: bottom center; width: 80px; display: flex; flex-direction: column; align-items: center;">
                <div class="relative bg-white border-2 border-slate-700 rounded shadow-xl px-2 py-1 flex flex-col items-center min-w-[70px] mb-1">
                    <span class="text-xs font-black text-slate-800 uppercase whitespace-nowrap leading-tight">${loc.team_name}</span>
                    <div class="w-full h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div class="h-full ${batColor}" style="width: ${batLevel}%"></div>
                    </div>
                    <div class="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white border-b-2 border-r-2 border-slate-700 rotate-45"></div>
                </div>
                <div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>
            </div>
            `,
            iconSize: [80, 80],
            iconAnchor: [40, 75],
            popupAnchor: [0, -70]
        });
    }, [loc.team_name, loc.battery_level, zoomLevel]);

    const getRelativeTime = (ts: number) => {
        const diff = Math.floor((Date.now() - ts) / 60000);
        if (diff < 1) return "À l'instant";
        if (diff < 60) return `Il y a ${diff} min`;
        return `Il y a ${Math.floor(diff/60)}h`;
    };

    return (
        <Marker position={[loc.lat, loc.lng]} icon={icon}>
            <Popup>
                <div className="min-w-[150px] text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">{loc.team_name}</h3>
                        {!loc.event_id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold uppercase">Libre</span>}
                    </div>
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Radio className="w-3 h-3" /> {getRelativeTime(loc.timestamp)}</div>
                    {loc.altitude && <div className="flex items-center gap-2 mb-2 bg-slate-100 p-1 rounded"><Mountain className="w-4 h-4 text-slate-600"/><span className="text-sm font-bold text-slate-800">{Math.round(loc.altitude)} m</span></div>}
                    {loc.battery_level !== undefined && <div className="flex items-center gap-2 mb-1">{loc.is_charging ? <BatteryCharging className="w-4 h-4 text-green-500"/> : <Battery className="w-4 h-4 text-slate-400"/>}<span className={`text-sm font-bold ${loc.battery_level < 20 ? 'text-red-500' : 'text-slate-700'}`}>{loc.battery_level}%</span></div>}
                </div>
            </Popup>
        </Marker>
    );
});

// --- RADAR PLUIE TEMPS RÉEL (RAINVIEWER) ---
const RainViewerOverlay = ({ timestamp }: { timestamp: number | null }) => {
    if (!timestamp) return null;
    return (
        <LayersControl.Overlay name="Radar Pluie/Orages (LIVE)" checked={false}>
            <TileLayer 
                url={`https://tilecache.rainviewer.com/v2/radar/${timestamp}/256/{z}/{x}/{y}/2/1_1.png`}
                attribution='&copy; RainViewer'
                opacity={0.7}
                maxNativeZoom={10}
            />
        </LayersControl.Overlay>
    );
};

interface Props {
  eventId: string;
  isFullscreen?: boolean;
  liveTeams?: TeamLocation[];
  liveMarkers?: CustomMarker[];
  liveEvent?: Event | null;
  readOnly?: boolean;
}

export const EventMap: React.FC<Props> = ({ 
    eventId, 
    isFullscreen = false,
    liveTeams,
    liveMarkers,
    liveEvent,
    readOnly = false
}) => {
  const [latestLocations, setLatestLocations] = useState<Record<string, TeamLocation>>({});
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([]);
  const [eventTrack, setEventTrack] = useState<[number, number][]>([]);
  const [eventTracks, setEventTracks] = useState<Track[]>([]);
  const [zoomLevel, setZoomLevel] = useState(15); 
  const [rainViewerTimestamp, setRainViewerTimestamp] = useState<number | null>(null);
  const [currentStyle, setCurrentStyle] = useState<'standard' | 'topo' | 'satellite'>('standard');
  const [showLayersControl, setShowLayersControl] = useState(false);
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

  // --- GESTION DU MODE LIVE (TV) ---
  useEffect(() => {
      if (liveTeams) {
          const latest: Record<string, TeamLocation> = {};
          liveTeams.forEach(l => { latest[l.team_name] = l; });
          setLatestLocations(latest);
      }
  }, [liveTeams]);

  useEffect(() => {
      if (liveMarkers) setCustomMarkers(liveMarkers);
  }, [liveMarkers]);

  useEffect(() => {
      if (liveEvent) {
          if (liveEvent.trackData) setEventTrack(liveEvent.trackData);
          if (liveEvent.tracks) setEventTracks(liveEvent.tracks);
      }
  }, [liveEvent]);

  // Fetch RainViewer latest data
  useEffect(() => {
    const fetchRainViewer = async () => {
        try {
            const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            const data = await res.json();
            if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
                setRainViewerTimestamp(data.radar.past[data.radar.past.length - 1].time);
            }
        } catch (e) {
            console.error("RainViewer fetch error:", e);
        }
    };
    fetchRainViewer();
    const interval = setInterval(fetchRainViewer, 300000); // Update every 5 mins
    return () => clearInterval(interval);
  }, []);

  // Custom Marker States
  // --- CARTE LOCALE INTERNATIONNALE HORS-LIGNE (~10km) ---
  const [isDownloadingLocal, setIsDownloadingLocal] = useState(false);
  const [localDownloadProgress, setLocalDownloadProgress] = useState({ downloaded: 0, total: 0, percent: 0, currentUrl: '' });
  const [localSuccess, setLocalSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const localAbortControllerRef = useRef<AbortController | null>(null);

  const getEventCenter = (): { lat: number, lng: number } | null => {
      // 1. Essayer avec le tracé principal de l'événement
      if (eventTrack && eventTrack.length > 0) {
          const lats = eventTrack.map(p => p[0]);
          const lngs = eventTrack.map(p => p[1]);
          const avgLat = lats.reduce((sum, val) => sum + val, 0) / eventTrack.length;
          const avgLng = lngs.reduce((sum, val) => sum + val, 0) / eventTrack.length;
          return { lat: avgLat, lng: avgLng };
      }
      // 2. Essayer avec les autres tracés
      if (eventTracks && eventTracks.length > 0) {
          let sumLat = 0, sumLng = 0, count = 0;
          eventTracks.forEach(t => {
              t.data.forEach(p => {
                  sumLat += p[0];
                  sumLng += p[1];
                  count++;
              });
          });
          if (count > 0) {
              return { lat: sumLat / count, lng: sumLng / count };
          }
      }
      // 3. Essayer avec les marqueurs personnalisés
      if (customMarkers && customMarkers.length > 0) {
          const avgLat = customMarkers.reduce((sum, m) => sum + m.lat, 0) / customMarkers.length;
          const avgLng = customMarkers.reduce((sum, m) => sum + m.lng, 0) / customMarkers.length;
          return { lat: avgLat, lng: avgLng };
      }
      // 4. Essayer avec les équipes actives
      if (locs && locs.length > 0) {
          const avgLat = locs.reduce((sum, l) => sum + l.lat, 0) / locs.length;
          const avgLng = locs.reduce((sum, l) => sum + l.lng, 0) / locs.length;
          return { lat: avgLat, lng: avgLng };
      }
      // 5. En dernier recours, utiliser le centre actuel de la carte Leaflet
      try {
          const map = (window as any).leafletMap;
          if (map) {
              const center = map.getCenter();
              return { lat: center.lat, lng: center.lng };
          }
      } catch (e) {
          // ignore
      }
      return null;
  };

  const handleDownloadLocalMap = async () => {
      const center = getEventCenter();
      if (!center) {
          setLocalError("Impossible de trouver le centre géographique de l'événement. Veuillez centrer/manipuler la carte et réessayer.");
          return;
      }
      setIsDownloadingLocal(true);
      setLocalError(null);
      setLocalSuccess(false);
      const controller = new AbortController();
      localAbortControllerRef.current = controller;
      try {
          const { generateLocalEventTileUrls, downloadTileUrls } = await import('../services/offlineMapService');
          const urls = generateLocalEventTileUrls(center.lat, center.lng);
          
          if (urls.length === 0) {
              throw new Error("Aucune tuile générée pour ces coordonnées.");
          }
          
          await downloadTileUrls(urls, (prog) => {
              setLocalDownloadProgress({
                  downloaded: prog.downloaded,
                  total: prog.total,
                  percent: prog.percent,
                  currentUrl: prog.currentUrl || ''
              });
          }, controller.signal);
          setLocalSuccess(true);
          setTimeout(() => {
              setLocalSuccess(false);
              setIsDownloadingLocal(false);
          }, 3000);
      } catch (err: any) {
          if (err?.name === 'AbortError' || controller.signal.aborted) {
              console.log("Téléchargement local annulé.");
              setLocalError("Téléchargement de la carte locale annulé.");
          } else {
              console.error("Local map download failed:", err);
              setLocalError(err?.message || "Le téléchargement d'urgence a échoué.");
          }
      } finally {
          localAbortControllerRef.current = null;
      }
  };

  const handleCancelLocalDownload = () => {
      if (localAbortControllerRef.current) {
          localAbortControllerRef.current.abort();
          setIsDownloadingLocal(false);
      }
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [showMarkerModal, setShowMarkerModal] = useState(false);
  const [newMarkerPos, setNewMarkerPos] = useState<{lat: number, lng: number} | null>(null);
  const [newMarkerLabel, setNewMarkerLabel] = useState('');
  const [newMarkerType, setNewMarkerType] = useState<MarkerType>('POST');

  useEffect(() => {
    const loadEventData = async () => {
        if (liveEvent) {
            if (liveEvent.trackData) setEventTrack(liveEvent.trackData);
            if (liveEvent.tracks) setEventTracks(liveEvent.tracks);
            return;
        }
        try {
            const event = await storageService.getEventById(eventId);
            if (event) {
                if (event.trackData) setEventTrack(event.trackData);
                if (event.tracks) setEventTracks(event.tracks);
            }
        } catch(e) { console.error(e); }
    };

    const loadLocs = async () => {
        if (liveTeams) {
            const latest: Record<string, TeamLocation> = {};
            liveTeams.forEach(l => { latest[l.team_name] = l; });
            setLatestLocations(latest);
            return;
        }
        try {
            const db = await initDB();
            const locs = await db.getAll('team_locations');
            const latest: Record<string, TeamLocation> = {};
            
            locs.sort((a,b) => a.timestamp - b.timestamp).forEach(l => {
                const isStale = (Date.now() - l.timestamp) > STALE_LOCATION_THRESHOLD;
                if (!isStale && (!l.event_id || l.event_id === eventId)) {
                    latest[l.team_name] = l;
                }
            });
            setLatestLocations(latest);
        } catch (e) {
            console.error("Erreur chargement carte:", e);
        }
    };

    const loadMarkers = async () => {
        if (liveMarkers) {
            setCustomMarkers(liveMarkers);
            return;
        }
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
        if (e.data.type === 'NEW_LOCATION' && !liveTeams) {
            loadLocs();
        } else if (e.data.type === 'UPDATE_CUSTOM_MARKERS' && !liveMarkers) {
            loadMarkers();
        }
    };

    return () => {
        clearInterval(interval);
        bc.close();
    };
  }, [eventId, liveTeams, liveMarkers, liveEvent]);

  const handleMapClick = (e: L.LeafletMouseEvent) => {
      setNewMarkerPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      setNewMarkerLabel('');
      setNewMarkerType('POST');
      setShowMarkerModal(true);
  };

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
      setIsEditMode(false); // Quit edit mode after adding
  };

  // Callbacks stables pour le sous-composant DraggableMarker
  const handleDeleteMarker = useCallback(async (id: string) => {
      if (confirm("Supprimer ce point ?")) {
          await storageService.deleteCustomMarker(id);
          setCustomMarkers(prev => prev.filter(m => m.id !== id));
      }
  }, []);

  const handleMarkerUpdate = useCallback(async (id: string, lat: number, lng: number) => {
      await storageService.updateCustomMarkerPosition(id, lat, lng);
      // Update local state to reflect new position without reload
      setCustomMarkers(prev => prev.map(m => m.id === id ? { ...m, lat, lng } : m));
  }, []);

  const locs = Object.values(latestLocations) as TeamLocation[];
  const defaultCenter: [number, number] = [46.603354, 1.888334]; 

  return (
    <div className="w-full h-full relative z-0">
        {/* BOUTONS FLOTTANTS (TÉLÉCHARGEMENT LOCAL, ÉDITION & BLITZORTUNG) - ALIGNÉS À GAUCHE */}
        <div className="absolute top-48 left-3 z-[1000] flex flex-col gap-2">
            <button 
                onClick={handleDownloadLocalMap} 
                className={`p-3 rounded-full shadow-lg border-2 transition-all active:scale-95 ${isDownloadingLocal ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400'}`}
                title="Télécharger la carte locale de l'événement (~10km)"
                disabled={isDownloadingLocal}
                id="btn-download-local-map"
            >
                <Download className="w-6 h-6" />
            </button>

            {!readOnly && (
                <>
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
                        className="p-3 rounded-full shadow-lg border-2 bg-yellow-500 border-yellow-600 text-white transition-all active:scale-95 flex items-center justify-center animate-in fade-in"
                        title="Ouvrir Carte Foudre (Blitzortung)"
                    >
                        <Zap className="w-6 h-6" />
                    </a>
                </>
            )}
        </div>

        {/* LAYERS CONTROL - TOP RIGHT (UNDER RECENTER) */}
        <div className="absolute top-32 sm:top-36 right-2 sm:right-4 z-[1000] flex flex-col items-end gap-2">
            <button 
                onClick={() => setShowLayersControl(!showLayersControl)}
                className={`p-3 rounded-full shadow-xl border transition-all ${showLayersControl ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                title="Contrôle des calques"
            >
                <Layers className="w-6 h-6" />
            </button>

            {showLayersControl && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 w-64 max-w-[calc(100vw-32px)] max-h-[250px] sm:max-h-[450px] overflow-y-auto scrollbar-thin animate-in slide-in-from-right-4"
                >
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Calques & Fonds</h3>
                        <button onClick={() => setShowLayersControl(false)}><X className="w-4 h-4 text-slate-400" /></button>
                    </div>

                    {/* Base Styles */}
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Fonds de carte</h4>
                    <div className="grid grid-cols-1 gap-1 mb-4">
                        <button onClick={() => setCurrentStyle('standard')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentStyle === 'standard' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Zap className="w-4 h-4"/> Plan Standard</button>
                        <button onClick={() => setCurrentStyle('topo')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentStyle === 'topo' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Mountain className="w-4 h-4"/> Relief (Topo)</button>
                        <button onClick={() => setCurrentStyle('satellite')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentStyle === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Layers className="w-4 h-4"/> Satellite (ESRI)</button>
                    </div>

                    {/* Overlays */}
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Données Tactiques</h4>
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

        <MapContainer 
            center={defaultCenter} 
            zoom={6} 
            style={{ height: '100%', width: '100%', cursor: isEditMode ? 'crosshair' : 'grab' }}
            zoomControl={false}
        >
            <MapRevalidator />
            <ZoomListener onZoom={setZoomLevel} />
            <MapBounds locations={locs} trackData={eventTrack} tracks={eventTracks} />
            <MapEvents isEditMode={isEditMode} onMapClick={handleMapClick} />
            
            {/* ZOOM CONTROL - Aligné avec 3D */}
            <div className="absolute top-4 left-3 z-[1000] hidden sm:flex flex-col gap-1 leaflet-bar border-none shadow-none">
                <button 
                    onClick={() => {
                        const map = (window as any).leafletMap;
                        if (map) map.zoomIn();
                    }}
                    className="bg-white dark:bg-slate-800 p-2 rounded-t-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-100 flex items-center justify-center font-bold text-xl w-10 h-10 shadow-md"
                    title="Zoom avant"
                >
                    +
                </button>
                <button 
                    onClick={() => {
                        const map = (window as any).leafletMap;
                        if (map) map.zoomOut();
                    }}
                    className="bg-white dark:bg-slate-800 p-2 rounded-b-lg border border-t-0 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-100 flex items-center justify-center font-bold text-xl w-10 h-10 shadow-md"
                    title="Zoom arrière"
                >
                    -
                </button>
            </div>

            {/* FOND DE CARTE */}
            {currentStyle === 'standard' && (
                <TileLayer attribution='&copy; OSM' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            )}
            {currentStyle === 'topo' && (
                <TileLayer attribution='&copy; OpenTopoMap' url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" maxZoom={17} />
            )}
            {currentStyle === 'satellite' && (
                <TileLayer attribution='&copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            )}

            {/* POINTS PERSO */}
            {layersVisibility.pointsPerso && (
                <LayerGroup>
                    {customMarkers.map(m => (
                        <DraggableMarker 
                            key={m.id} 
                            m={m} 
                            onUpdate={handleMarkerUpdate} 
                            onDelete={handleDeleteMarker} 
                        />
                    ))}
                </LayerGroup>
            )}

            {/* ZONES BLANCHES */}
            {layersVisibility.deadZones && (
                <LayerGroup>
                    {KNOWN_DEAD_ZONES.map(zone => (
                        <Polygon
                            key={zone.id}
                            positions={zone.positions}
                            pathOptions={{ color: '#ef4444', dashArray: '5, 10', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2 }}
                        >
                            <Popup>
                                <div className="text-center text-slate-900">
                                    <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                                    <div className="font-bold text-slate-800">Zone Blanche</div>
                                    <div className="text-xs text-slate-500">{zone.name}</div>
                                    <div className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded mt-1">{zone.type}</div>
                                </div>
                            </Popup>
                        </Polygon>
                    ))}
                </LayerGroup>
            )}

            {/* TRACÉS GPX */}
            {layersVisibility.tracks && eventTracks.map(track => (
                <Polyline 
                    key={track.id}
                    positions={track.data} 
                    pathOptions={{ color: track.color || '#2563eb', weight: 4, opacity: 0.8 }} 
                >
                    <Popup>
                        <div className="text-slate-900 font-bold">{track.name}</div>
                    </Popup>
                </Polyline>
            ))}

            {/* RADAR PLUIE */}
            {layersVisibility.radar && rainViewerTimestamp && (
                <TileLayer 
                    url={`https://tilecache.rainviewer.com/v2/radar/${rainViewerTimestamp}/256/{z}/{x}/{y}/2/1_1.png`}
                    attribution='&copy; RainViewer'
                    opacity={0.7}
                    maxNativeZoom={10}
                />
            )}

            {/* POINTS OPÉRATIONNELS */}
            {layersVisibility.hospitals && (
                <LayerGroup>
                    {OPS_DATA.hospitals.map((h, i) => (
                        <Marker key={`hosp-${i}`} position={h.pos} icon={createPoiIcon('HOSP', 'bg-red-600')}>
                            <Popup>
                                <div className="text-center text-slate-900">
                                    <div className="font-bold text-sm">{h.name}</div>
                                    <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded text-slate-700">
                                        <Phone className="w-3 h-3 inline mr-1"/>{h.tel}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </LayerGroup>
            )}

            {layersVisibility.fireStations && (
                <LayerGroup>
                    {OPS_DATA.fireStations.map((f, i) => (
                        <Marker key={`fire-${i}`} position={f.pos} icon={createPoiIcon('FIRE', 'bg-red-500')}>
                            <Popup>
                                <div className="text-center text-slate-900">
                                    <div className="font-bold text-sm">{f.name}</div>
                                    <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded text-slate-700">
                                        <Phone className="w-3 h-3 inline mr-1"/>{f.tel}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </LayerGroup>
            )}

            {layersVisibility.dz && (
                <LayerGroup>
                    {OPS_DATA.dz.map((d, i) => (
                        <Marker key={`dz-${i}`} position={d.pos} icon={createPoiIcon('DZ', 'bg-blue-600')}>
                            <Popup>
                                <div className="text-center text-slate-900">
                                    <div className="font-bold text-sm">{d.name}</div>
                                    <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded text-slate-700">Type: {d.type}</div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </LayerGroup>
            )}

            {layersVisibility.dae && (
                <LayerGroup>
                    {OPS_DATA.dae.map((d, i) => (
                        <Marker key={`dae-${i}`} position={d.pos} icon={createPoiIcon('DAE', 'bg-green-600')}>
                            <Popup>
                                <div className="text-center text-slate-900">
                                    <div className="font-bold text-sm">{d.name}</div>
                                    <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded text-slate-700">Loc: {d.loc}</div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </LayerGroup>
            )}
            
            {locs.map(loc => (
                <TacticalMarker key={loc.team_name} loc={loc} zoomLevel={zoomLevel} />
            ))}
        </MapContainer>
        {locs.length === 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs pointer-events-none z-[1000]">
                Aucune équipe géolocalisée pour cet événement.
            </div>
        )}

        {/* Overlay d'état et progression pour le téléchargement local */}
        {(isDownloadingLocal || localSuccess || localError) && (
            <div className="absolute inset-0 z-[1001] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-6 text-center select-none">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                    {isDownloadingLocal && !localSuccess && (
                        <div className="flex flex-col items-center">
                            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 animate-bounce">
                                <Download className="w-7 h-7" />
                            </div>
                            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mb-1">
                                Téléchargement Local (~10km)
                            </h3>
                            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                Récupération des tuiles de zoom 11 à 16 autour de l'événement...
                            </p>
                            
                            {/* progress bar */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2 border border-slate-200/40 dark:border-slate-700">
                                <div 
                                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                    style={{ width: `${localDownloadProgress.percent}%` }}
                                ></div>
                            </div>
                            
                            <div className="flex justify-between w-full text-xs font-black text-slate-500 font-mono mb-4">
                                <span>{localDownloadProgress.percent}%</span>
                                <span>{localDownloadProgress.downloaded} / {localDownloadProgress.total}</span>
                            </div>

                            <button
                                onClick={handleCancelLocalDownload}
                                className="px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold rounded-2xl text-xs transition-colors shadow-sm outline-none w-full"
                            >
                                Annuler le téléchargement
                            </button>
                        </div>
                    )}
                    
                    {localSuccess && (
                        <div className="flex flex-col items-center">
                            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                                <Check className="w-8 h-8" />
                            </div>
                            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mb-1">
                                Carte enregistrée !
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                Le secteur de 10km autour de l'événement est enregistré localement (jusqu'au zoom 16 terrain).
                            </p>
                        </div>
                    )}

                    {localError && (
                        <div className="flex flex-col items-center">
                            <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                                <AlertTriangle className="w-8 h-8" strokeWidth={2.5} />
                            </div>
                            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mb-1">
                                Une erreur est survenue
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                {localError}
                            </p>
                            <button
                                onClick={() => setLocalError(null)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs transition-colors shadow-sm outline-none w-full"
                            >
                                Revenir à la carte
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
