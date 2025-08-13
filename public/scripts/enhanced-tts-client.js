// Enhanced Text-to-Speech client with natural voice processing
class EnhancedTTSClient {
  constructor() {
    this.synthesis = window.speechSynthesis
    this.voices = []
    this.currentVoice = null
    this.isInitialized = false
    this.speechQueue = []
    this.isSpeaking = false

    // Natural voice settings
    this.voiceSettings = {
      rate: 0.9, // Slightly slower for more natural speech
      pitch: 1.0, // Normal pitch
      volume: 0.9, // High volume
      pauseBetween: 500, // Pause between sentences in ms
    }

    // Emotional contexts for different signs
    this.emotionalContexts = {
      hello: { rate: 1.0, pitch: 1.1, volume: 0.95, tone: "friendly" },
      thank_you: { rate: 0.8, pitch: 0.9, volume: 0.85, tone: "grateful" },
      sorry: { rate: 0.7, pitch: 0.8, volume: 0.8, tone: "apologetic" },
      help: { rate: 0.9, pitch: 1.0, volume: 0.95, tone: "urgent" },
      please: { rate: 0.8, pitch: 0.9, volume: 0.85, tone: "polite" },
      love: { rate: 0.75, pitch: 0.95, volume: 0.9, tone: "warm" },
      good: { rate: 0.95, pitch: 1.05, volume: 0.9, tone: "positive" },
      bad: { rate: 0.85, pitch: 0.9, volume: 0.85, tone: "concerned" },
    }

    this.initialize()
  }

  async initialize() {
    return new Promise((resolve) => {
      // Wait for voices to load
      const loadVoices = () => {
        this.voices = this.synthesis.getVoices()
        if (this.voices.length > 0) {
          this.selectBestVoice()
          this.isInitialized = true
          resolve()
        } else {
          // Try again after a short delay
          setTimeout(loadVoices, 100)
        }
      }

      // Handle voice loading
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = loadVoices
      }

      loadVoices()
    })
  }

  selectBestVoice() {
    // Prefer natural-sounding English voices
    const preferredVoices = [
      "Google US English",
      "Microsoft Zira - English (United States)",
      "Microsoft David - English (United States)",
      "Alex",
      "Samantha",
      "Karen",
      "Moira",
    ]

    // Try to find preferred voice
    for (const preferred of preferredVoices) {
      const voice = this.voices.find(
        (v) => v.name.includes(preferred) || v.name.toLowerCase().includes(preferred.toLowerCase()),
      )
      if (voice) {
        this.currentVoice = voice
        return
      }
    }

    // Fallback to first English voice
    const englishVoice = this.voices.find((v) => v.lang.startsWith("en") && v.localService)

    if (englishVoice) {
      this.currentVoice = englishVoice
    } else {
      this.currentVoice = this.voices[0]
    }
  }

  enhanceTextForSpeech(text, signType = null) {
    let enhancedText = text

    if (signType && this.emotionalContexts[signType]) {
      const context = this.emotionalContexts[signType]
      const tone = context.tone

      // Add natural expressions based on tone
      switch (tone) {
        case "friendly":
          enhancedText = `Hello there! ${enhancedText}`
          break
        case "grateful":
          enhancedText = `${enhancedText}. I really appreciate it.`
          break
        case "apologetic":
          enhancedText = `I'm ${enhancedText}. Please forgive me.`
          break
        case "urgent":
          enhancedText = `I need ${enhancedText}. Can you help me?`
          break
        case "polite":
          enhancedText = `${enhancedText}. Would that be possible?`
          break
        case "warm":
          enhancedText = `I ${enhancedText} you so much.`
          break
        case "positive":
          enhancedText = `That's ${enhancedText}! Excellent!`
          break
        case "concerned":
          enhancedText = `That's ${enhancedText}. I'm worried about this.`
          break
      }
    }

    // Add natural pauses and emphasis
    enhancedText = enhancedText.replace(/\./g, "... ")
    enhancedText = enhancedText.replace(/!/g, "! ")
    enhancedText = enhancedText.replace(/\?/g, "? ")

    return enhancedText
  }

  createUtterance(text, signType = null) {
    const enhancedText = this.enhanceTextForSpeech(text, signType)
    const utterance = new SpeechSynthesisUtterance(enhancedText)

    // Apply voice
    if (this.currentVoice) {
      utterance.voice = this.currentVoice
    }

    // Apply contextual settings
    if (signType && this.emotionalContexts[signType]) {
      const context = this.emotionalContexts[signType]
      utterance.rate = context.rate
      utterance.pitch = context.pitch
      utterance.volume = context.volume
    } else {
      // Apply default settings
      utterance.rate = this.voiceSettings.rate
      utterance.pitch = this.voiceSettings.pitch
      utterance.volume = this.voiceSettings.volume
    }

    return utterance
  }

  async speak(text, signType = null, priority = "normal") {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const speechItem = {
      text,
      signType,
      priority,
      timestamp: Date.now(),
    }

    // Handle priority
    if (priority === "urgent") {
      // Clear queue and stop current speech
      this.synthesis.cancel()
      this.speechQueue = []
      this.isSpeaking = false
    }

    this.speechQueue.push(speechItem)

    if (!this.isSpeaking) {
      this.processQueue()
    }
  }

  async processQueue() {
    if (this.speechQueue.length === 0 || this.isSpeaking) {
      return
    }

    this.isSpeaking = true
    const speechItem = this.speechQueue.shift()

    const utterance = this.createUtterance(speechItem.text, speechItem.signType)

    // Set up event handlers
    utterance.onstart = () => {
      console.log(`Speaking: ${speechItem.text}`)
    }

    utterance.onend = () => {
      this.isSpeaking = false

      // Add natural pause between speeches
      setTimeout(() => {
        this.processQueue()
      }, this.voiceSettings.pauseBetween)
    }

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event.error)
      this.isSpeaking = false
      this.processQueue()
    }

    // Speak the utterance
    this.synthesis.speak(utterance)
  }

  stop() {
    this.synthesis.cancel()
    this.speechQueue = []
    this.isSpeaking = false
  }

  pause() {
    this.synthesis.pause()
  }

  resume() {
    this.synthesis.resume()
  }

  getVoices() {
    return this.voices.map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default,
    }))
  }

  setVoice(voiceName) {
    const voice = this.voices.find((v) => v.name === voiceName)
    if (voice) {
      this.currentVoice = voice
      return true
    }
    return false
  }

  updateSettings(settings) {
    this.voiceSettings = { ...this.voiceSettings, ...settings }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isSpeaking: this.isSpeaking,
      queueLength: this.speechQueue.length,
      currentVoice: this.currentVoice ? this.currentVoice.name : null,
      settings: this.voiceSettings,
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = EnhancedTTSClient
} else if (typeof window !== "undefined") {
  window.EnhancedTTSClient = EnhancedTTSClient
}
