import { useState, useEffect } from 'react';
import { wearableService } from '../services/api';
import {
  Watch, Heart, Footprints, Moon, RefreshCw, Plus, Battery,
  Link2, AlertCircle, Check, Loader2, Activity, Zap, TrendingUp,
  Smartphone, X, CheckCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

const AVAILABLE_INTEGRATIONS = [
  { 
    id: 'apple_watch', 
    name: 'Apple Watch', 
    icon: Watch, 
    description: 'Sync health data from your Apple Watch and iPhone', 
    tags: ['Heart Rate', 'Activity', 'Sleep'], 
    color: 'bg-slate-800',
    textColor: 'text-slate-800'
  },
  { 
    id: 'google_fit', 
    name: 'Google Fit', 
    icon: Activity, 
    description: 'Aggregates data from Android devices and apps', 
    tags: ['Activity', 'Nutrition', 'Weight'], 
    color: 'bg-blue-500',
    textColor: 'text-blue-600'
  },
  { 
    id: 'fitbit', 
    name: 'Fitbit', 
    icon: Zap, 
    description: 'Track steps, heart rate, and sleep patterns', 
    tags: ['Steps', 'Heart', 'Sleep'], 
    color: 'bg-cyan-500',
    textColor: 'text-cyan-600'
  },
  { 
    id: 'garmin', 
    name: 'Garmin Connect', 
    icon: TrendingUp, 
    description: 'High-fidelity GPS and heart rate data', 
    tags: ['Cardio', 'GPS', 'Training'], 
    color: 'bg-indigo-600',
    textColor: 'text-indigo-600'
  },
  { 
    id: 'samsung', 
    name: 'Samsung Health', 
    icon: Smartphone, 
    description: 'Galaxy Watch and phone health data', 
    tags: ['Activity', 'Sleep', 'Stress'], 
    color: 'bg-purple-600',
    textColor: 'text-purple-600'
  },
  { 
    id: 'oura', 
    name: 'Oura Ring', 
    icon: Moon, 
    description: 'Advanced sleep and recovery tracking', 
    tags: ['Sleep', 'Recovery', 'HRV'], 
    color: 'bg-slate-700',
    textColor: 'text-slate-700'
  }
];

export default function Wearables() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const { data } = await wearableService.getDashboard();
      if (data.devices) {
        setDevices(data.devices);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      if (devices.length > 0) {
        await wearableService.generateDemoData(devices[0].type);
        await fetchDevices();
        toast.success('All devices synced successfully!');
      } else {
        toast.error('No devices connected');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync devices');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async (deviceType) => {
    try {
      const integration = AVAILABLE_INTEGRATIONS.find(d => d.id === deviceType);
      await wearableService.connectDevice(deviceType, integration?.name);
      await wearableService.generateDemoData(deviceType);
      await fetchDevices();
      setShowConnectModal(false);
      toast.success(`${integration?.name} connected successfully!`);
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error('Failed to connect device');
    }
  };

  const handleDisconnect = async (deviceType) => {
    try {
      await wearableService.disconnectDevice(deviceType);
      await fetchDevices();
      toast.success('Device disconnected');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect device');
    }
  };

  const getDeviceIcon = (type) => {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === type);
    return integration?.icon || Watch;
  };

  const getDeviceColor = (type) => {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === type);
    return integration?.color || 'bg-slate-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Connected Devices</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Last synced: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSyncAll} 
            disabled={syncing || devices.length === 0} 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync All
          </button>
          <button 
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        </div>
      </div>

      {/* Info Banner */}
      {devices.length === 0 && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-cyan-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <p className="text-cyan-900 font-medium">No devices connected yet</p>
            <p className="text-cyan-700 text-sm mt-1">
              Connect your wearable devices to automatically track your health metrics and get personalized insights.
            </p>
          </div>
        </div>
      )}

      {/* Connected Devices */}
      {devices.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Your Devices</h2>
            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
              {devices.length} connected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device, i) => {
              const DeviceIcon = getDeviceIcon(device.type);
              const deviceColor = getDeviceColor(device.type);
              const battery = Math.floor(Math.random() * 50) + 50;
              
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${deviceColor} flex items-center justify-center`}>
                        <DeviceIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-slate-800 font-semibold">{device.name}</p>
                        <p className="text-slate-500 text-sm">{device.type}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  </div>

                  {/* Activity Visualization */}
                  <div className="flex gap-1 mb-4 h-16 bg-slate-50 rounded-lg p-2">
                    {[...Array(7)].map((_, j) => {
                      const height = 30 + Math.random() * 70;
                      return (
                        <div 
                          key={j} 
                          className="flex-1 bg-gradient-to-t from-purple-500 to-orange-500 rounded-sm" 
                          style={{ height: `${height}%`, marginTop: 'auto' }} 
                        />
                      );
                    })}
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Heart className="w-4 h-4" />
                        <span className="text-xs">Heart</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Footprints className="w-4 h-4" />
                        <span className="text-xs">Steps</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Moon className="w-4 h-4" />
                        <span className="text-xs">Sleep</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-xs">
                      <Battery className="w-4 h-4" />
                      {battery}%
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => handleSyncAll()}
                      className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                    >
                      Sync Now
                    </button>
                    <button 
                      onClick={() => handleDisconnect(device.type)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Watch className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Available Integrations</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            const isConnected = devices.some(d => d.type === integration.id);
            
            return (
              <div 
                key={integration.id} 
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl ${integration.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-slate-800 font-semibold">{integration.name}</p>
                        {isConnected && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-sm mb-3">{integration.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {integration.tags.map((tag) => (
                          <span 
                            key={tag} 
                            className="px-2 py-1 bg-slate-100 rounded-lg text-slate-600 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => isConnected ? handleDisconnect(integration.id) : handleConnect(integration.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isConnected 
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                        : 'bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:shadow-lg'
                    }`}
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Connect a Device</h2>
              <button 
                onClick={() => setShowConnectModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500 mb-6">Select a device or service to connect</p>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {AVAILABLE_INTEGRATIONS.map((integration) => {
                const Icon = integration.icon;
                const isConnected = devices.some(d => d.type === integration.id);
                
                return (
                  <button
                    key={integration.id}
                    onClick={() => !isConnected && handleConnect(integration.id)}
                    disabled={isConnected}
                    className={`w-full p-4 border rounded-xl transition-all flex items-center gap-4 text-left ${
                      isConnected 
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' 
                        : 'bg-white border-slate-200 hover:border-cyan-500 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${integration.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-800 font-medium">{integration.name}</p>
                        {isConnected && (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">{integration.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
