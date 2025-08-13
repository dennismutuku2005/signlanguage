"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Volume2, Pause, Play, Square, Settings } from "lucide-react"

interface TTSControlPanelProps {
  ttsClient: any
  onSettingsChange?: (settings: any) => void
}

export function TTSControlPanel({ ttsClient, onSettingsChange }: TTSControlPanelProps) {
  const [status, setStatus] = useState({
    isInitialized: false,
    isSpeaking: false,
    queueLength: 0,
    currentVoice: null,
    settings: { rate: 0.9, pitch: 1.0, volume: 0.9 },
  })
  const [voices, setVoices] = useState([])
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const updateStatus = () => {
      if (ttsClient) {
        const currentStatus = ttsClient.getStatus()
        setStatus(currentStatus)

        if (currentStatus.isInitialized) {
          setVoices(ttsClient.getVoices())
        }
      }
    }

    // Update status every second
    const interval = setInterval(updateStatus, 1000)
    updateStatus() // Initial update

    return () => clearInterval(interval)
  }, [ttsClient])

  const handleVoiceChange = (voiceName: string) => {
    if (ttsClient) {
      ttsClient.setVoice(voiceName)
      setStatus((prev) => ({ ...prev, currentVoice: voiceName }))
    }
  }

  const handleSettingChange = (setting: string, value: number) => {
    const newSettings = { ...status.settings, [setting]: value }

    if (ttsClient) {
      ttsClient.updateSettings(newSettings)
      setStatus((prev) => ({ ...prev, settings: newSettings }))
      onSettingsChange?.(newSettings)
    }
  }

  const handleStop = () => {
    if (ttsClient) {
      ttsClient.stop()
    }
  }

  const handlePause = () => {
    if (ttsClient) {
      if (status.isSpeaking) {
        ttsClient.pause()
      } else {
        ttsClient.resume()
      }
    }
  }

  const testSpeech = () => {
    if (ttsClient) {
      ttsClient.speak("This is a test of the natural text to speech system. How does it sound?", null, "normal")
    }
  }

  return (
    <Card className="w-full max-w-md bg-slate-900/50 border-blue-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-100">
          <Volume2 className="h-5 w-5" />
          Voice Control
        </CardTitle>
        <CardDescription className="text-slate-400">Natural text-to-speech settings</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={status.isInitialized ? "default" : "secondary"} className="bg-blue-600">
            {status.isInitialized ? "Ready" : "Initializing"}
          </Badge>
          <Badge variant={status.isSpeaking ? "default" : "secondary"} className="bg-green-600">
            {status.isSpeaking ? "Speaking" : "Silent"}
          </Badge>
          {status.queueLength > 0 && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-400">
              Queue: {status.queueLength}
            </Badge>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={testSpeech}
            disabled={!status.isInitialized}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Test Voice
          </Button>

          <Button
            onClick={handlePause}
            disabled={!status.isInitialized}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
          >
            {status.isSpeaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <Button
            onClick={handleStop}
            disabled={!status.isInitialized}
            variant="outline"
            className="border-red-600 text-red-400 hover:bg-red-900/20 bg-transparent"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {/* Voice Selection */}
        {voices.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Voice</label>
            <Select value={status.currentVoice || ""} onValueChange={handleVoiceChange}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {voices.map((voice: any) => (
                  <SelectItem key={voice.name} value={voice.name} className="text-slate-200 focus:bg-slate-700">
                    {voice.name} {voice.localService && "(Local)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Settings Toggle */}
        <Button
          onClick={() => setShowSettings(!showSettings)}
          variant="ghost"
          className="w-full text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <Settings className="h-4 w-4 mr-2" />
          {showSettings ? "Hide" : "Show"} Advanced Settings
        </Button>

        {/* Advanced Settings */}
        {showSettings && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            {/* Speech Rate */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Speech Rate: {status.settings.rate.toFixed(1)}x
              </label>
              <Slider
                value={[status.settings.rate]}
                onValueChange={([value]) => handleSettingChange("rate", value)}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Pitch */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Pitch: {status.settings.pitch.toFixed(1)}</label>
              <Slider
                value={[status.settings.pitch]}
                onValueChange={([value]) => handleSettingChange("pitch", value)}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Volume: {Math.round(status.settings.volume * 100)}%
              </label>
              <Slider
                value={[status.settings.volume]}
                onValueChange={([value]) => handleSettingChange("volume", value)}
                min={0.1}
                max={1.0}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
