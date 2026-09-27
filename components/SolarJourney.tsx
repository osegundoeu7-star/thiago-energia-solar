'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
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

/* ============================================================
   TEXTURAS PROCEDURAIS (NÍVEL 2 — realista estilizado)
   Geradas 1x no cliente via CanvasTexture: telha cerâmica,
   reboco, grama, tijolo, madeira e módulo fotovoltaico.
   Zero assets externos: build e Lighthouse não sofrem.
============================================================ */
type TexSet = {
  roof: CanvasTexture
  wall: CanvasTexture
  grass: CanvasTexture
  brick: CanvasTexture
  wood: CanvasTexture
  panel: CanvasTexture
  panelGlow: CanvasTexture
}

let _tex: TexSet | null = null

function makeTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  draw(c, w, h)
  const t = new CanvasTexture(cv)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

function textures(): TexSet {
  if (_tex) return _tex

  /* --- telha de cerâmica: fileiras sobrepostas com sombra na junção --- */
  const roof = makeTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5e2a1c'
    c.fillRect(0, 0, w, h)
    const tw = 64, th = 42
    for (let row = 0; row < h / th + 1; row++) {
      const off = row % 2 ? tw / 2 : 0
      for (let col = -1; col < w / tw + 1; col++) {
        const x = col * tw + off
        const y = row * th
        const g = c.createLinearGradient(0, y, 0, y + th)
        g.addColorStop(0, '#a85437')
        g.addColorStop(0.55, '#93452c')
        g.addColorStop(1, '#6e3524')
        c.fillStyle = g
        c.beginPath()
        c.moveTo(x + 2, y)
        c.lineTo(x + tw - 2, y)
        c.quadraticCurveTo(x + tw - 2, y + th, x + tw / 2, y + th + 6)
        c.quadraticCurveTo(x + 2, y + th, x + 2, y)
        c.closePath()
        c.fill()
        c.strokeStyle = 'rgba(40,16,8,0.55)'
        c.lineWidth = 2
        c.stroke()
        /* brilho vertical da telha */
        const s = c.createLinearGradient(x, 0, x + tw, 0)
        s.addColorStop(0, 'rgba(255,255,255,0)')
        s.addColorStop(0.5, 'rgba(255,235,200,0.10)')
        s.addColorStop(1, 'rgba(0,0,0,0.12)')
        c.fillStyle = s
        c.fill()
      }
    }
  })
  roof.repeat.set(4, 1.5)

  /* --- reboco: base clara com granulado sutil --- */
  const wall = makeTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e4ded0'
    c.fillRect(0, 0, w, h)
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const v = Math.random()
      c.fillStyle = v > 0.5 ? 'rgba(120,110,92,0.10)' : 'rgba(255,255,255,0.10)'
      c.fillRect(x, y, 1.4, 1.4)
    }
    /* manchas suaves de desgaste */
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 14 + Math.random() * 30
      const g = c.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(150,140,118,0.07)')
      g.addColorStop(1, 'rgba(150,140,118,0)')
      c.fillStyle = g
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
    }
  })
  wall.repeat.set(3, 1.8)

  /* --- grama: fios curtos em dois tons sobre base escura --- */
  const grass = makeTex(256, 256, (c, w, h) => {
    c.fillStyle = '#2c471f'
    c.fillRect(0, 0, w, h)
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const len = 3 + Math.random() * 5
      c.strokeStyle = Math.random() > 0.5 ? 'rgba(84,130,54,0.55)' : 'rgba(30,54,20,0.55)'
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + (Math.random() - 0.5) * 2, y - len)
      c.stroke()
    }
  })
  grass.repeat.set(10, 10)

  /* --- tijolo aparente com junta de argamassa --- */
  const brick = makeTex(256, 256, (c, w, h) => {
    c.fillStyle = '#b3a48f'
    c.fillRect(0, 0, w, h)
    const bw = 64, bh = 32
    for (let row = 0; row < h / bh; row++) {
      const off = row % 2 ? bw / 2 : 0
      for (let col = -1; col < w / bw + 1; col++) {
        const x = col * bw + off + 3
        const y = row * bh + 3
        const jitter = 0.9 + Math.random() * 0.2
        c.fillStyle = `rgb(${Math.round(122 * jitter)},${Math.round(69 * jitter)},${Math.round(48 * jitter)})`
        c.fillRect(x, y, bw - 6, bh - 6)
        c.fillStyle = 'rgba(0,0,0,0.12)'
        c.fillRect(x, y + bh - 9, bw - 6, 3)
        c.fillStyle = 'rgba(255,255,255,0.08)'
        c.fillRect(x, y, bw - 6, 3)
      }
    }
  })
  brick.repeat.set(1, 2)

  /* --- madeira: pranchas verticais com veios --- */
  const wood = makeTex(128, 256, (c, w, h) => {
    c.fillStyle = '#5f4130'
    c.fillRect(0, 0, w, h)
    for (let p = 0; p < 4; p++) {
      const x = p * (w / 4)
      c.fillStyle = p % 2 ? '#674835' : '#5a3d2c'
      c.fillRect(x + 1, 0, w / 4 - 2, h)
      c.strokeStyle = 'rgba(30,18,10,0.7)'
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x, h)
      c.stroke()
    }
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * w
      c.strokeStyle = `rgba(${Math.random() > 0.5 ? '36,22,12,0.5' : '140,104,74,0.35'})`
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(x, 0)
      c.bezierCurveTo(x + 4, h * 0.33, x - 4, h * 0.66, x + 2, h)
      c.stroke()
    }
  })

  /* --- módulo fotovoltaico: 6x4 células + 3 busbars --- */
  const cellW = 42, cellH = 50, cols = 6, rows = 4
  const panel = makeTex(512, 400, (c, w, h) => {
    c.fillStyle = '#0a1830'
    c.fillRect(0, 0, w, h)
    const ox = (w - cols * cellW) / 2
    const oy = (h - rows * cellH) / 2
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = ox + col * cellW
        const y = oy + r * cellH
        const g = c.createLinearGradient(x, y, x + cellW, y + cellH)
        g.addColorStop(0, '#123a6e')
        g.addColorStop(0.5, '#0d2c52')
        g.addColorStop(1, '#1c5aa8')
        c.fillStyle = g
        c.fillRect(x + 2, y + 2, cellW - 4, cellH - 4)
        c.strokeStyle = 'rgba(159,178,200,0.5)'
        c.lineWidth = 1
        c.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4)
      }
    }
    /* busbars prateadas verticais */
    c.fillStyle = 'rgba(207,217,230,0.85)'
    for (let b = 1; b <= 3; b++) {
      const x = ox + (w / (cols * cellW)) * 0 + (b * cols * cellW) / 4
      c.fillRect(x - 1.5, oy, 3, rows * cellH)
    }
  })

  /* --- versão emissiva (acende quando o sistema monta) --- */
  const panelGlow = makeTex(512, 400, (c, w, h) => {
    c.fillStyle = '#02060d'
    c.fillRect(0, 0, w, h)
    const ox = (w - cols * cellW) / 2
    const oy = (h - rows * cellH) / 2
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = ox + col * cellW
        const y = oy + r * cellH
        const g = c.createLinearGradient(x, y, x, y + cellH)
        g.addColorStop(0, '#0e2f4e')
        g.addColorStop(1, '#1d5fae')
        c.fillStyle = g
        c.fillRect(x + 3, y + 3, cellW - 6, cellH - 6)
      }
    }
    c.fillStyle = 'rgba(191,227,255,0.9)'
    for (let b = 1; b <= 3; b++) {
      const x = ox + (b * cols * cellW) / 4
      c.fillRect(x - 1.5, oy, 3, rows * cellH)
    }
  })

  _tex = { roof, wall, grass, brick, wood, panel, panelGlow }
  return _tex
}

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

