"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TTSControlPanel } from "@/components/tts-control-panel"
import { Camera, Play, Square, Settings, Brain, Eye, AlertCircle, CheckCircle, Loader2 } from "lucide-react"

// Enhanced TTS Client (will be loaded dynamically)
declare global {
  interface Window {
    EnhancedTTSClient: any
  }
}

interface DetectionResult {
  detected_sign: string
  confidence: number
  description: string
  timestamp: number
  is_new_detection?: boolean
}

interface SystemStatus {
  camera: "disconnected" | "connecting" | "connected" | "error"
  detection: "inactive" | "active" | "processing" | "error"
  tts: "inactive" | "ready" | "speaking" | "error"
  coordination: "disconnected" | "connected" | "error"
}

export default function SignLanguageDetector() {
  // Camera and video refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // TTS system
  const ttsClientRef = useRef<any>(null)

  // State management
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    camera: "disconnected",
    detection: "inactive",
    tts: "inactive",
    coordination: "disconnected",
  })

  const [isDetectionActive, setIsDetectionActive] = useState(false)
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null)
  const [recentDetections, setRecentDetections] = useState<DetectionResult[]>([])
  const [detectionStats, setDetectionStats] = useState({
    totalDetections: 0,
    uniqueSigns: 0,
    sessionTime: 0,
  })

  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize systems on component mount
  useEffect(() => {
    initializeSystems()
    return () => {
      cleanup()
    }
  }, [])

  const initializeSystems = async () => {
    setIsInitializing(true)
    setError(null)

    try {
      // Initialize TTS system
      await initializeTTS()

      // Initialize camera
      await initializeCamera()

      // Test coordination server
      await testCoordinationServer()

      setIsInitializing(false)
    } catch (err) {
      setError(`Initialization failed: ${err instanceof Error ? err.message : "Unknown error"}`)
      setIsInitializing(false)
    }
  }

  const initializeTTS = async () => {
    try {
      setSystemStatus((prev) => ({ ...prev, tts: "inactive" }))

      // Load TTS client script dynamically
      if (!window.EnhancedTTSClient) {
        const script = document.createElement("script")
        script.src = "/scripts/enhanced-tts-client.js"
        document.head.appendChild(script)

        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
        })
      }

      // Initialize TTS client
      ttsClientRef.current = new window.EnhancedTTSClient()
      await ttsClientRef.current.initialize()

      setSystemStatus((prev) => ({ ...prev, tts: "ready" }))
    } catch (err) {
      setSystemStatus((prev) => ({ ...prev, tts: "error" }))
      throw new Error(`TTS initialization failed: ${err}`)
    }
  }

  const initializeCamera = async () => {
    try {
      setSystemStatus((prev) => ({ ...prev, camera: "connecting" }))

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve
          }
        })
      }

      setSystemStatus((prev) => ({ ...prev, camera: "connected" }))
    } catch (err) {
      setSystemStatus((prev) => ({ ...prev, camera: "error" }))
      throw new Error(`Camera access failed: ${err}`)
    }
  }

  const testCoordinationServer = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/health")
      if (response.ok) {
        setSystemStatus((prev) => ({ ...prev, coordination: "connected" }))
      } else {
        throw new Error("Server not responding")
      }
    } catch (err) {
      setSystemStatus((prev) => ({ ...prev, coordination: "error" }))
      // Don't throw here - coordination server is optional
      console.warn("Coordination server not available, using direct API calls")
    }
  }

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    return canvas.toDataURL("image/jpeg", 0.8)
  }, [])

  const processFrame = useCallback(
    async (imageData: string) => {
      try {
        setSystemStatus((prev) => ({ ...prev, detection: "processing" }))

        // Try coordination server first, fallback to direct API
        let response
        const apiUrl =
          systemStatus.coordination === "connected"
            ? "http://localhost:3001/api/detect"
            : "http://localhost:5001/api/detect"

        response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageData }),
        })

        if (!response.ok) {
          throw new Error(`Detection API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.success && result.detected_sign) {
          const detection: DetectionResult = {
            detected_sign: result.detected_sign,
            confidence: result.confidence,
            description: result.description,
            timestamp: Date.now(),
            is_new_detection: result.is_new_detection,
          }

          setCurrentDetection(detection)

          // Add to recent detections
          setRecentDetections((prev) => [detection, ...prev.slice(0, 9)])

          // Update stats
          setDetectionStats((prev) => ({
            ...prev,
            totalDetections: prev.totalDetections + 1,
          }))

          // Speak the detection if it's new
          if (result.is_new_detection && ttsClientRef.current) {
            setSystemStatus((prev) => ({ ...prev, tts: "speaking" }))

            await ttsClientRef.current.speak(result.description, result.detected_sign, "normal")

            setTimeout(() => {
              setSystemStatus((prev) => ({ ...prev, tts: "ready" }))
            }, 2000)
          }
        }

        setSystemStatus((prev) => ({ ...prev, detection: "active" }))
      } catch (err) {
        console.error("Frame processing error:", err)
        setSystemStatus((prev) => ({ ...prev, detection: "error" }))
      }
    },
    [systemStatus.coordination],
  )

  const startDetection = useCallback(() => {
    if (!isDetectionActive && systemStatus.camera === "connected") {
      setIsDetectionActive(true)
      setSystemStatus((prev) => ({ ...prev, detection: "active" }))

      const detectLoop = () => {
        if (isDetectionActive) {
          const imageData = captureFrame()
          if (imageData) {
            processFrame(imageData)
          }
          setTimeout(detectLoop, 1000) // Process every second
        }
      }

      detectLoop()
    }
  }, [isDetectionActive, systemStatus.camera, captureFrame, processFrame])

  const stopDetection = () => {
    setIsDetectionActive(false)
    setSystemStatus((prev) => ({ ...prev, detection: "inactive" }))
    setCurrentDetection(null)
  }

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    if (ttsClientRef.current) {
      ttsClientRef.current.stop()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "ready":
      case "active":
        return "bg-green-600"
      case "connecting":
      case "processing":
      case "speaking":
        return "bg-yellow-600"
      case "error":
        return "bg-red-600"
      default:
        return "bg-gray-600"
    }
  }

  const getStatusIcon = (system: keyof SystemStatus) => {
    const status = systemStatus[system]
    const iconClass = "h-4 w-4"

    if (status === "error") return <AlertCircle className={iconClass} />
    if (status === "connected" || status === "ready" || status === "active")
      return <CheckCircle className={iconClass} />
    if (status === "connecting" || status === "processing" || status === "speaking")
      return <Loader2 className={`${iconClass} animate-spin`} />
    return <AlertCircle className={iconClass} />
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="w-96 bg-slate-900/50 border-blue-500/20">
          <CardHeader className="text-center">
            <CardTitle className="text-blue-100 flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              Initializing Systems
            </CardTitle>
            <CardDescription className="text-slate-400">
              Setting up camera, AI detection, and voice synthesis...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={66} className="w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-blue-100">AI Sign Language Translator</h1>
          <p className="text-slate-400 text-lg">Real-time sign language detection with natural voice synthesis</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-500/20 bg-red-900/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {/* System Status */}
        <Card className="bg-slate-900/50 border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-blue-100 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                {getStatusIcon("camera")}
                <span className="text-slate-300">Camera</span>
                <Badge className={getStatusColor(systemStatus.camera)}>{systemStatus.camera}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon("detection")}
                <span className="text-slate-300">Detection</span>
                <Badge className={getStatusColor(systemStatus.detection)}>{systemStatus.detection}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon("tts")}
                <span className="text-slate-300">Voice</span>
                <Badge className={getStatusColor(systemStatus.tts)}>{systemStatus.tts}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon("coordination")}
                <span className="text-slate-300">Server</span>
                <Badge className={getStatusColor(systemStatus.coordination)}>{systemStatus.coordination}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-blue-500/20">
              <CardHeader>
                <CardTitle className="text-blue-100 flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Live Camera Feed
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Position yourself in front of the camera and make sign language gestures
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Video Display */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Detection Overlay */}
                  {currentDetection && (
                    <div className="absolute top-4 left-4 bg-blue-600/90 text-white px-3 py-2 rounded-lg">
                      <div className="font-semibold">{currentDetection.detected_sign.toUpperCase()}</div>
                      <div className="text-sm opacity-90">
                        {Math.round(currentDetection.confidence * 100)}% confidence
                      </div>
                    </div>
                  )}

                  {/* Recording Indicator */}
                  {isDetectionActive && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/90 text-white px-3 py-2 rounded-lg">
                      <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">DETECTING</span>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                  <Button
                    onClick={isDetectionActive ? stopDetection : startDetection}
                    disabled={systemStatus.camera !== "connected"}
                    className={`flex-1 ${
                      isDetectionActive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isDetectionActive ? (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        Stop Detection
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Detection
                      </>
                    )}
                  </Button>
                </div>

                {/* Current Detection */}
                {currentDetection && (
                  <Card className="bg-blue-900/30 border-blue-500/30">
                    <CardContent className="pt-4">
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-blue-100">
                          {currentDetection.detected_sign.toUpperCase()}
                        </h3>
                        <p className="text-slate-300">{currentDetection.description}</p>
                        <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
                          <span>Confidence: {Math.round(currentDetection.confidence * 100)}%</span>
                          <span>•</span>
                          <span>{new Date(currentDetection.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* TTS Control Panel */}
            {ttsClientRef.current && (
              <TTSControlPanel
                ttsClient={ttsClientRef.current}
                onSettingsChange={(settings) => {
                  console.log("TTS settings updated:", settings)
                }}
              />
            )}

            {/* Detection History */}
            <Card className="bg-slate-900/50 border-blue-500/20">
              <CardHeader>
                <CardTitle className="text-blue-100 flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Recent Detections
                </CardTitle>
                <CardDescription className="text-slate-400">Last 10 detected signs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentDetections.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">
                      No detections yet. Start detection to see results.
                    </p>
                  ) : (
                    recentDetections.map((detection, index) => (
                      <div
                        key={`${detection.timestamp}-${index}`}
                        className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-blue-200">{detection.detected_sign}</div>
                          <div className="text-xs text-slate-400">
                            {Math.round(detection.confidence * 100)}% confidence
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(detection.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card className="bg-slate-900/50 border-blue-500/20">
              <CardHeader>
                <CardTitle className="text-blue-100 flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Session Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total Detections</span>
                    <span className="text-blue-200 font-medium">{detectionStats.totalDetections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Unique Signs</span>
                    <span className="text-blue-200 font-medium">
                      {new Set(recentDetections.map((d) => d.detected_sign)).size}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Detection Active</span>
                    <Badge className={isDetectionActive ? "bg-green-600" : "bg-gray-600"}>
                      {isDetectionActive ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
