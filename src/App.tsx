/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IncidentForm from './components/IncidentForm';
import IncidentList from './components/IncidentList';
import MapView from './components/MapView';
import Login from './components/Login';
import NotificationManager from './components/NotificationManager';
import OfflineSyncIndicator from './components/OfflineSyncIndicator';
import UserManagement from './components/UserManagement';
import { db, collection, query, orderBy, onSnapshot, handleFirestoreError, OperationType, where } from './firebase';
import { type Incident } from './types';
import { syncOfflineIncidents } from './services/offlineService';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertCircle, Info, X, Menu } from 'lucide-react';
import { LOGO_URL } from './constants';

const MainApp: React.FC = () => {
  const { user, loading, isAdmin, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialFilter, setInitialFilter] = useState('Todos');
  const [mapFocus, setMapFocus] = useState<Incident | null>(null);

  useEffect(() => {
    // Attempt to sync offline incidents on app start
    if (navigator.onLine) {
      syncOfflineIncidents();
    }
  }, []);

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      setActiveTab('register');
    }
  }, [loading, user, isAdmin]);

  const handleNavigate = (tab: string, filter?: string) => {
    setActiveTab(tab);
    if (filter) {
      setInitialFilter(filter);
    } else if (tab !== 'incidents') {
      setInitialFilter('Todos');
    }
    
    if (tab !== 'incidents') setSearchQuery('');
    if (tab !== 'map') setMapFocus(null);
  };

  useEffect(() => {
    if (!user || loading) return;

    let q;
    if (isAdmin) {
      q = query(collection(db, 'incidents'));
    } else {
      // Remove orderBy to avoid composite index requirement
      q = query(
        collection(db, 'incidents'), 
        where('reporterUid', '==', user.uid)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Incident[];

      // Always sort client-side to be consistent and avoid query issues
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || 0;
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || 0;
        return timeB - timeA;
      });

      setIncidents(data);
    }, (err) => {
      console.error("Firestore onSnapshot error:", err);
      handleFirestoreError(err, OperationType.LIST, 'incidents');
      setError("Erro ao carregar dados em tempo real.");
    });

    return () => unsubscribe();
  }, [user, loading, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-light flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src={LOGO_URL} 
              alt="Logo Defesa Civil Corupá" 
              className="w-14 h-14 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-primary tracking-tight">Carregando Sistema...</h2>
          <p className="text-gray-400 text-sm mt-1">Sincronizando dados da Defesa Civil</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    // Role-based protection
    const allowedTabs = isAdmin ? ['dashboard', 'users', 'map', 'register', 'incidents'] : ['map', 'register', 'incidents'];
    
    if (!allowedTabs.includes(activeTab)) {
      return <IncidentForm />;
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard incidents={incidents} profile={profile} onNavigate={handleNavigate} />;
      case 'users': return <UserManagement />;
      case 'map': return (
        <div className="h-[calc(100vh-64px)] p-8">
          <MapView 
            incidents={incidents} 
            focusIncident={mapFocus}
            onMarkerClick={(incident) => {
              setSearchQuery(incident.id);
              setActiveTab('incidents');
            }}
          />
        </div>
      );
      case 'register': return (
        <IncidentForm 
          editIncident={editingIncident} 
          onCancel={() => {
            setEditingIncident(null);
            setActiveTab('incidents');
          }} 
        />
      );
      case 'incidents': return (
        <IncidentList 
          incidents={incidents} 
          profile={profile} 
          initialSearch={searchQuery}
          initialFilter={initialFilter}
          onEdit={(incident) => {
            setEditingIncident(incident);
            setActiveTab('register');
          }}
          onLocate={(incident) => {
            setMapFocus(incident);
            setActiveTab('map');
          }}
        />
      );
      default: return isAdmin ? <Dashboard incidents={incidents} profile={profile} /> : <IncidentForm />;
    }
  };

  return (
    <div className="min-h-screen bg-bg-light flex flex-col lg:flex-row">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleNavigate} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      {/* Mobile Header */}
      <header className="lg:hidden bg-primary text-white p-4 flex items-center justify-between flex-row-reverse sticky top-0 z-[1001] shadow-lg">
        <div 
          onClick={() => handleNavigate(isAdmin ? 'dashboard' : 'register')}
          className="flex items-center flex-row-reverse gap-3 text-right cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
        >
          <div className="bg-white p-1 rounded-lg w-10 h-10 flex items-center justify-center overflow-hidden shadow-sm">
            <img 
              src={LOGO_URL} 
              alt="Logo Defesa Civil Corupá" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="font-bold text-base">Defesa Civil Corupá</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 lg:ml-64 min-h-screen relative">
        <NotificationManager />
        <OfflineSyncIndicator />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="fixed bottom-8 right-8 z-[2000] bg-danger text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md border border-white/20"
            >
              <div className="bg-white/20 p-2 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">Erro Crítico</p>
                <p className="text-xs text-white/80">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

