'use client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Line, Sparkles } from '@react-three/drei'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'

function Core({ detail = false }: { detail?: boolean }) {
  const group = useRef<Group>(null); const core = useRef<Mesh>(null)
  useFrame(({ clock, pointer }) => { const t = clock.getElapsedTime(); if (!group.current || !core.current) return; group.current.rotation.x += (pointer.y * .22 - group.current.rotation.x) * .025; group.current.rotation.y += (pointer.x * .35 + t * .09 - group.current.rotation.y) * .025; group.current.position.y = Math.sin(t * .65) * .1; core.current.rotation.z = t * .12 })
  const rings = [[0, 0, 0], [.62, .35, .8], [-.55, -.35, .6]]
  return <group ref={group}><Float speed={1} rotationIntensity={.12} floatIntensity={.24}>
    <mesh ref={core} scale={detail ? 1.05 : .86}><icosahedronGeometry args={[1, 4]} /><meshStandardMaterial color="#ffc94d" emissive="#a66f03" emissiveIntensity={1.9} metalness={.76} roughness={.22} /></mesh>
    <mesh scale={detail ? 1.46 : 1.25} rotation={[.4,.8,0]}><octahedronGeometry args={[1, 2]} /><meshBasicMaterial color="#fbdc7a" wireframe transparent opacity={.16} /></mesh>
    {rings.map((p, i) => <group key={i} position={p as [number,number,number]} rotation={[i*.5,i*.8,0]}><mesh><boxGeometry args={[.46,.18,.04]} /><meshStandardMaterial color="#dca82e" emissive="#6b4500" emissiveIntensity={.5} metalness={.9} roughness={.2} /></mesh><mesh position={[0,0,.026]}><planeGeometry args={[.37,.11]} /><meshBasicMaterial color="#102638" /></mesh></group>)}
    <Line points={[[-1.4,0,0],[0,0,0],[1.4,0,0]]} color="#f7c54b" lineWidth={.5} transparent opacity={.4} />
  </Float></group>
}
export default function EnergyScene({ detail = false }: { detail?: boolean }) { return <Canvas dpr={[1, 1.5]} camera={{ position:[0,0,4.4], fov:42 }} gl={{ alpha:true, antialias:true }}>
  <ambientLight intensity={.45}/><pointLight position={[2,3,3]} intensity={14} color="#ffd36a" distance={7}/><pointLight position={[-3,-1,2]} intensity={7} color="#3e9ef7" distance={6}/><Core detail={detail}/><Sparkles count={detail ? 140 : 72} scale={5} size={1.45} speed={.18} color="#ffd56f" opacity={.58}/>
</Canvas> }
