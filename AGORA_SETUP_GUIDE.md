# 🎥 Agora Video Call Setup Guide

## 🚨 **Current Issue: Token Authentication Required**

**Error**: `CAN_NOT_GET_GATEWAY_SERVER: dynamic use static key`

**Cause**: Your Agora project is configured to require tokens, but we were trying to join without proper authentication.

## 🔧 **Solution Options**

### **Option 1: Disable Token Authentication (Easiest for Testing)**

1. **Go to Agora Console**: [https://console.agora.io/](https://console.agora.io/)
2. **Select your project**: HealthAI Video Consultation
3. **Go to Project Settings**
4. **Find "Authentication"** section
5. **Change from "App ID + Token" to "App ID only"**
6. **Save changes**

**Result**: Video calls will work without tokens (good for testing)

### **Option 2: Use Token Authentication (Production Ready)**

**Status**: ✅ **Already implemented!**

- Server now generates proper Agora tokens
- VideoTest page requests tokens from server
- Tokens are valid for 1 hour
- Automatic fallback to null token if generation fails

## 🧪 **Test the Fix**

### **Method 1: Test with Current Setup**
1. **Go to**: `http://localhost:3000/video-test`
2. **Click "Join Call"**
3. **Check browser console** for token generation logs
4. **Should work** if server generates tokens properly

### **Method 2: Disable Token Authentication**
1. **Change Agora project** to "App ID only" mode
2. **Test again** at `/video-test`
3. **Should work** without any tokens

## 📋 **Current Configuration**

### **Server Side (✅ Fixed)**
- ✅ Token generation endpoint: `/api/doctors/generate-video-token`
- ✅ Proper token building with your App Certificate
- ✅ Error handling and fallbacks
- ✅ 1-hour token expiry

### **Client Side (✅ Fixed)**
- ✅ Requests token from server before joining
- ✅ Falls back to null token if server fails
- ✅ Proper error handling and user feedback

### **Your Credentials**
- **App ID**: `e788e8f838484d4dafe4705d682df57c`
- **Certificate**: `086ed4e93fc6454d9025ab369959cb1a`
- **Status**: ✅ Configured in server

## 🔍 **Debugging Steps**

### **1. Check Server Logs**
```bash
# Look for these messages in server console:
# "Generated token: Token received" - Success
# "Generated token: No token (testing mode)" - Fallback
# "Error generating Agora token:" - Problem
```

### **2. Check Browser Console**
```javascript
// Look for these messages in browser console:
// "Generated token: Token received" - Success
// "Failed to get token from server, using null token" - Fallback
```

### **3. Test Token Generation Directly**
```bash
# Test the token endpoint directly:
curl -X POST http://localhost:5000/api/doctors/generate-video-token \
  -H "Content-Type: application/json" \
  -d '{"channelName":"test","uid":1234}'
```

## 🎯 **Expected Results**

### **With Tokens (Current Setup)**
- ✅ Server generates valid tokens
- ✅ Client joins with proper authentication
- ✅ Video call works with security

### **Without Tokens (Simplified)**
- ✅ No token generation needed
- ✅ Direct join with App ID only
- ✅ Good for testing and development

## 🚀 **Recommendation**

### **For Testing**: 
**Disable token authentication** in Agora Console (App ID only mode)

### **For Production**: 
**Keep token authentication** enabled (current setup is ready)

## 📱 **Alternative: Simple WebRTC**

If Agora continues to have issues, the system will automatically fall back to simple WebRTC using Google's STUN servers. This provides basic video calling without external dependencies.

---

**Next Step**: Try the video test again at `http://localhost:3000/video-test` - it should now work with proper token authentication! 🎉