#!/usr/bin/env node

const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

function checkNodeVersion() {
  const version = process.version
  const majorVersion = Number.parseInt(version.slice(1).split(".")[0])

  if (majorVersion < 14) {
    console.log("❌ Node.js version 14 or higher is required")
    console.log(`   Current version: ${version}`)
    process.exit(1)
  }

  console.log(`✅ Node.js version: ${version}`)
}

function installDependencies() {
  return new Promise((resolve, reject) => {
    console.log("📦 Installing Node.js dependencies...")

    const npm = spawn("npm", ["install"], {
      stdio: "inherit",
      shell: true,
    })

    npm.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Dependencies installed successfully!")
        resolve()
      } else {
        console.log("❌ Failed to install dependencies")
        reject(new Error(`npm install failed with code ${code}`))
      }
    })

    npm.on("error", (error) => {
      console.log("❌ Error running npm install:", error.message)
      reject(error)
    })
  })
}

function startServer() {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting Coordination Server...")
    console.log("🌐 Server will be available at: http://localhost:3001")
    console.log("📋 Available API endpoints:")
    console.log("   - POST /api/detect-sign - Process video frame")
    console.log("   - GET  /api/get-text - Get detected text")
    console.log("   - GET  /api/history - Get detection history")
    console.log("   - POST /api/clear-cache - Clear detection cache")
    console.log("   - POST /api/speak - Text-to-speech configuration")
    console.log("   - GET  /api/gestures - Available gestures")
    console.log("   - GET  /api/stats - Detection statistics")
    console.log("   - GET  /health - Health check")
    console.log("")
    console.log("💡 Make sure the Python API is running on port 5000")
    console.log("   Run: python scripts/sign_language_detector.py")
    console.log("")
    console.log("=".repeat(60))

    const server = spawn("node", ["coordination-server.js"], {
      stdio: "inherit",
      shell: true,
    })

    server.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Server stopped gracefully")
        resolve()
      } else {
        console.log(`❌ Server stopped with code ${code}`)
        reject(new Error(`Server failed with code ${code}`))
      }
    })

    server.on("error", (error) => {
      console.log("❌ Error starting server:", error.message)
      reject(error)
    })

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down Coordination Server...")
      server.kill("SIGINT")
    })

    process.on("SIGTERM", () => {
      console.log("\n🛑 Shutting down Coordination Server...")
      server.kill("SIGTERM")
    })
  })
}

async function main() {
  console.log("🤖 Sign Language Detection - Coordination Server")
  console.log("=".repeat(60))

  try {
    // Check Node.js version
    checkNodeVersion()

    // Check if package.json exists
    if (!fs.existsSync("package.json")) {
      console.log("❌ package.json not found. Please run this from the scripts directory.")
      process.exit(1)
    }

    // Install dependencies
    await installDependencies()

    console.log("")
    console.log("=".repeat(60))

    // Start server
    await startServer()
  } catch (error) {
    console.log("❌ Failed to start coordination server:", error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
