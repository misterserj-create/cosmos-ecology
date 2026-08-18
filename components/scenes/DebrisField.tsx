"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import * as THREE from "three"

const DEBRIS_COUNT_FULL = 450
const DEBRIS_COUNT_LITE = 120

/** Прогресс "спуска" 0..1, читается каждый кадр из ref — без React-перерендеров на скролл. */
export type DescentProgress = { current: number }

function Clouds({ segments }: { segments: number }) {
  const cloudsMap = useLoader(THREE.TextureLoader, "/textures/earth-clouds.jpg")
  const cloudsRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.05
  })

  return (
    <mesh ref={cloudsRef} scale={1.012}>
      <sphereGeometry args={[1, segments, segments]} />
      <meshStandardMaterial map={cloudsMap} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

function EarthCore({ lite }: { lite: boolean }) {
  const dayMap = useLoader(THREE.TextureLoader, "/textures/earth-daymap.jpg")
  dayMap.colorSpace = THREE.SRGBColorSpace

  const earthRef = useRef<THREE.Mesh>(null)
  const segments = lite ? 16 : 22

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.035
  })

  return (
    <group rotation={[0, 0, 0.41]}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, segments, segments]} />
        <meshStandardMaterial map={dayMap} roughness={0.75} metalness={0.05} />
      </mesh>
      {/* Облака — отдельный компонент: если он не смонтирован (lite), его
          useLoader не срабатывает вообще, и текстура не запрашивается. */}
      {!lite && <Clouds segments={segments} />}
    </group>
  )
}

const MOON_ORBIT_RADIUS = 3.3

function Moon() {
  const moonMap = useLoader(THREE.TextureLoader, "/textures/moon.jpg")
  moonMap.colorSpace = THREE.SRGBColorSpace

  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const angle = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    // Орбита не завязана на progress спуска — Луна чистая, это только
    // техногенный мусор толпится ближе к Земле, а не сама планетная система.
    angle.current += delta * 0.045
    if (groupRef.current) {
      groupRef.current.position.set(
        Math.cos(angle.current) * MOON_ORBIT_RADIUS,
        0.35,
        Math.sin(angle.current) * MOON_ORBIT_RADIUS
      )
    }
    // Приливный захват: Луна всегда обращена одной стороной к Земле.
    if (meshRef.current) meshRef.current.rotation.y = angle.current
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.27, 18, 18]} />
        <meshStandardMaterial map={moonMap} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  )
}

