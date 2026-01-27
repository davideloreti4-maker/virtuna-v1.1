"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface PersonaTag {
  type: 'location' | 'gender' | 'generation' | 'attitude' | 'seniority' | 'industry'
  label: string
}

interface Persona {
  initials: string
  name: string
  role: string
  company: string
  description: string
  tags: PersonaTag[]
}

// SVG Icon components for persona tags
function LocationIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  )
}

function GenderIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <circle cx="12" cy="8" r="4"/>
      <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/>
    </svg>
  )
}

function GenerationIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 10h8M8 14h5"/>
    </svg>
  )
}

function AttitudeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function SeniorityIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <rect x="2" y="7" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 7V5a4 4 0 00-8 0v2"/>
    </svg>
  )
}

function IndustryIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
    </svg>
  )
}

function getTagIcon(type: PersonaTag['type']) {
  switch (type) {
    case 'location': return <LocationIcon />
    case 'gender': return <GenderIcon />
    case 'generation': return <GenerationIcon />
    case 'attitude': return <AttitudeIcon />
    case 'seniority': return <SeniorityIcon />
    case 'industry': return <IndustryIcon />
    default: return <LocationIcon />
  }
}

interface Node {
  x: number
  y: number
  z: number
  baseX: number
  baseY: number
  baseZ: number
  size: number
  color: string
  isHighlighted: boolean
  persona: Persona
}

// Predefined personas for variety
const PERSONAS: Persona[] = [
  {
    initials: "SC",
    name: "Sarah Chen",
    role: "Product Manager",
    company: "TechFlow Inc.",
    description: "Passionate about building products that make a difference in people's daily lives.",
    tags: [
      { type: "location", label: "San Francisco, USA" },
      { type: "gender", label: "Female" },
      { type: "generation", label: "Millennial" },
      { type: "attitude", label: "Liberal" },
      { type: "seniority", label: "Senior" },
      { type: "industry", label: "Technology" },
    ],
  },
  {
    initials: "MW",
    name: "Marcus Williams",
    role: "Financial Analyst",
    company: "Goldman & Partners",
    description: "Focused on emerging markets and sustainable investment strategies.",
    tags: [
      { type: "location", label: "London, UK" },
      { type: "gender", label: "Male" },
      { type: "generation", label: "Gen X" },
      { type: "attitude", label: "Moderate" },
      { type: "seniority", label: "Manager" },
      { type: "industry", label: "Finance" },
    ],
  },
  {
    initials: "ER",
    name: "Emma Rodriguez",
    role: "Brand Director",
    company: "Luxe Collective",
    description: "Creating memorable brand experiences that resonate with global audiences.",
    tags: [
      { type: "location", label: "Paris, France" },
      { type: "gender", label: "Female" },
      { type: "generation", label: "Millennial" },
      { type: "attitude", label: "Progressive" },
      { type: "seniority", label: "Director" },
      { type: "industry", label: "Fashion" },
    ],
  },
  {
    initials: "JC",
    name: "James Chen",
    role: "Data Scientist",
    company: "AI Dynamics",
    description: "Leveraging machine learning to solve complex business challenges.",
    tags: [
      { type: "location", label: "Berlin, Germany" },
      { type: "gender", label: "Male" },
      { type: "generation", label: "Gen Z" },
      { type: "attitude", label: "Moderate" },
      { type: "seniority", label: "Senior" },
      { type: "industry", label: "Tech" },
    ],
  },
  {
    initials: "LT",
    name: "Lisa Thompson",
    role: "Marketing VP",
    company: "Growth Labs",
    description: "Driving customer acquisition through data-driven marketing strategies.",
    tags: [
      { type: "location", label: "New York, USA" },
      { type: "gender", label: "Female" },
      { type: "generation", label: "Gen X" },
      { type: "attitude", label: "Conservative" },
      { type: "seniority", label: "Executive" },
      { type: "industry", label: "Marketing" },
    ],
  },
  {
    initials: "AK",
    name: "Aiden Kim",
    role: "UX Researcher",
    company: "DesignLab Studio",
    description: "Understanding user behavior to create intuitive digital experiences.",
    tags: [
      { type: "location", label: "Sydney, Australia" },
      { type: "gender", label: "Male" },
      { type: "generation", label: "Millennial" },
      { type: "attitude", label: "Liberal" },
      { type: "seniority", label: "Lead" },
      { type: "industry", label: "Design" },
    ],
  },
]

