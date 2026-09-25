'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  CatmullRomCurve3,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Vector3,
  type BufferAttribute,
  type Camera,
} from 'three'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================
   ESTADO COMPARTILHADO (mutado por scroll/toque, lido no useFrame)
   hero: 1 = topo da página · problem/process/simulator/lead: 0..1
   bill: valor da conta do simulador · boost: toque no sol
============================================================ */
export const journey = {
  page: 0, hero: 1, problem: 0, process: 0, simulator: 0, lead: 0,
  bill: 500, boost: 0, rotY: 0, rotX: 0.05,
}

/* toque (tap) em coordenadas NDC, preenchido pelo listener de janela */
const tapNDC: { current: null | { x: number; y: number; ok: boolean } } = { current: null }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const sm = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t) }
const easeOutBack = (x: number) => { const c1 = 1.70158; return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }

/* ========================= FLUXO DE PARTÍCULAS ========================= */
type FlowProps = {
  points: [number, number, number][]
  count?: number
  size?: number
  speed?: number
  flow: () => number
  sunRef?: React.RefObject<Group | null>
}

function FlowLine({ points, count = 14, size = 0.055, speed = 0.16, flow, sunRef }: FlowProps) {
  const curveRef = useRef<CatmullRomCurve3 | null>(null)
  if (curveRef.current == null) curveRef.current = new CatmullRomCurve3(points.map(p => new Vector3(...p)))
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const offsets = useMemo(() => Array.from({ length: count }, (_, i) => i / count), [count])
  const ref = useRef<Points>(null)
  const mat = useRef<PointsMaterial>(null)

  useFrame(({ clock }) => {
    const pts = ref.current
    if (!pts || !mat.current || !curveRef.current) return
    const curve = curveRef.current
    const f = clamp(flow(), 0, 1.5)
    if (sunRef?.current) {
      curve.points[0].copy(sunRef.current.position)
      curve.updateArcLengths()
    }
    const attr = pts.geometry.attributes.position as BufferAttribute
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = curve.getPointAt((offsets[i] + t * speed * (0.45 + f)) % 1)
      attr.setXYZ(i, p.x, p.y, p.z)
    }
    attr.needsUpdate = true
    mat.current.opacity = 0.9 * Math.min(1, f)
    pts.visible = f > 0.02
  })

  return <points ref={ref} frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
    </bufferGeometry>
    <pointsMaterial ref={mat} color="#ffd76e" size={size} transparent opacity={0} sizeAttenuation depthWrite={false} blending={AdditiveBlending} />
  </points>
}

/* ========================= NUVENS (capítulo problema) ========================= */
function Clouds() {
  const group = useRef<Group>(null)
  const mats = useRef<Array<MeshStandardMaterial | null>>([])
  const puffs = useMemo(() => [
    { y: 3.6, z: -2.4, s: 1.5, v: 0.5, o: 0 },
    { y: 4.1, z: -3.1, s: 1.9, v: 0.34, o: 4.2 },
    { y: 3.4, z: -2.0, s: 1.2, v: 0.62, o: 8.4 },
  ], [])
  const parts = useMemo(() => puffs.map(pf => [
    { p: [0, 0, 0], s: [pf.s, pf.s * 0.57, pf.s * 0.67] },
    { p: [pf.s * 0.8, -pf.s * 0.15, 0], s: [pf.s * 0.62, pf.s * 0.36, pf.s * 0.47] },
    { p: [-pf.s * 0.75, -pf.s * 0.18, 0.1], s: [pf.s * 0.5, pf.s * 0.29, pf.s * 0.4] },
  ]), [puffs])
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.getElapsedTime()
    g.children.forEach((c, i) => { c.position.x = ((t * puffs[i].v + puffs[i].o + 6) % 12) - 6 })
    const base = journey.problem > 0 ? clamp(journey.problem * 2.2, 0, 1) * 0.5 : 0.1
    const op = base * (1 - clamp(journey.lead * 1.6, 0, 1))
    mats.current.forEach(m => { if (m) m.opacity = op })
    g.visible = op > 0.02
  })
  return <group ref={group}>
    {puffs.map((pf, i) => <group key={i} position={[0, pf.y, pf.z]}>
      {parts[i].map((pt, k) => <mesh key={k} position={pt.p as [number, number, number]} scale={pt.s as [number, number, number]}>
        <sphereGeometry args={[1, 10, 8]} />
    <meshStandardMaterial ref={r => { mats.current[i * 3 + k] = r }} color="#eef5fa" roughness={1} transparent opacity={0} flatShading depthWrite={false} fog={false} />
      </mesh>)}
    </group>)}
  </group>
}

