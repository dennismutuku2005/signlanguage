const express = require("express")
const cors = require("cors")
const axios = require("axios")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

const app = express()
const PORT = process.env.PORT || 3001
const PYTHON_API_URL = "http://localhost:5000"

// Middleware
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

// In-memory cache for recent detections
const detectionCache = {
  recentDetections: [],
  currentText: "",
  lastUpdate: null,
  confidence: 0,
}

// Utility functions
const logWithTimestamp = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

const checkPythonAPIHealth = async () => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/health`, { timeout: 5000 })
    return response.status === 200
  } catch (error) {
    return false
  }
}

// Routes

// Health check endpoint
app.get("/health", async (req, res) => {
  const pythonAPIHealthy = await checkPythonAPIHealth()

  res.json({
    status: "healthy",
    service: "coordination_server",
    timestamp: new Date().toISOString(),
    python_api_status: pythonAPIHealthy ? "healthy" : "unhealthy",
    cache_size: detectionCache.recentDetections.length,
  })
})

// Process video frame for sign language detection
app.post("/api/detect-sign", async (req, res) => {
  try {
    const { frame } = req.body

    if (!frame) {
      return res.status(400).json({
        error: "No frame data provided",
        timestamp: new Date().toISOString(),
      })
    }

    logWithTimestamp("Processing sign language detection request")

    // Forward request to Python API
    const pythonResponse = await axios.post(
      `${PYTHON_API_URL}/detect`,
      {
        frame: frame,
      },
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    const detectionResult = pythonResponse.data

    // Update cache with new detection
    if (detectionResult.detected_gesture) {
      detectionCache.recentDetections.push({
        gesture: detectionResult.detected_gesture,
        confidence: detectionResult.confidence,
        timestamp: new Date().toISOString(),
      })

      // Keep only last 20 detections
      if (detectionCache.recentDetections.length > 20) {
        detectionCache.recentDetections.shift()
      }

      // Update current text if confidence is high enough
      if (detectionResult.confidence > 0.6) {
        detectionCache.currentText = detectionResult.detected_gesture
        detectionCache.confidence = detectionResult.confidence
        detectionCache.lastUpdate = new Date().toISOString()
      }
    }

    // Return enhanced response
    res.json({
      ...detectionResult,
      server_timestamp: new Date().toISOString(),
      cache_updated: true,
    })
  } catch (error) {
    logWithTimestamp(`Error in sign detection: ${error.message}`)

    if (error.code === "ECONNREFUSED") {
      res.status(503).json({
        error: "Python API is not available",
        message: "Please make sure the sign language detection API is running on port 5000",
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    }
  }
})

// Get current detected text
app.get("/api/get-text", async (req, res) => {
  try {
    // Try to get fresh data from Python API
    const pythonResponse = await axios.get(`${PYTHON_API_URL}/get_text`, {
      timeout: 5000,
    })

    const textResult = pythonResponse.data

    // Update cache if we got new data
    if (textResult.text && textResult.confidence > detectionCache.confidence) {
      detectionCache.currentText = textResult.text
      detectionCache.confidence = textResult.confidence
      detectionCache.lastUpdate = new Date().toISOString()
    }

    res.json({
      text: textResult.text || detectionCache.currentText,
      gesture: textResult.gesture,
      confidence: textResult.confidence || detectionCache.confidence,
      last_update: detectionCache.lastUpdate,
      source: textResult.text ? "python_api" : "cache",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logWithTimestamp(`Error getting text: ${error.message}`)

    // Fallback to cache
    res.json({
      text: detectionCache.currentText,
      gesture: null,
      confidence: detectionCache.confidence,
      last_update: detectionCache.lastUpdate,
      source: "cache_fallback",
      timestamp: new Date().toISOString(),
    })
  }
})

// Get detection history
app.get("/api/history", (req, res) => {
  const limit = Number.parseInt(req.query.limit) || 10
  const recentDetections = detectionCache.recentDetections.slice(-limit)

  res.json({
    detections: recentDetections,
    total_count: detectionCache.recentDetections.length,
    timestamp: new Date().toISOString(),
  })
})

// Clear detection cache
app.post("/api/clear-cache", (req, res) => {
  detectionCache.recentDetections = []
  detectionCache.currentText = ""
  detectionCache.confidence = 0
  detectionCache.lastUpdate = null

  logWithTimestamp("Detection cache cleared")

  res.json({
    message: "Cache cleared successfully",
    timestamp: new Date().toISOString(),
  })
})

// Text-to-speech endpoint (enhanced)
app.post("/api/speak", (req, res) => {
  const { text, voice, rate, pitch } = req.body

  if (!text) {
    return res.status(400).json({
      error: "No text provided",
      timestamp: new Date().toISOString(),
    })
  }

  // Log speech request
  logWithTimestamp(`Speech request: "${text}"`)

  // Return configuration for client-side speech synthesis
  res.json({
    text: text,
    voice_config: {
      rate: rate || 0.9,
      pitch: pitch || 1.0,
      volume: 1.0,
      voice_preference: voice || "natural",
    },
    timestamp: new Date().toISOString(),
    message: "Speech configuration sent to client",
  })
})

// Get available gestures
app.get("/api/gestures", async (req, res) => {
  try {
    // This would ideally come from the Python API
    const availableGestures = [
      { name: "hello", description: "Open palm facing forward" },
      { name: "thank_you", description: "Hand moving from chin outward" },
      { name: "please", description: "Circular motion on chest" },
      { name: "yes", description: "Nodding motion or closed fist" },
      { name: "no", description: "Index finger pointing or waving" },
      { name: "good", description: "Thumbs up" },
      { name: "bad", description: "Thumbs down" },
      { name: "help", description: "One hand on top of the other" },
      { name: "water", description: "W shape with fingers" },
      { name: "food", description: "Hand to mouth motion" },
    ]

    res.json({
      gestures: availableGestures,
      total_count: availableGestures.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      error: "Error fetching gestures",
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Statistics endpoint
app.get("/api/stats", (req, res) => {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const recentDetections = detectionCache.recentDetections.filter(
    (detection) => new Date(detection.timestamp) > oneHourAgo,
  )

  const gestureStats = {}
  recentDetections.forEach((detection) => {
    gestureStats[detection.gesture] = (gestureStats[detection.gesture] || 0) + 1
  })

  res.json({
    total_detections: detectionCache.recentDetections.length,
    recent_detections_1h: recentDetections.length,
    gesture_frequency: gestureStats,
    current_text: detectionCache.currentText,
    last_update: detectionCache.lastUpdate,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

// Error handling middleware
app.use((error, req, res, next) => {
  logWithTimestamp(`Unhandled error: ${error.message}`)
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  })
})

// Graceful shutdown
process.on("SIGINT", () => {
  logWithTimestamp("Received SIGINT, shutting down gracefully...")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logWithTimestamp("Received SIGTERM, shutting down gracefully...")
  process.exit(0)
})

// Start server
app.listen(PORT, () => {
  logWithTimestamp(`Coordination Server started on port ${PORT}`)
  logWithTimestamp(`Python API URL: ${PYTHON_API_URL}`)
  logWithTimestamp("Available endpoints:")
  logWithTimestamp("  POST /api/detect-sign - Process video frame")
  logWithTimestamp("  GET  /api/get-text - Get detected text")
  logWithTimestamp("  GET  /api/history - Get detection history")
  logWithTimestamp("  POST /api/clear-cache - Clear detection cache")
  logWithTimestamp("  POST /api/speak - Text-to-speech configuration")
  logWithTimestamp("  GET  /api/gestures - Available gestures")
  logWithTimestamp("  GET  /api/stats - Detection statistics")
  logWithTimestamp("  GET  /health - Health check")

  // Check Python API on startup
  checkPythonAPIHealth().then((healthy) => {
    if (healthy) {
      logWithTimestamp("✅ Python API is healthy and reachable")
    } else {
      logWithTimestamp("⚠️  Python API is not reachable - some features may not work")
    }
  })
})

module.exports = app
