# Network Access Guide

## Access the Application from Other Devices

Your application is now configured to be accessible from other devices on your local network!

### 🌐 Access URLs

**From the same computer (localhost):**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

**From other devices on the same network:**
- Frontend: http://192.168.1.197:5173
- Backend API: http://192.168.1.197:5000

### 📱 How to Access from Mobile/Tablet/Another Laptop

1. **Make sure your device is on the same WiFi network** as your computer
2. Open a web browser on your device
3. Enter the URL: `http://192.168.1.197:5173`
4. The application should load and work normally!

### 🔧 Configuration Changes Made

1. **Vite Config** (`client/vite.config.js`):
   - Set `host: '0.0.0.0'` to allow network access
   - Port: 5173
   - Proxy configured to forward `/api` requests to `http://localhost:5000`

2. **Server Config** (`server/server.js`):
   - Server listens on `0.0.0.0` (all network interfaces)
   - Port: 5000
   - CORS enabled for all origins

### 🔥 Firewall Settings

If you can't access from other devices, you may need to allow the ports through Windows Firewall:

**Option 1: Using Windows Defender Firewall**
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Select "TCP" and enter ports: `5173, 5000`
6. Allow the connection
7. Apply to all profiles (Domain, Private, Public)
8. Name it "HealthAI App"

**Option 2: Using Command Prompt (Run as Administrator)**
```cmd
netsh advfirewall firewall add rule name="HealthAI Frontend" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="HealthAI Backend" dir=in action=allow protocol=TCP localport=5000
```

### 🔍 Troubleshooting

**Can't access from other devices?**

1. **Check if both servers are running:**
   - Frontend should show: `Network: http://192.168.1.197:5174/`
   - Backend should show: `Server running on port 3000`

2. **Verify your local IP hasn't changed:**
   ```cmd
   ipconfig
   ```
   Look for "IPv4 Address" under your active network adapter

3. **Test connectivity:**
   - From another device, try pinging your computer:
   ```
   ping 192.168.1.197
   ```

4. **Check Windows Firewall:**
   - Temporarily disable firewall to test if it's blocking
   - If it works, add firewall rules as shown above

5. **Restart both servers:**
   - Stop the processes
   - Start backend: `cd server && npm start`
   - Start frontend: `cd client && npm run dev`

### 📝 Notes

- Your local IP address may change if you restart your router or computer
- If IP changes, update the URLs accordingly
- For production deployment, you'll need a proper domain and hosting
- This setup is for local network testing only

### 🚀 Quick Start Commands

**Start Backend:**
```bash
cd healthcare-ai-platform/server
npm start
```

**Start Frontend:**
```bash
cd healthcare-ai-platform/client
npm run dev
```

Both servers are now running and accessible from any device on your network!
