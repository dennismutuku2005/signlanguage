#!/usr/bin/env node

const axios = require("axios")
const fs = require("fs")

const SERVER_URL = "http://localhost:3001"

// Test utilities
const logTest = (testName, status, message = "") => {
  const statusIcon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏳"
  console.log(`${statusIcon} ${testName}: ${message}`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Test functions
async function testHealthEndpoint() {
  try {
    const response = await axios.get(`${SERVER_URL}/health`)
    if (response.status === 200 && response.data.status === "healthy") {
      logTest("Health Check", "PASS", "Server is healthy")
      return true
    } else {
      logTest("Health Check", "FAIL", "Unexpected response")
      return false
    }
  } catch (error) {
    logTest("Health Check", "FAIL", `Cannot connect: ${error.message}`)
    return false
  }
}

async function testGetGestures() {
  try {
    const response = await axios.get(`${SERVER_URL}/api/gestures`)
    if (response.status === 200 && response.data.gestures) {
      logTest("Get Gestures", "PASS", `Found ${response.data.gestures.length} gestures`)
      return true
    } else {
      logTest("Get Gestures", "FAIL", "Invalid response format")
      return false
    }
  } catch (error) {
    logTest("Get Gestures", "FAIL", error.message)
    return false
  }
}

async function testGetText() {
  try {
    const response = await axios.get(`${SERVER_URL}/api/get-text`)
    if (response.status === 200) {
      logTest("Get Text", "PASS", `Current text: "${response.data.text || "none"}"`)
      return true
    } else {
      logTest("Get Text", "FAIL", "Invalid response")
      return false
    }
  } catch (error) {
    logTest("Get Text", "FAIL", error.message)
    return false
  }
}

async function testHistory() {
  try {
    const response = await axios.get(`${SERVER_URL}/api/history`)
    if (response.status === 200 && Array.isArray(response.data.detections)) {
      logTest("Get History", "PASS", `${response.data.detections.length} detections in history`)
      return true
    } else {
      logTest("Get History", "FAIL", "Invalid response format")
      return false
    }
  } catch (error) {
    logTest("Get History", "FAIL", error.message)
    return false
  }
}

async function testStats() {
  try {
    const response = await axios.get(`${SERVER_URL}/api/stats`)
    if (response.status === 200 && typeof response.data.uptime === "number") {
      logTest("Get Stats", "PASS", `Server uptime: ${Math.round(response.data.uptime)}s`)
      return true
    } else {
      logTest("Get Stats", "FAIL", "Invalid response format")
      return false
    }
  } catch (error) {
    logTest("Get Stats", "FAIL", error.message)
    return false
  }
}

async function testClearCache() {
  try {
    const response = await axios.post(`${SERVER_URL}/api/clear-cache`)
    if (response.status === 200) {
      logTest("Clear Cache", "PASS", "Cache cleared successfully")
      return true
    } else {
      logTest("Clear Cache", "FAIL", "Unexpected response")
      return false
    }
  } catch (error) {
    logTest("Clear Cache", "FAIL", error.message)
    return false
  }
}

async function testSpeakEndpoint() {
  try {
    const response = await axios.post(`${SERVER_URL}/api/speak`, {
      text: "Hello world",
      rate: 0.9,
      pitch: 1.0,
    })
    if (response.status === 200 && response.data.voice_config) {
      logTest("Speak Endpoint", "PASS", "Speech configuration returned")
      return true
    } else {
      logTest("Speak Endpoint", "FAIL", "Invalid response format")
      return false
    }
  } catch (error) {
    logTest("Speak Endpoint", "FAIL", error.message)
    return false
  }
}

async function testDetectSign() {
  try {
    // Create a dummy base64 image (1x1 pixel)
    const dummyImage =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A"

    const response = await axios.post(`${SERVER_URL}/api/detect-sign`, {
      frame: dummyImage,
    })

    if (response.status === 200) {
      logTest("Detect Sign", "PASS", "Detection endpoint responded (may need Python API)")
      return true
    } else {
      logTest("Detect Sign", "FAIL", "Unexpected response")
      return false
    }
  } catch (error) {
    if (error.response && error.response.status === 503) {
      logTest("Detect Sign", "PASS", "Endpoint works (Python API not available)")
      return true
    } else {
      logTest("Detect Sign", "FAIL", error.message)
      return false
    }
  }
}

// Main test runner
async function runTests() {
  console.log("🧪 Node.js Coordination Server Test Suite")
  console.log("=".repeat(50))
  console.log(`Testing server at: ${SERVER_URL}`)
  console.log("")

  const tests = [
    { name: "Health Check", func: testHealthEndpoint },
    { name: "Get Gestures", func: testGetGestures },
    { name: "Get Text", func: testGetText },
    { name: "Get History", func: testHistory },
    { name: "Get Stats", func: testStats },
    { name: "Clear Cache", func: testClearCache },
    { name: "Speak Endpoint", func: testSpeakEndpoint },
    { name: "Detect Sign", func: testDetectSign },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    logTest(test.name, "RUNNING", "Testing...")
    const result = await test.func()
    if (result) {
      passed++
    } else {
      failed++
    }
    await sleep(500) // Small delay between tests
  }

  console.log("")
  console.log("=".repeat(50))
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`)

  if (failed === 0) {
    console.log("🎉 All tests passed! Server is working correctly.")
  } else {
    console.log("⚠️  Some tests failed. Check the server configuration.")
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error("❌ Test suite failed:", error.message)
    process.exit(1)
  })
}

module.exports = { runTests }