/* ========================= PAINEL SOLAR (montagem animada) ========================= */
function PanelArray({ index, processRef }: { index: number; processRef: React.RefObject<number[]> }) {
  const group = useRef<Group>(null)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const x = clamp(processRef.current[index] ?? 0, 0, 1)
    const s = x <= 0.001 ? 0.0001 : easeOutBack(x)
    g.visible = x > 0.001
    g.scale.setScalar(Math.max(0.0001, s))
    g.position.y = (1 - x) * 1.1
  })
  const cells: [number, number][] = [[-0.62, 0.34], [0, 0.34], [0.62, 0.34], [-0.62, -0.36], [0, -0.36], [0.62, -0.36]]
  return <group ref={group}>
    <mesh rotation={[-0.62, 0, 0]}>
      <boxGeometry args={[2.05, 0.07, 1.25]} />
      <meshStandardMaterial color="#0e2f4e" metalness={0.65} roughness={0.28} emissive="#0a4f8a" emissiveIntensity={0.16} />
    </mesh>
    {cells.map(([cx, cz], i) => <mesh key={i} position={[cx, 0.055 + cz * 0.02, cz]} rotation={[-0.62, 0, 0]}>
      <boxGeometry args={[0.56, 0.015, 0.5]} />
      <meshStandardMaterial color="#12406b" metalness={0.8} roughness={0.18} emissive="#1c6fb8" emissiveIntensity={0.22} />
    </mesh>)}
  </group>
}

