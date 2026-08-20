"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import * as THREE from "three"

const DEBRIS_COUNT_FULL = 850
const DEBRIS_COUNT_LITE = 180

// Разворот сферы Земли: у THREE.SphereGeometry с u=0 экватор смотрит на -X,
// а точка, обращённая к камере (+Z), соответствует u≈0.25 текстуры — это
// Америка на стандартной equirectangular-карте. Нужна долгота ~50°в.д.
// (Каспий/Казахстан, между Африкой и Россией) — пересчитано под поворот
// вокруг Y: θ = -(90° + долгота).
const EARTH_INITIAL_YAW = -2.9

/** Прогресс "спуска" 0..1, читается каждый кадр из ref — без React-перерендеров на скролл. */
export type DescentProgress = { current: number }

function Clouds({ segments }: { segments: number }) {
  const cloudsMap = useLoader(THREE.TextureLoader, "/textures/earth-clouds.jpg")
  const cloudsRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.05
  })

  return (
    <mesh ref={cloudsRef} rotation={[0, EARTH_INITIAL_YAW, 0]} scale={1.012}>
      <sphereGeometry args={[1, segments, segments]} />
      <meshStandardMaterial map={cloudsMap} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

function EarthCore({ spin }: { spin: { current: number } }) {
  const dayMap = useLoader(THREE.TextureLoader, "/textures/earth-daymap.jpg")
  dayMap.colorSpace = THREE.SRGBColorSpace

  const earthRef = useRef<THREE.Mesh>(null)
  const segments = 22

  useFrame((_, delta) => {
    // Общий угол вращения — читает и рой обломков, чтобы держаться вместе
    // с планетой одним блоком, а не расходиться с ней по фазе.
    spin.current += delta * 0.035
    if (earthRef.current) earthRef.current.rotation.y = EARTH_INITIAL_YAW + spin.current
  })

  return (
    <>
      {/* Начальный разворот: долгота ~35°в.д. (между Африкой и Россией)
          смотрит на камеру, а не Америка, которая там была по умолчанию.
          Наклон оси задаётся снаружи, общей группой вместе с роем обломков. */}
      <mesh ref={earthRef} rotation={[0, EARTH_INITIAL_YAW, 0]}>
        <sphereGeometry args={[1, segments, segments]} />
        <meshStandardMaterial map={dayMap} roughness={0.75} metalness={0.05} />
      </mesh>
      <Clouds segments={segments} />
    </>
  )
}

// Лёгкая версия Земли для мобильных: без текстур вообще (сплошной цвет) —
// декодирование JPEG-текстуры в GPU-память на слабых Android-GPU было
// вероятной причиной потери WebGL-контекста на середине сессии.
function EarthLite({ spin }: { spin: { current: number } }) {
  const earthRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    spin.current += delta * 0.035
    if (earthRef.current) earthRef.current.rotation.y = EARTH_INITIAL_YAW + spin.current
  })

  return (
    <mesh ref={earthRef} rotation={[0, EARTH_INITIAL_YAW, 0]}>
      <sphereGeometry args={[1, 14, 14]} />
      <meshStandardMaterial color="#3d5f7a" roughness={0.85} metalness={0} />
    </mesh>
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

function Debris({
  progress,
  lite,
  spin,
}: {
  progress: DescentProgress
  lite: boolean
  spin: { current: number }
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = lite ? DEBRIS_COUNT_LITE : DEBRIS_COUNT_FULL

  const seeds = useMemo(() => {
    return Array.from({ length: count }, () => {
      // Реальный пояс мусора — низкая орбита (200-2000 км), плотнее всего
      // около 800-1000 км (ESA/NASA) — в радиусах Земли это 1.03-1.34, пик
      // около 1.13-1.16. Среднее двух случайных чисел смещает разброс к
      // центру диапазона вместо равномерного — так же, как в реальности.
      // ~18% рассеяны дальше (выше НОО, вплоть до МЕО) — реже, но не ноль,
      // как на реальных снимках плотность просто убывает, а не обрывается.
      // Ближний край почти вплотную к атмосфере (1.02) — без тёмного зазора
      // между свечением (scale 1.06) и роем, из-за которого обломки читались
      // как отдельная оболочка, подвешенная в пустоте отдельно от планеты.
      const isFar = Math.random() < 0.14
      const radius = isFar
        ? 1.35 + Math.random() * 0.7
        : 1.02 + ((Math.random() + Math.random()) / 2) * 0.22
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      return {
        radius,
        theta, // фиксированная фаза внутри роя — общее вращение задаёт spin
        drift: 0,
        phi,
        tumble: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.05,
        // Смещение к мелким: большинство обломков — мелкая крошка, крупные
        // куски редки (степенное распределение вместо равномерного).
        scale: 0.004 + Math.pow(Math.random(), 2.2) * 0.02,
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
      // Основа вращения — общий угол spin (тот же, что крутит Землю), рой
      // держится с планетой одним блоком. Собственный дрейф — небольшая
      // добавка поверх, чтобы обломки не выглядели жёстко приклеенными.
      s.drift += s.speed * delta * (0.4 + p * 1.2) * 0.25
      const theta = s.theta + spin.current + s.drift
      const r = s.radius * contraction
      const x = r * Math.sin(s.phi) * Math.cos(theta)
      const y = r * Math.cos(s.phi) - p * 1.4
      const z = r * Math.sin(s.phi) * Math.sin(theta)
      dummy.position.set(x, y, z)
      dummy.rotation.set(s.tumble + p * 3, s.tumble * 0.7, 0)
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

const SATELLITE_COUNT = 10

function Satellites({ progress, spin }: { progress: DescentProgress; spin: { current: number } }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])

  const seeds = useMemo(
    () =>
      Array.from({ length: SATELLITE_COUNT }, () => ({
        // Ближе к рою обломков, без разрыва до дальнего рассеянного слоя.
        radius: 1.15 + Math.random() * 0.5,
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1),
        driftSpeed: 0.006 + Math.random() * 0.012,
        driftPhase: 0,
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
      // Своя добавка небольшая — база вращения общая с Землёй и роем (spin),
      // иначе спутники читаются как отдельные тела, летящие сами по себе.
      s.driftPhase += s.driftSpeed * delta * (0.5 + p)
      const theta = s.theta + spin.current + s.driftPhase
      const r = s.radius * (1 - p * 0.35)
      ref.position.set(
        r * Math.sin(s.phi) * Math.cos(theta),
        r * Math.cos(s.phi) - p * 1.4,
        r * Math.sin(s.phi) * Math.sin(theta)
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
  const spin = useRef({ current: 0 }).current
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
      {/* Общий наклон оси (0.41 рад) — на Земле, атмосфере, обломках и
          спутниках одновременно, чтобы рой держался с планетой по одной
          оси вращения, а не крутился отдельно вокруг вертикали. */}
      <group rotation={[0, 0, 0.41]}>
        {lite ? <EarthLite spin={spin} /> : <EarthCore spin={spin} />}
        <Atmosphere progress={progress} lite={lite} />
        <Debris progress={progress} lite={lite} spin={spin} />
        {!lite && <Satellites progress={progress} spin={spin} />}
      </group>
      {!lite && <Moon />}
      {!lite && <Streaks />}
      <Rig progress={progress} />
    </Canvas>
  )
}