/* ========================= PAINEL SOLAR PROFISSIONAL (voo grama -> telhado) =========================
   Moldura de alumínio + módulo com textura de células (map + emissiveMap)
   + vidro reflexivo. 1 draw call por módulo: leve no celular.
   No hero os módulos ficam deitados na GRAMA (visíveis desde o 1º segundo);
   no capítulo processo cada um voa em arco e encaixa na sua água do telhado. */
function PanelArray({ index, processRef, tex, roofPos, roofTilt, groundPos, groundTilt, groundYaw, arc = 1.15 }: {
  index: number
  processRef: React.RefObject<number[]>
  tex: TexSet
  roofPos: [number, number, number]
  roofTilt: number
  groundPos: [number, number, number]
  groundTilt: number
  groundYaw: number
  arc?: number
}) {
  const group = useRef<Group>(null)
  const modMat = useRef<MeshStandardMaterial>(null)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const x = clamp(processRef.current[index] ?? 0, 0, 1)
    const e = 1 - Math.pow(1 - x, 3) /* easeOutCubic */
    g.position.set(
      groundPos[0] + (roofPos[0] - groundPos[0]) * e,
      groundPos[1] + (roofPos[1] - groundPos[1]) * e + Math.sin(e * Math.PI) * arc,
      groundPos[2] + (roofPos[2] - groundPos[2]) * e,
    )
    g.rotation.x = groundTilt + (roofTilt - groundTilt) * e
    g.rotation.y = groundYaw * (1 - e)
    /* células acendem ao pousar no telhado (x²) e com interação */
    if (modMat.current) {
      modMat.current.emissiveIntensity = x * x * (0.4 + clamp(journey.simulator, 0, 1) * 0.6 + journey.boost * 0.8)
    }
  })
  return <group ref={group} position={groundPos} rotation={[groundTilt, groundYaw, 0]}>
      {/* moldura de alumínio */}
      <mesh castShadow>
        <boxGeometry args={[1.78, 0.07, 1.42]} />
        <meshStandardMaterial color="#b7bec5" metalness={0.85} roughness={0.32} />
      </mesh>
      {/* módulo: face de cima (material-2 = +Y) leva map + emissiveMap */}
      <mesh castShadow position={[0, 0.018, 0]}>
        <boxGeometry args={[1.66, 0.035, 1.3]} />
        <meshStandardMaterial attach="material-0" color="#0a1420" roughness={0.55} metalness={0.35} />
        <meshStandardMaterial attach="material-1" color="#0a1420" roughness={0.55} metalness={0.35} />
        <meshStandardMaterial attach="material-2" ref={modMat} map={tex.panel} emissiveMap={tex.panelGlow} emissive="#cfeaff" emissiveIntensity={0.3} roughness={0.38} metalness={0.45} />
        <meshStandardMaterial attach="material-3" color="#0a1420" roughness={0.55} metalness={0.35} />
        <meshStandardMaterial attach="material-4" color="#0a1420" roughness={0.55} metalness={0.35} />
        <meshStandardMaterial attach="material-5" color="#0a1420" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* vidro frontal reflexivo */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[1.6, 0.012, 1.24]} />
        <meshStandardMaterial color="#9fc8e8" transparent opacity={0.13} metalness={0.9} roughness={0.04} />
      </mesh>
  </group>
}