/* ========================= MUNDO ========================= */
function World({ reduced }: { reduced: boolean }) {
  const rig = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const sun = useRef<Group>(null)
  const sunCore = useRef<Mesh>(null)
  const sunLight = useRef<DirectionalLight>(null)
  const windowsMat = useRef<MeshStandardMaterial>(null)
  const meterMat = useRef<MeshStandardMaterial>(null)
  const processRef = useRef<number[]>([0, 0, 0])
  const tmp = useMemo(() => new Vector3(), [])
  const camera = useThree(s => s.camera)
  const compact = useThree(s => s.size.width < 640)

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = clock.getElapsedTime()

    /* --- montagem dos painéis (capítulo processo) --- */
    const assemble = clamp((journey.process - 0.12) / 0.5, 0, 1)
    processRef.current = [sm(assemble * 3), sm(assemble * 3 - 1), sm(assemble * 3 - 2)]
    const assembled = (processRef.current[0] + processRef.current[1] + processRef.current[2]) / 3 >= 0.99
    const sim = clamp(journey.simulator * 1.4, 0, 1)
    const lead = clamp(journey.lead, 0, 1)

    /* --- sol percorre o céu conforme o scroll --- */
    let sunT: number
    if (lead > 0) sunT = 0.52 + 0.42 * lead
    else if (sim > 0) sunT = 0.52
    else if (journey.process > 0) sunT = 0.48
    else if (journey.problem > 0) sunT = 0.42
    else sunT = 0.12 + 0.3 * (1 - journey.hero)
    if (reduced) sunT = 0.4
    const sx = (sunT - 0.5) * 7.6
    const sy = 0.55 + Math.pow(Math.sin(Math.PI * clamp(sunT, 0.02, 0.98)), 1.15) * 3.1
    if (sun.current) {
      const k = 1 - Math.exp(-3.2 * dt)
      sun.current.position.x += (sx - sun.current.position.x) * k
      sun.current.position.y += (sy - sun.current.position.y) * k
      if (!reduced) sun.current.position.y += Math.sin(t * 0.6) * 0.003
    }
    if (sunCore.current) sunCore.current.rotation.y += dt * 0.1
    if (sunLight.current && sun.current) {
      sunLight.current.position.copy(sun.current.position)
      sunLight.current.intensity = 0.85 + Math.sin(Math.PI * clamp(sunT, 0, 1)) * 1.15
    }

    /* --- composição: hero à direita · depois centro --- */
    if (rig.current) {
      const onHero = journey.hero > 0.25
      const tx = compact ? 0.85 : (onHero ? 1.45 : 0)
      const ts = compact ? 0.72 : (onHero ? 0.92 : 1.04)
      const ty = compact ? 0.25 : (onHero ? 0.15 : 0)
      const k = 1 - Math.exp(-2.6 * dt)
      rig.current.position.x += (tx - rig.current.position.x) * k
      rig.current.position.y += (ty - rig.current.position.y) * k
      rig.current.scale.setScalar(rig.current.scale.x + (ts - rig.current.scale.x) * k)
    }

    /* --- rotação: arraste + deriva suave --- */
    if (spin.current) {
      const idle = reduced ? 0 : Math.sin(t * 0.12) * 0.055
      const k = 1 - Math.exp(-10 * dt)
      spin.current.rotation.y += ((journey.rotY + idle) - spin.current.rotation.y) * k
      spin.current.rotation.x += (journey.rotX - spin.current.rotation.x) * k
    }

    /* --- brilho da casa e decaimento do toque --- */
    journey.boost *= Math.exp(-0.9 * dt)
    const billF = clamp((journey.bill - 100) / 4900, 0, 1)
    if (windowsMat.current) {
      windowsMat.current.emissiveIntensity = 0.14 + 1.5 * Math.max(sim, lead) + journey.boost * 0.5 + (assembled ? 0.25 : 0)
    }
    if (meterMat.current) {
      meterMat.current.emissiveIntensity = 1.1 + billF * 1.6 + journey.boost * 0.9 + sim * 0.5
    }

    /* --- toque no sol (hit-test em NDC) --- */
    if (tapNDC.current?.ok && sun.current) {
      sun.current.getWorldPosition(tmp)
      tmp.project(camera as Camera)
      if (Math.hypot(tmp.x - tapNDC.current.x, tmp.y - tapNDC.current.y) < 0.17) journey.boost = 1
      tapNDC.current.ok = false
    }
  })

  const flowPanels = () => {
    const p = processRef.current
    const on = (p[0] + p[1] + p[2]) / 3 >= 0.99 ? 1 : 0
    const billF = clamp((journey.bill - 100) / 4900, 0, 1)
    return on * (0.42 + clamp(journey.simulator * 1.4, 0, 1) * 0.85 + billF * 0.3 + journey.boost)
  }

  return <group ref={rig} position={[1.45, 0.15, 0]}>
    <group ref={spin} rotation={[0.05, 0, 0]}>
      {/* chão */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[6.4, 6.4, 0.06, 40]} />
        <meshStandardMaterial color="#0c1418" roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.55, 4.62, 64]} />
        <meshBasicMaterial color="#f7c54b" transparent opacity={0.16} />
      </mesh>

      {/* casa */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[2.6, 1.5, 1.9]} />
        <meshStandardMaterial color="#e8e4da" roughness={0.85} />
      </mesh>
      {/* telhado duas águas */}
      <mesh position={[0, 1.68, 0.62]} rotation={[0.62, 0, 0]}>
        <boxGeometry args={[2.85, 0.09, 1.35]} />
        <meshStandardMaterial color="#8a4a33" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.68, -0.62]} rotation={[-0.62, 0, 0]}>
        <boxGeometry args={[2.85, 0.09, 1.35]} />
        <meshStandardMaterial color="#7a4030" roughness={0.8} />
      </mesh>
      {/* chaminé */}
      <mesh position={[0.85, 2.12, -0.25]}>
        <boxGeometry args={[0.28, 0.5, 0.28]} />
        <meshStandardMaterial color="#5e3326" roughness={0.9} />
      </mesh>
      {/* porta e janelas */}
      <mesh position={[-0.55, 0.52, 0.955]}>
        <boxGeometry args={[0.5, 0.95, 0.05]} />
        <meshStandardMaterial color="#3a2c22" roughness={0.7} />
      </mesh>
      {[0.35, 0.95].map(x => <mesh key={x} position={[x, 0.85, 0.955]}>
        <boxGeometry args={[0.44, 0.44, 0.04]} />
        <meshStandardMaterial ref={x === 0.95 ? windowsMat : undefined} color="#ffd98c" emissive="#ffb547" emissiveIntensity={0.14} roughness={0.4} />
      </mesh>)}

      {/* medidor de energia */}
      <group position={[2.05, 0, 0.75]}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.34, 0.84, 0.26]} />
          <meshStandardMaterial color="#20282e" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.62, 0.135]}>
          <boxGeometry args={[0.2, 0.2, 0.02]} />
          <meshStandardMaterial ref={meterMat} color="#8ff0b4" emissive="#2fd67d" emissiveIntensity={1.4} />
        </mesh>
      </group>

      {/* painéis (montagem no capítulo processo) */}
      <group position={[0, 2.02, 0.28]}><PanelArray index={0} processRef={processRef} /></group>
      <group position={[0, 2.02, -0.34]}><PanelArray index={1} processRef={processRef} /></group>
      <group position={[0.9, 2.32, -0.25]} scale={0.5}><PanelArray index={2} processRef={processRef} /></group>

      {/* sol viajante */}
      <group ref={sun} position={[-3.2, 1.2, -2.4]}>
        <mesh ref={sunCore}>
          <sphereGeometry args={[0.62, 24, 20]} />
          <meshBasicMaterial color="#ffd76e" fog={false} />
        </mesh>
        <mesh><sphereGeometry args={[1.05, 16, 14]} /><meshBasicMaterial color="#ffc94d" transparent opacity={0.22} depthWrite={false} fog={false} /></mesh>
        <mesh><sphereGeometry args={[1.7, 16, 14]} /><meshBasicMaterial color="#ffb63d" transparent opacity={0.08} depthWrite={false} fog={false} /></mesh>
        <Sparkles count={22} scale={3.2} size={2.4} speed={0.3} color="#ffd56f" opacity={0.6} />
      </group>
      <directionalLight ref={sunLight} position={[-3, 2.5, -2]} intensity={1.6} color="#ffd36a" />

      {/* fluxos de energia */}
      <FlowLine points={[[-3, 1.4, -2.4], [-1, 2.6, -1], [0, 2.42, 0]]} count={12}
        flow={() => 0.3 + journey.boost * 0.55 + clamp(journey.simulator, 0, 1) * 0.25} sunRef={sun} />
      <FlowLine points={[[-3, 1.4, -2.4], [-0.8, 2.9, -0.4], [0, 2.34, 0.3]]} flow={flowPanels} sunRef={sun} />
      <FlowLine points={[[-3, 1.4, -2.4], [-0.6, 2.9, -0.8], [0, 2.34, -0.36]]} count={12}
        flow={() => flowPanels() * 0.9} sunRef={sun} />
      <FlowLine points={[[0, 2.2, 0.3], [1.4, 1.4, 0.7], [2.05, 0.75, 0.75]]} count={10}
        flow={() => (flowPanels() > 0 ? 0.5 + clamp((journey.bill - 100) / 4900, 0, 1) * 0.9 + clamp(journey.simulator * 1.4, 0, 1) * 0.9 + journey.boost * 0.8 : 0)} />

      {/* nuvens (capítulo problema) */}
      <Clouds />
    </group>
  </group>
}