export function NetworkVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredNode, setHoveredNode] = useState<{
    x: number
    y: number
    persona: Persona
  } | null>(null)
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]!)
  const [cardOpacity, setCardOpacity] = useState(1)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const nodesRef = useRef<Node[]>([])
  const rotationRef = useRef(0)
  const pulsePhaseRef = useRef(0)
  const highlightedIndexRef = useRef(0)

  // Smooth persona transition
  const transitionToPersona = useCallback((newPersona: Persona) => {
    if (isTransitioning) return

    setIsTransitioning(true)

    // Fade out
    const fadeOut = () => {
      let opacity = 1
      const fadeOutInterval = setInterval(() => {
        opacity -= 0.1
        setCardOpacity(Math.max(0, opacity))
        if (opacity <= 0) {
          clearInterval(fadeOutInterval)
          setActivePersona(newPersona)
          // Fade in
          fadeIn()
        }
      }, 30)
    }

    const fadeIn = () => {
      let opacity = 0
      const fadeInInterval = setInterval(() => {
        opacity += 0.1
        setCardOpacity(Math.min(1, opacity))
        if (opacity >= 1) {
          clearInterval(fadeInInterval)
          setIsTransitioning(false)
        }
      }, 30)
    }

    fadeOut()
  }, [isTransitioning])

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
    const centerX = width / 2
    const centerY = height / 2

    // Increased sphere size to match societies.io
    const radiusX = Math.min(width, height) * 0.48
    const radiusY = Math.min(width, height) * 0.45
    const nodeCount = 250 // More nodes for denser appearance

    const names = [
      { first: "Marcus", last: "Williams" },
      { first: "Emma", last: "Rodriguez" },
      { first: "James", last: "Chen" },
      { first: "Sarah", last: "Thompson" },
      { first: "Michael", last: "Brown" },
      { first: "Lisa", last: "Anderson" },
      { first: "David", last: "Kim" },
      { first: "Sophie", last: "Laurent" },
      { first: "Aiden", last: "Park" },
      { first: "Olivia", last: "Martinez" },
    ]
    const roles = [
      "Financial Analyst", "Brand Director", "Marketing Manager", "UX Researcher",
      "Product Designer", "Data Scientist", "Content Creator", "Startup Founder",
    ]
    const companies = [
      "Goldman & Partners", "Luxe Collective", "TechVentures Inc", "DesignLab Studio",
      "Digital Innovations", "Market Research Co", "Growth Dynamics", "Innovation Labs",
    ]
    const locations = ["London, UK", "Paris, France", "New York, USA", "Berlin, Germany", "Sydney, Australia", "Tokyo, Japan"]
    const genders = ["Male", "Female"]
    const generations = ["Gen X", "Millennial", "Gen Z"]
    const attitudes = ["Moderate", "Liberal", "Conservative", "Progressive"]
    const seniorityLevels = ["Manager", "Director", "Senior", "Lead", "Executive"]
    const industries = ["Finance", "Fashion", "Tech", "Marketing", "Healthcare", "Design"]

    if (nodesRef.current.length === 0) {
      nodesRef.current = Array.from({ length: nodeCount }, (_, i) => {
        // More surface nodes for better sphere definition
        const isSurface = i < nodeCount * 0.7
        let x, y, z

        if (isSurface) {
          // Fibonacci sphere for surface nodes
          const phi = Math.acos(1 - 2 * (i + 0.5) / (nodeCount * 0.7))
          const theta = Math.PI * (1 + Math.sqrt(5)) * i
          x = Math.sin(phi) * Math.cos(theta)
          y = Math.sin(phi) * Math.sin(theta)
          z = Math.cos(phi)
        } else {
          // Random interior nodes for filled appearance
          const r = Math.pow(Math.random(), 0.4) * 0.9
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          x = r * Math.sin(phi) * Math.cos(theta)
          y = r * Math.sin(phi) * Math.sin(theta)
          z = r * Math.cos(phi)
        }

        const size = 2.5 + Math.random() * 5
        const brightness = 90 + Math.floor(Math.random() * 90)
        const color = `rgb(${brightness}, ${brightness}, ${brightness})`
        const isHighlighted = false

        const nameData = names[Math.floor(Math.random() * names.length)]!
        const fullName = `${nameData.first} ${nameData.last}`
        const initials = `${nameData.first[0]}${nameData.last[0]}`

        const persona: Persona = {
          initials,
          name: fullName,
          role: roles[Math.floor(Math.random() * roles.length)]!,
          company: companies[Math.floor(Math.random() * companies.length)]!,
          description: "Focused on emerging markets and sustainable investment strategies.",
          tags: [
            { type: "location", label: locations[Math.floor(Math.random() * locations.length)]! },
            { type: "gender", label: genders[Math.floor(Math.random() * genders.length)]! },
            { type: "generation", label: generations[Math.floor(Math.random() * generations.length)]! },
            { type: "attitude", label: attitudes[Math.floor(Math.random() * attitudes.length)]! },
            { type: "seniority", label: seniorityLevels[Math.floor(Math.random() * seniorityLevels.length)]! },
            { type: "industry", label: industries[Math.floor(Math.random() * industries.length)]! },
          ],
        }

        return { x, y, z, baseX: x, baseY: y, baseZ: z, size, color, isHighlighted, persona }
      })
    }

    let animationId: number
    let personaIndex = 0

    // Cycle highlighted node every 4 seconds with smooth transition
    const highlightCycleInterval = setInterval(() => {
      highlightedIndexRef.current = (highlightedIndexRef.current + 1) % Math.min(30, nodeCount)
      personaIndex = (personaIndex + 1) % PERSONAS.length
      transitionToPersona(PERSONAS[personaIndex]!)
    }, 4000)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      rotationRef.current += 0.0015 // Slightly slower rotation
      pulsePhaseRef.current += 0.04 // Smoother pulse

      // Smoother pulse using eased sine wave
      const rawPulse = (Math.sin(pulsePhaseRef.current) + 1) / 2
      const pulseIntensity = rawPulse * rawPulse * (3 - 2 * rawPulse) // Smoothstep easing

      const sortedNodes = [...nodesRef.current]
        .map((node, index) => {
          const cosR = Math.cos(rotationRef.current)
          const sinR = Math.sin(rotationRef.current)
          const rotatedX = node.baseX * cosR - node.baseZ * sinR
          const rotatedZ = node.baseX * sinR + node.baseZ * cosR

          const isCurrentlyHighlighted = index === highlightedIndexRef.current

          return { ...node, rotatedX, rotatedY: node.baseY, rotatedZ, isCurrentlyHighlighted }
        })
        .sort((a, b) => a.rotatedZ - b.rotatedZ)

      // Draw connection lines - more connections for denser look
      ctx.lineWidth = 0.5
      for (let i = 0; i < sortedNodes.length; i++) {
        for (let j = i + 1; j < Math.min(i + 15, sortedNodes.length); j++) {
          const node1 = sortedNodes[i]
          const node2 = sortedNodes[j]
          if (!node1 || !node2) continue

          const x1 = centerX + node1.rotatedX * radiusX
          const y1 = centerY + node1.rotatedY * radiusY
          const x2 = centerX + node2.rotatedX * radiusX
          const y2 = centerY + node2.rotatedY * radiusY

          const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

          if (dist < 100) {
            const opacity = (1 - dist / 100) * 0.5
            ctx.strokeStyle = `rgba(150, 150, 150, ${opacity})`
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      sortedNodes.forEach((node) => {
        const x = centerX + node.rotatedX * radiusX
        const y = centerY + node.rotatedY * radiusY
        const scale = 0.5 + (node.rotatedZ + 1) * 0.3
        const opacity = 0.35 + (node.rotatedZ + 1) * 0.35

        if (node.isCurrentlyHighlighted) {
          // Smooth pulsing orange highlighted node
          const pulseSize = 5 + pulseIntensity * 5
          const pulseGlowSize = 12 + pulseIntensity * 10
          const pulseOpacity = 0.2 + pulseIntensity * 0.3

          // Outermost glow ring
          ctx.beginPath()
          ctx.arc(x, y, (node.size + pulseGlowSize + 8) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(229, 120, 80, ${pulseOpacity * 0.2})`
          ctx.fill()

          // Middle glow ring
          ctx.beginPath()
          ctx.arc(x, y, (node.size + pulseGlowSize) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(229, 120, 80, ${pulseOpacity * 0.5})`
          ctx.fill()

          // Inner glow
          ctx.beginPath()
          ctx.arc(x, y, (node.size + pulseSize + 2) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(229, 120, 80, ${pulseOpacity})`
          ctx.fill()

          // Core orange node
          ctx.beginPath()
          ctx.arc(x, y, (node.size + pulseSize) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(229, 120, 80, ${opacity + 0.4})`
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(x, y, node.size * scale, 0, Math.PI * 2)
          ctx.fillStyle = node.color.replace("rgb", "rgba").replace(")", `, ${opacity})`)
          ctx.fill()
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      let found = false
      for (const node of nodesRef.current) {
        const cosR = Math.cos(rotationRef.current)
        const sinR = Math.sin(rotationRef.current)
        const rotatedX = node.baseX * cosR - node.baseZ * sinR

        const x = centerX + rotatedX * radiusX
        const y = centerY + node.baseY * radiusY
        const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2)

        if (dist < node.size + 10) {
          setHoveredNode({ x: e.clientX, y: e.clientY, persona: node.persona })
          found = true
          break
        }
      }

      if (!found) setHoveredNode(null)
    }

    canvas.addEventListener("mousemove", handleMouseMove)

    return () => {
      cancelAnimationFrame(animationId)
      clearInterval(highlightCycleInterval)
      canvas.removeEventListener("mousemove", handleMouseMove)
    }
  }, [transitionToPersona])

  return (
    <div className="relative w-full h-full">
      {/* Dark radial gradient background behind visualization */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(0,0,0,0.5) 0%, transparent 65%)'
        }}
      />

      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Active Persona Card - positioned below the sphere, centered */}
      <div
        className="absolute z-20 pointer-events-none transition-opacity duration-300 left-1/2 -translate-x-1/2"
        style={{
          bottom: "-20px",
          opacity: cardOpacity,
        }}
      >
        <div className="bg-[rgba(20,20,20,0.95)] border border-[rgb(50,50,50)] rounded-xl p-4 backdrop-blur-md min-w-[280px] shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-white text-sm font-medium">
              {activePersona.initials}
            </div>
            <div>
              <div className="text-white font-medium text-sm">{activePersona.name}</div>
              <div className="text-[rgb(150,150,150)] text-xs">{activePersona.role}</div>
            </div>
          </div>

          <div className="text-white text-xs font-medium mb-1">{activePersona.company}</div>
          <div className="text-[rgb(100,100,100)] text-xs mb-3">{activePersona.description}</div>

          <div className="flex flex-wrap gap-1.5">
            {activePersona.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.06)] text-[rgb(150,150,150)] rounded flex items-center gap-1"
              >
                {getTagIcon(tag.type)}
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hover Persona Card - shows on hover over nodes */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: hoveredNode.x + 15, top: hoveredNode.y - 10 }}
        >
          <div className="bg-[rgba(20,20,20,0.95)] border border-[rgb(50,50,50)] rounded-xl p-4 backdrop-blur-md min-w-[260px] shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-white text-sm font-medium">
                {hoveredNode.persona.initials}
              </div>
              <div>
                <div className="text-white font-medium text-sm">{hoveredNode.persona.name}</div>
                <div className="text-[rgb(150,150,150)] text-xs">{hoveredNode.persona.role}</div>
              </div>
            </div>

            <div className="text-white text-xs font-medium mb-1">{hoveredNode.persona.company}</div>
            <div className="text-[rgb(100,100,100)] text-xs mb-3">{hoveredNode.persona.description}</div>

            <div className="flex flex-wrap gap-1.5">
              {hoveredNode.persona.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.06)] text-[rgb(150,150,150)] rounded flex items-center gap-1"
                >
                  {getTagIcon(tag.type)}
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
