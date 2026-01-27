"use client"

import { useEffect, useRef } from "react"

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="dark flex min-h-screen bg-app-bg">
      {/* Left Side - Form Section */}
      <div className="flex w-full items-center justify-center px-8 py-12 lg:w-[45%] lg:px-16">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>

      {/* Right Side - Animated Gradient Lines */}
      <div className="hidden lg:flex lg:w-[55%] items-center justify-center relative overflow-hidden">
        <GradientLines />
      </div>
    </div>
  )
}

// Animated vertical gradient lines effect matching societies.io
function GradientLines() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      ctx.scale(2, 2)
    }
    updateSize()

    const width = canvas.width / 2
    const height = canvas.height / 2

    const lineCount = 200
    const lines: {
      x: number
      speed: number
      width: number
      offset: number
    }[] = []

    for (let i = 0; i < lineCount; i++) {
      lines.push({
        x: (i / lineCount) * width,
        speed: 0.2 + Math.random() * 0.5,
        width: 1 + Math.random() * 3,
        offset: Math.random() * Math.PI * 2,
      })
    }

    let time = 0
    let animationId: number

    const animate = () => {
      const bgGradient = ctx.createLinearGradient(0, 0, width, height)
      bgGradient.addColorStop(0, "#0A0A0A")
      bgGradient.addColorStop(1, "#0a0a0a")
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      lines.forEach((line) => {
        const normalizedX = line.x / width
        const wave = Math.sin(time * line.speed + line.offset) * 0.5 + 0.5

        const gradient = ctx.createLinearGradient(0, 0, 0, height)

        // Color gradient: blue -> white -> coral -> pink (matching screenshot)
        if (normalizedX < 0.25) {
          const intensity = wave * 0.6
          gradient.addColorStop(0, `rgba(59, 130, 246, ${intensity * 0.3})`)
          gradient.addColorStop(0.3, `rgba(59, 130, 246, ${intensity})`)
          gradient.addColorStop(0.5, `rgba(96, 165, 250, ${intensity * 0.8})`)
          gradient.addColorStop(0.7, `rgba(59, 130, 246, ${intensity})`)
          gradient.addColorStop(1, `rgba(30, 64, 175, ${intensity * 0.3})`)
        } else if (normalizedX < 0.45) {
          const intensity = wave * 0.7
          gradient.addColorStop(0, `rgba(147, 197, 253, ${intensity * 0.3})`)
          gradient.addColorStop(0.3, `rgba(219, 234, 254, ${intensity})`)
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${intensity})`)
          gradient.addColorStop(0.7, `rgba(219, 234, 254, ${intensity})`)
          gradient.addColorStop(1, `rgba(147, 197, 253, ${intensity * 0.3})`)
        } else if (normalizedX < 0.6) {
          const intensity = wave * 0.8
          gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.2})`)
          gradient.addColorStop(0.3, `rgba(255, 255, 255, ${intensity * 0.9})`)
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${intensity})`)
          gradient.addColorStop(0.7, `rgba(255, 255, 255, ${intensity * 0.9})`)
          gradient.addColorStop(1, `rgba(255, 255, 255, ${intensity * 0.2})`)
        } else if (normalizedX < 0.75) {
          const intensity = wave * 0.7
          gradient.addColorStop(0, `rgba(249, 115, 22, ${intensity * 0.2})`)
          gradient.addColorStop(0.3, `rgba(251, 146, 60, ${intensity})`)
          gradient.addColorStop(0.5, `rgba(249, 115, 22, ${intensity})`)
          gradient.addColorStop(0.7, `rgba(251, 146, 60, ${intensity})`)
          gradient.addColorStop(1, `rgba(249, 115, 22, ${intensity * 0.2})`)
        } else {
          const intensity = wave * 0.6
          gradient.addColorStop(0, `rgba(236, 72, 153, ${intensity * 0.2})`)
          gradient.addColorStop(0.3, `rgba(244, 114, 182, ${intensity})`)
          gradient.addColorStop(0.5, `rgba(251, 113, 133, ${intensity * 0.8})`)
          gradient.addColorStop(0.7, `rgba(244, 114, 182, ${intensity})`)
          gradient.addColorStop(1, `rgba(236, 72, 153, ${intensity * 0.2})`)
        }

        ctx.fillStyle = gradient
        ctx.fillRect(line.x, 0, line.width, height)
      })

      time += 0.02
      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      updateSize()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}