/* ========================= MUNDO ========================= */
function World({ reduced }: { reduced: boolean }) {
  const rig = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const sun = useRef<Group>(null)
  const sunCore = useRef<Mesh>(null)
  const sunLight = useRef<DirectionalLight>(null)
  const winMats = useRef<Array<MeshStandardMaterial | null>>([])
  const meterMat = useRef<MeshStandardMaterial>(null)
  const processRef = useRef<number[]>([0, 0, 0])
  const tmp = useMemo(() => new Vector3(), [])
  const camera = useThree(s => s.camera)
  const compact = useThree(s => s.size.width < 640)
  const tex = textures()

  /* oitão (triângulo da lateral) sob o beiral */
  const gableShape = useMemo(() => {
    const s = new Shape()
    s.moveTo(-1.15, 0)
    s.lineTo(1.15, 0)
    s.lineTo(0, 0.71)
    s.closePath()
    return s
  }, [])

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
    if (winMats.current.length) {
      const w = 0.14 + 1.5 * Math.max(sim, lead) + journey.boost * 0.5 + (assembled ? 0.25 : 0)
      winMats.current.forEach(m => { if (m) m.emissiveIntensity = w })
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
      {/* chão de grama (material-1 = face de cima do cilindro) */}
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <cylinderGeometry args={[6.4, 6.4, 0.06, 40]} />
        <meshStandardMaterial attach="material-0" color="#0c1418" roughness={1} />
        <meshStandardMaterial attach="material-1" map={tex.grass} roughness={1} />
        <meshStandardMaterial attach="material-2" color="#0c1418" roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.55, 4.62, 64]} />
        <meshBasicMaterial color="#f7c54b" transparent opacity={0.16} />
      </mesh>

      {/* fundação (esconde a base da parede na grama) */}
      <mesh castShadow receiveShadow position={[0, 0.11, 0]}>
        <boxGeometry args={[3.28, 0.24, 2.38]} />
        <meshStandardMaterial color="#b9b2a4" roughness={0.95} />
      </mesh>

      {/* casa ampliada com reboco */}
      <mesh castShadow receiveShadow position={[0, 1.19, 0]}>
        <boxGeometry args={[3.2, 2.02, 2.3]} />
        <meshStandardMaterial map={tex.wall} roughness={0.9} />
      </mesh>

      {/* oitões laterais */}
      {[1.6, -1.6].map(x => <mesh key={x} position={[x, 2.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <shapeGeometry args={[gableShape]} />
        <meshStandardMaterial color="#ded7c6" roughness={0.95} side={DoubleSide} />
      </mesh>)}

      {/* telhado duas águas CORRIGIDO: água da frente inclina para +z */}
      <mesh castShadow receiveShadow position={[0, 2.515, 0.66]} rotation={[0.58, 0, 0]}>
        <boxGeometry args={[3.72, 0.11, 1.66]} />
        <meshStandardMaterial attach="material-0" color="#6e3524" roughness={0.85} />
        <meshStandardMaterial attach="material-1" color="#6e3524" roughness={0.85} />
        <meshStandardMaterial attach="material-2" map={tex.roof} roughness={0.85} />
        <meshStandardMaterial attach="material-3" color="#4a2317" roughness={0.9} />
        <meshStandardMaterial attach="material-4" color="#6e3524" roughness={0.85} />
        <meshStandardMaterial attach="material-5" color="#6e3524" roughness={0.85} />
      </mesh>
      {/* água dos fundos */}
      <mesh castShadow receiveShadow position={[0, 2.515, -0.66]} rotation={[-0.58, 0, 0]}>
        <boxGeometry args={[3.72, 0.11, 1.66]} />
        <meshStandardMaterial attach="material-0" color="#66311f" roughness={0.85} />
        <meshStandardMaterial attach="material-1" color="#66311f" roughness={0.85} />
        <meshStandardMaterial attach="material-2" map={tex.roof} roughness={0.85} />
        <meshStandardMaterial attach="material-3" color="#452015" roughness={0.9} />
        <meshStandardMaterial attach="material-4" color="#66311f" roughness={0.85} />
        <meshStandardMaterial attach="material-5" color="#66311f" roughness={0.85} />
      </mesh>
      {/* cumeeira */}
      <mesh castShadow position={[0, 2.97, 0]}>
        <boxGeometry args={[3.78, 0.13, 0.22]} />
        <meshStandardMaterial color="#5e2a1c" roughness={0.9} />
      </mesh>

      {/* chaminé de tijolos com capa */}
      <group position={[1.15, 0, -0.5]}>
        <mesh castShadow receiveShadow position={[0, 2.62, 0]}>
          <boxGeometry args={[0.34, 1.45, 0.34]} />
          <meshStandardMaterial map={tex.brick} roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0, 3.38, 0]}>
          <boxGeometry args={[0.44, 0.09, 0.44]} />
          <meshStandardMaterial color="#4a2317" roughness={0.9} />
        </mesh>
        <mesh position={[0, 3.44, 0]}>
          <boxGeometry args={[0.26, 0.06, 0.26]} />
          <meshStandardMaterial color="#1a100b" roughness={1} />
        </mesh>
      </group>

      {/* porta de madeira com batente e maçaneta */}
      <group position={[-0.78, 0, 1.16]}>
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.78, 1.44, 0.07]} />
          <meshStandardMaterial color="#efe8d8" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.68, 0.03]}>
          <boxGeometry args={[0.62, 1.32, 0.06]} />
          <meshStandardMaterial map={tex.wood} roughness={0.75} />
        </mesh>
        <mesh position={[0.24, 0.68, 0.075]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial color="#d9a441" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>

      {/* janelas da frente com cruzeta e peitoril (acendem de noite) */}
      {[0.32, 1.02].map((x, wi) => <group key={x} position={[x, 1.32, 1.16]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.62, 0.78, 0.06]} />
          <meshStandardMaterial color="#efe8d8" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[0.5, 0.66, 0.05]} />
          <meshStandardMaterial ref={r => { winMats.current[wi] = r }} color="#2b3340" emissive="#ffb547" emissiveIntensity={0.14} roughness={0.25} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <boxGeometry args={[0.52, 0.035, 0.012]} />
          <meshStandardMaterial color="#efe8d8" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <boxGeometry args={[0.035, 0.68, 0.012]} />
          <meshStandardMaterial color="#efe8d8" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, -0.44, 0.05]}>
          <boxGeometry args={[0.7, 0.06, 0.14]} />
          <meshStandardMaterial color="#d9d0bd" roughness={0.85} />
        </mesh>
      </group>)}

      {/* janela lateral */}
      <group position={[1.615, 1.32, 0.25]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.62, 0.78, 0.06]} />
          <meshStandardMaterial color="#efe8d8" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[0.5, 0.66, 0.05]} />
          <meshStandardMaterial ref={r => { winMats.current[2] = r }} color="#2b3340" emissive="#ffb547" emissiveIntensity={0.14} roughness={0.25} metalness={0.35} />
        </mesh>
        <mesh castShadow position={[0, -0.44, 0.05]}>
          <boxGeometry args={[0.7, 0.06, 0.14]} />
          <meshStandardMaterial color="#d9d0bd" roughness={0.85} />
        </mesh>
      </group>

      {/* árvore */}
      <group position={[-2.55, 0, -0.9]}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.09, 0.14, 1.1, 10]} />
          <meshStandardMaterial color="#4a3423" roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.72, 14, 12]} />
          <meshStandardMaterial color="#3f6b34" roughness={1} />
        </mesh>
        <mesh castShadow position={[0.38, 1.15, 0.22]}>
          <sphereGeometry args={[0.45, 12, 10]} />
          <meshStandardMaterial color="#487a3b" roughness={1} />
        </mesh>
        <mesh castShadow position={[-0.35, 1.25, -0.25]}>
          <sphereGeometry args={[0.4, 12, 10]} />
          <meshStandardMaterial color="#365f2d" roughness={1} />
        </mesh>
      </group>

      {/* medidor de energia */}
      <group position={[2.05, 0, 0.75]}>
        <mesh castShadow position={[0, 0.42, 0]}>
          <boxGeometry args={[0.34, 0.84, 0.26]} />
          <meshStandardMaterial color="#20282e" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.62, 0.135]}>
          <boxGeometry args={[0.2, 0.2, 0.02]} />
          <meshStandardMaterial ref={meterMat} color="#8ff0b4" emissive="#2fd67d" emissiveIntensity={1.4} />
        </mesh>
      </group>

      {/* painéis: deitados na grama desde o hero, voam para o telhado no processo */}
      <PanelArray index={0} processRef={processRef} tex={tex}
        roofPos={[-0.86, 2.77, 0.6]} roofTilt={0.58}
        groundPos={[-2.05, 0.16, 1.9]} groundTilt={0.14} groundYaw={0.35} />
      <PanelArray index={1} processRef={processRef} tex={tex}
        roofPos={[0.86, 2.77, 0.6]} roofTilt={0.58}
        groundPos={[0.15, 0.16, 2.15]} groundTilt={0.14} groundYaw={-0.28} />
      <PanelArray index={2} processRef={processRef} tex={tex}
        roofPos={[0.9, 2.77, -0.6]} roofTilt={-0.58}
        groundPos={[1.65, 0.16, 1.8]} groundTilt={0.14} groundYaw={0.55} arc={1.75} />

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
      {/* luz do sol com sombras reais */}
      <directionalLight
        ref={sunLight}
        position={[-3, 2.5, -2]}
        intensity={1.6}
        color="#ffd36a"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5.5}
        shadow-camera-right={5.5}
        shadow-camera-top={5.5}
        shadow-camera-bottom={-5.5}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />

      {/* fluxos de energia realinhados à nova cena */}
      <FlowLine points={[[-3, 1.4, -2.4], [-1.2, 3.3, -1.2], [0, 3.06, 0]]} count={12}
        flow={() => 0.3 + journey.boost * 0.55 + clamp(journey.simulator, 0, 1) * 0.25} sunRef={sun} />
      <FlowLine points={[[-3, 1.4, -2.4], [-1.6, 3.1, -0.5], [-0.86, 2.85, 0.55]]} flow={flowPanels} sunRef={sun} />
      <FlowLine points={[[-3, 1.4, -2.4], [-0.8, 3.3, -1.4], [0.86, 2.85, 0.55]]} count={12}
        flow={() => flowPanels() * 0.9} sunRef={sun} />
      <FlowLine points={[[0.86, 2.5, 1.0], [1.8, 1.5, 0.85], [2.2, 0.95, 0.9]]} count={10}
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
      shadows={!reduced}
    >
      <fog attach="fog" args={['#090d10', 12, 20]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={['#7fb0dd', '#241b12']} intensity={0.55} />
      <pointLight position={[-4, 2, 3]} intensity={3} color="#3e9ef7" distance={9} />
      <World reduced={reduced} />
    </Canvas>
    {hint && <p className="scene-interaction-hint" aria-hidden="true"><span>↔</span> Arraste para girar · toque no sol</p>}
  </div>
}
