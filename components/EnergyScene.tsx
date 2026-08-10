'use client'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Float, Line, Sparkles } from '@react-three/drei'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'

type DragState = {
  active: boolean
  pointerId: number
  x: number
  y: number
  time: number
  lastInteraction: number
}

function Core({ detail = false, compact = false }: { detail?: boolean; compact?: boolean }) {
  const group = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const orientation = useRef({ x: .04, y: -.12 })
  const velocity = useRef({ x: 0, y: 0 })
  const drag = useRef<DragState>({ active: false, pointerId: -1, x: 0, y: 0, time: 0, lastInteraction: -Infinity })

  const startDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    drag.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      lastInteraction: performance.now(),
    }
    velocity.current.x = 0
    velocity.current.y = 0
  }

  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current.active || drag.current.pointerId !== event.pointerId) return
    event.stopPropagation()
    const elapsed = Math.max((event.timeStamp - drag.current.time) / 1000, 1 / 120)
    const deltaX = event.clientX - drag.current.x
    const deltaY = event.clientY - drag.current.y
    orientation.current.y += deltaX * .008
    orientation.current.x = Math.max(-.55, Math.min(.55, orientation.current.x + deltaY * .005))
    velocity.current.y = Math.max(-3, Math.min(3, deltaX * .008 / elapsed))
    velocity.current.x = Math.max(-1.5, Math.min(1.5, deltaY * .005 / elapsed))
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    drag.current.time = event.timeStamp
    drag.current.lastInteraction = performance.now()
  }

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (drag.current.pointerId !== event.pointerId) return
    event.stopPropagation()
    const target = event.target as Element
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
    drag.current.active = false
    drag.current.pointerId = -1
    drag.current.lastInteraction = performance.now()
  }

  useFrame(({ clock }, delta) => {
    if (!group.current || !core.current) return
    const safeDelta = Math.min(delta, .05)
    const idleTime = (performance.now() - drag.current.lastInteraction) / 1000
    const autoRotate = drag.current.active ? 0 : Math.max(0, Math.min(1, (idleTime - 1.1) / 1.4)) * .16

    if (!drag.current.active) {
      orientation.current.x += velocity.current.x * safeDelta
      orientation.current.y += (velocity.current.y + autoRotate) * safeDelta
      orientation.current.x = Math.max(-.55, Math.min(.55, orientation.current.x))
      const friction = Math.exp(-3.8 * safeDelta)
      velocity.current.x *= friction
      velocity.current.y *= friction
    }

    const follow = 1 - Math.exp(-18 * safeDelta)
    group.current.rotation.x += (orientation.current.x - group.current.rotation.x) * follow
    group.current.rotation.y += (orientation.current.y - group.current.rotation.y) * follow
    group.current.position.y = Math.sin(clock.getElapsedTime() * .65) * .1
    core.current.rotation.z += safeDelta * .12
  })

  const rings = [[0, 0, 0], [.62, .35, .8], [-.55, -.35, .6]]
  return <group
    ref={group}
    rotation={[.04, -.12, 0]}
    onPointerDown={startDrag}
    onPointerMove={moveDrag}
    onPointerUp={endDrag}
    onPointerCancel={endDrag}
  >
    <Float speed={1} rotationIntensity={.12} floatIntensity={.24}>
      <mesh ref={core} scale={detail ? 1.05 : .86}>
        <icosahedronGeometry args={[1, compact ? 2 : 4]} />
        <meshStandardMaterial color="#ffc94d" emissive="#a66f03" emissiveIntensity={1.9} metalness={.76} roughness={.22} />
      </mesh>
      <mesh scale={detail ? 1.46 : 1.25} rotation={[.4, .8, 0]}>
        <octahedronGeometry args={[1, compact ? 1 : 2]} />
        <meshBasicMaterial color="#fbdc7a" wireframe transparent opacity={.16} />
      </mesh>
      {rings.map((position, index) => <group key={index} position={position as [number, number, number]} rotation={[index * .5, index * .8, 0]}>
        <mesh><boxGeometry args={[.46, .18, .04]} /><meshStandardMaterial color="#dca82e" emissive="#6b4500" emissiveIntensity={.5} metalness={.9} roughness={.2} /></mesh>
        <mesh position={[0, 0, .026]}><planeGeometry args={[.37, .11]} /><meshBasicMaterial color="#102638" /></mesh>
      </group>)}
      <Line points={[[-1.4, 0, 0], [0, 0, 0], [1.4, 0, 0]]} color="#f7c54b" lineWidth={.5} transparent opacity={.4} />
      <mesh>
        <sphereGeometry args={[1.65, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </Float>
  </group>
}

function SceneContent({ detail = false }: { detail?: boolean }) {
  const compact = useThree(state => state.size.width < 540)
  return <>
    <ambientLight intensity={.45} />
    <pointLight position={[2, 3, 3]} intensity={14} color="#ffd36a" distance={7} />
    <pointLight position={[-3, -1, 2]} intensity={7} color="#3e9ef7" distance={6} />
    <Core detail={detail} compact={compact} />
    <Sparkles count={compact ? 38 : detail ? 140 : 72} scale={5} size={compact ? 1.15 : 1.45} speed={.18} color="#ffd56f" opacity={.58} />
  </>
}

export default function EnergyScene({ detail = false }: { detail?: boolean }) {
  return <>
    <Canvas
      frameloop="always"
      dpr={[1, 1.25]}
      camera={{ position: [0, 0, 4.4], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      aria-label="Sol interativo: arraste para girar"
    >
      <SceneContent detail={detail} />
    </Canvas>
    <p className="scene-interaction-hint" aria-hidden="true"><span>↔</span> Arraste para girar</p>
  </>
}