/* ========================= COMPONENTE PRINCIPAL ========================= */
export default function SolarJourney() {
  const [hint, setHint] = useState(true)
  const [running, setRunning] = useState(true)
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  /* capítulos por scroll */
  useEffect(() => {
    const ctx = gsap.context(() => {
      const hero = document.querySelector('.hero')
      if (hero) ScrollTrigger.create({
        trigger: hero, start: 'top top', end: 'bottom top',
        onUpdate: s => { journey.hero = 1 - s.progress },
        onToggle: s => setHint(s.isActive),
      })
      const sec = (sel: string, key: 'problem' | 'process' | 'simulator' | 'lead') => {
        const el = document.querySelector(sel)
        if (el) ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: s => { journey[key] = s.progress } })
      }
      sec('.problem', 'problem')
      sec('.process', 'process')
      sec('.simulator', 'simulator')
      sec('.lead-section', 'lead')
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => { journey.page = s.progress } })
    })
    return () => ctx.revert()
  }, [])

  /* arraste para girar + toque no sol (janela inteira, só durante o hero) */
  useEffect(() => {
    let px = 0, py = 0, id = -1, moved = 0, t0 = 0
    const inHero = () => scrollY < innerHeight * 0.75
    const isUI = (e: PointerEvent) => !!(e.target as Element | null)?.closest?.('a,button,input,select,textarea,label,.nav')
    const down = (e: PointerEvent) => { if (isUI(e)) return; id = e.pointerId; px = e.clientX; py = e.clientY; moved = 0; t0 = performance.now() }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      const dx = e.clientX - px, dy = e.clientY - py
      px = e.clientX; py = e.clientY; moved += Math.abs(dx) + Math.abs(dy)
      if (!inHero() || Math.abs(dx) < Math.abs(dy)) return
      journey.rotY = clamp(journey.rotY + dx * 0.006, -1.25, 1.25)
      journey.rotX = clamp(journey.rotX + dy * 0.002, -0.22, 0.3)
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = -1
      if (moved < 9 && performance.now() - t0 < 350 && inHero() && !isUI(e)) {
        tapNDC.current = { x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1, ok: true }
      }
    }
    addEventListener('pointerdown', down, { passive: true })
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerup', up, { passive: true })
    return () => {
      removeEventListener('pointerdown', down)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
    }
  }, [])

  /* pausa quando a aba está oculta */
  useEffect(() => {
    const on = () => setRunning(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  return <div className="solar-journey" aria-hidden="true">
    <Canvas
      frameloop={running ? 'always' : 'never'}
      dpr={[1, 1.25]}
      camera={{ position: [0, 1.75, 7.6], fov: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
    >
      <fog attach="fog" args={['#090d10', 12, 20]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[-4, 2, 3]} intensity={5} color="#3e9ef7" distance={9} />
      <World reduced={reduced} />
    </Canvas>
    {hint && <p className="scene-interaction-hint" aria-hidden="true"><span>↔</span> Arraste para girar · toque no sol</p>}
  </div>
}