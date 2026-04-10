import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type Incident, type IncidentCategory } from '../types';
import { getCategoryIcon, getCategorySvgPath } from '../lib/incidentIcons';
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  CheckCircle, 
  ExternalLink, 
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

// Fix for Leaflet marker icons
const markerIcon2x = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapViewProps {
  incidents: Incident[];
  onMarkerClick?: (incident: Incident) => void;
  focusIncident?: Incident | null;
}

const IncidentMarker: React.FC<{ incident: Incident; onClick?: () => void; onImageClick: (url: string) => void }> = ({ incident, onClick, onImageClick }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return '#EF4444';
      case 'Em Atendimento': return '#F59E0B';
      case 'Resolvido': return '#10B981';
      default: return '#6B7280';
    }
  };

  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${getStatusColor(incident.status)}; width: 32px; height: 32px; border-radius: 10px; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
            <div style="transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                ${getCategorySvgPath(incident.category)}
              </svg>
            </div>
          </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const CategoryIcon = getCategoryIcon(incident.category);

  return (
    <Marker 
      position={[incident.location.lat, incident.location.lng]} 
      icon={customIcon}
    >
      <Popup className="custom-popup">
        <div className="p-2 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <CategoryIcon className="w-3 h-3 text-gray-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{incident.type}</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              incident.status === 'Pendente' ? 'bg-danger/10 text-danger' :
              incident.status === 'Em Atendimento' ? 'bg-warning/10 text-warning' :
              'bg-success/10 text-success'
            }`}>
              {incident.status}
            </span>
          </div>
          <h4 className="font-bold text-gray-900 mb-1">{incident.address || 'Sem endereço'}</h4>
          
          {incident.photos && incident.photos.length > 0 && (
            <div 
              className="w-full h-24 rounded-lg overflow-hidden mb-3 border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onImageClick(incident.photos![0]);
              }}
            >
              <img 
                src={incident.photos[0]} 
                alt="Miniatura" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{incident.description}</p>
          
          <button 
            onClick={onClick}
            className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all mb-3 flex items-center justify-center gap-2"
          >
            Ver detalhes na lista
            <ExternalLink className="w-3 h-3" />
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400 border-t pt-2">
            <Clock className="w-3 h-3" />
            {incident.createdAt?.toDate ? format(incident.createdAt.toDate(), "dd 'de' MMMM, HH:mm", { locale: ptBR }) : 'Data indisponível'}
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

const RecenterMap: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (zoom) {
      map.setView(center, zoom);
    } else {
      map.setView(center, map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
};

const MapView: React.FC<MapViewProps> = ({ incidents, onMarkerClick, focusIncident }) => {
  const [center, setCenter] = useState<[number, number]>([-26.34, -49.31]); // Corupá/São Bento, SC
  const [zoom, setZoom] = useState<number>(13);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (focusIncident) {
      setCenter([focusIncident.location.lat, focusIncident.location.lng]);
      setZoom(18); // Maximum reasonable zoom for street level
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.latitude, position.coords.longitude]);
          setZoom(13);
        },
        () => console.log("Geolocation permission denied")
      );
    }
  }, [focusIncident]);

  return (
    <div className="h-full w-full relative rounded-3xl overflow-hidden shadow-xl border border-white/20">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <RecenterMap center={center} zoom={focusIncident ? 18 : undefined} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {incidents.map((incident) => (
          <IncidentMarker 
            key={incident.id} 
            incident={incident} 
            onClick={() => onMarkerClick?.(incident)} 
            onImageClick={setSelectedImage}
          />
        ))}
      </MapContainer>
      
      <div className="absolute bottom-4 left-4 lg:bottom-6 lg:left-6 z-[1000] bg-white/90 backdrop-blur-md p-3 lg:p-4 rounded-2xl shadow-2xl border border-gray-100">
        <h5 className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 lg:mb-3">Legenda</h5>
        <div className="flex flex-col gap-2 lg:gap-2.5">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full bg-danger border-2 border-white shadow-sm" />
            <span className="text-xs lg:text-sm font-medium text-gray-700">Pendente</span>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full bg-warning border-2 border-white shadow-sm" />
            <span className="text-xs lg:text-sm font-medium text-gray-700">Em Atendimento</span>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full bg-success border-2 border-white shadow-sm" />
            <span className="text-xs lg:text-sm font-medium text-gray-700">Resolvido</span>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-[90vw] max-h-[90vh] lg:max-w-[70vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
              <img 
                src={selectedImage} 
                alt="Visualização ampliada" 
                className="w-full h-full object-contain rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;