function Atmosphere({ progress, lite }: { progress: DescentProgress; lite: boolean }) {
  const ref = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uCold: { value: new THREE.Color("#8fa7bf") },
      uWarm: { value: new THREE.Color("#c26a3a") },
      uMix: { value: 0 },
    }),
    []
  )

  useFrame(() => {
    if (ref.current) ref.current.uniforms.uMix.value = progress.current
  })

  return (
    <mesh scale={1.06}>
      <sphereGeometry args={[1, lite ? 16 : 26, lite ? 16 : 26]} />
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          uniform vec3 uCold;
          uniform vec3 uWarm;
          uniform float uMix;
          void main() {
            float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.2);
            vec3 color = mix(uCold, uWarm, uMix);
            gl_FragColor = vec4(color, rim * 0.65);
          }
        `}
      />
    </mesh>
  )
}

function Debris({ progress, lite }: { progress: DescentProgress; lite: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = lite ? DEBRIS_COUNT_LITE : DEBRIS_COUNT_FULL

  const seeds = useMemo(() => {
    return Array.from({ length: count }, () => {
      const radius = 1.5 + Math.random() * 1.1
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      return {
        radius,
        theta,
        phi,
        spin: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.05,
        scale: 0.012 + Math.random() * 0.03,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  useFrame((_, delta) => {
    if (!ref.current) return
    const p = progress.current
    // спуск: рой стягивается к камере и "падает" по мере прокрутки
    const contraction = 1 - p * 0.35

    seeds.forEach((s, i) => {
      s.theta += s.speed * delta * (0.4 + p * 1.2)
      const r = s.radius * contraction
      const x = r * Math.sin(s.phi) * Math.cos(s.theta)
      const y = r * Math.cos(s.phi) - p * 1.4
      const z = r * Math.sin(s.phi) * Math.sin(s.theta)
      dummy.position.set(x, y, z)
      dummy.rotation.set(s.spin + p * 3, s.spin * 0.7, 0)
      dummy.scale.setScalar(s.scale)
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#9aa4ad" roughness={0.6} metalness={0.4} />
    </instancedMesh>
  )
}

const SATELLITE_COUNT = 4

function Satellites({ progress }: { progress: DescentProgress }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])

  const seeds = useMemo(
    () =>
      Array.from({ length: SATELLITE_COUNT }, () => ({
        radius: 1.7 + Math.random() * 0.7,
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1),
        driftSpeed: 0.01 + Math.random() * 0.02,
        tumble: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        tumbleSpeed: 0.15 + Math.random() * 0.25,
      })),
    []
  )

  useFrame((_, delta) => {
    const p = progress.current
    seeds.forEach((s, i) => {
      const ref = groupRefs.current[i]
      if (!ref) return
      s.theta += s.driftSpeed * delta * (0.5 + p)
      const r = s.radius * (1 - p * 0.35)
      ref.position.set(
        r * Math.sin(s.phi) * Math.cos(s.theta),
        r * Math.cos(s.phi) - p * 1.4,
        r * Math.sin(s.phi) * Math.sin(s.theta)
      )
      ref.rotateOnAxis(s.tumble, s.tumbleSpeed * delta)
    })
  })

  return (
    <>
      {seeds.map((_, i) => (
        <group key={i} ref={el => { groupRefs.current[i] = el }} scale={0.045}>
          <mesh>
            <boxGeometry args={[1, 0.6, 0.6]} />
            <meshStandardMaterial color="#b7bcc2" roughness={0.4} metalness={0.75} />
          </mesh>
          {[1.15, -1.15].map(x => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[1.4, 0.05, 0.9]} />
              <meshStandardMaterial color="#2a4d6e" roughness={0.3} metalness={0.2} emissive="#0d2740" emissiveIntensity={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

const STREAK_COUNT = 4

function Streaks() {
  const refs = useRef<(THREE.Mesh | null)[]>([])

  const seeds = useMemo(
    () =>
      Array.from({ length: STREAK_COUNT }, () => ({
        z: -3 + Math.random() * 6,
        y: (Math.random() - 0.5) * 4,
        cycle: 5 + Math.random() * 4,
        offset: Math.random() * 10,
        length: 0.15 + Math.random() * 0.25,
      })),
    []
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    seeds.forEach((s, i) => {
      const ref = refs.current[i]
      if (!ref) return
      const localT = ((t + s.offset) % s.cycle) / s.cycle
      ref.position.set(-5 + localT * 10, s.y, s.z)
      const mat = ref.material as THREE.MeshBasicMaterial
      mat.opacity = Math.sin(localT * Math.PI) * 0.8
    })
  })

  return (
    <>
      {seeds.map((s, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el }} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.003, 0.003, s.length, 6]} />
          <meshBasicMaterial color="#dfe8f0" transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

function Rig({ progress }: { progress: DescentProgress }) {
  useFrame(({ camera }) => {
    const p = progress.current
    // орбита → вход в атмосферу: камера снижается и приближается
    camera.position.set(0.4 * p, 2.6 - p * 2.1, 4.4 - p * 1.6)
    camera.lookAt(0, -p * 1.2, 0)
  })
  return null
}

export default function DebrisField({
  progress,
  lite = false,
  onContextLost,
}: {
  progress: DescentProgress
  /** Урезанная версия для тач-устройств: меньше частиц, без Луны/спутников/
   *  пролётов/облаков — стабильность на слабых мобильных GPU важнее полноты. */
  lite?: boolean
  onContextLost?: () => void
}) {
  return (
    <Canvas
      style={{ width: "100%", height: "100%", display: "block" }}
      dpr={lite ? 1 : [1, 1.25]}
      camera={{ fov: 45, position: [0, 2.6, 4.4] }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      onCreated={state => {
        // Три.js сам делает preventDefault и умеет восстанавливать контекст,
        // но если браузер решит не восстанавливать — пересоздаём канвас целиком
        // через смену key на уровне CosmicDescent, а не остаёмся с чёрным экраном.
        state.gl.domElement.addEventListener(
          "webglcontextlost",
          () => onContextLost?.(),
          { once: true }
        )
      }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 2, 2]} intensity={1.4} color="#fff6e8" />
      <EarthCore lite={lite} />
      {!lite && <Moon />}
      <Atmosphere progress={progress} lite={lite} />
      <Debris progress={progress} lite={lite} />
      {!lite && <Satellites progress={progress} />}
      {!lite && <Streaks />}
      <Rig progress={progress} />
    </Canvas>
  )
}
