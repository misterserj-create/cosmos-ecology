"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"

const DEBRIS_COUNT_FULL = 2000
const DEBRIS_COUNT_LITE = 220
// Плоские обломки панелей и изоляции — вторая форма роя.
const DEBRIS_PLATES_FULL = 1100
const DEBRIS_PLATES_LITE = 110

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

// Города проекта. Метки живут внутри меша Земли, поэтому уезжают вместе с
// её вращением и прячутся за горизонт, как настоящая точка на поверхности.
const CITIES = [
  { name: "Москва", lat: 55.75, lon: 37.62 },
  { name: "Санкт-Петербург", lat: 59.94, lon: 30.31 },
]

/** Широта/долгота → точка на сфере в системе координат THREE.SphereGeometry. */
function latLonToVec(lat: number, lon: number, r: number) {
  const phi = ((lon + 180) * Math.PI) / 180
  const theta = ((90 - lat) * Math.PI) / 180
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta)
  )
}

function CityMarker({ name, lat, lon }: { name: string; lat: number; lon: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const worldPos = useMemo(() => new THREE.Vector3(), [])

  const { position, quaternion } = useMemo(() => {
    const dir = latLonToVec(lat, lon, 1)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    return { position: dir.clone().multiplyScalar(1.001), quaternion: q }
  }, [lat, lon])

  useFrame(({ camera }) => {
    const g = groupRef.current
    if (!g) return
    g.getWorldPosition(worldPos)
    // Центр планеты в мировых координатах — начало координат, поэтому нормаль
    // поверхности в точке метки это сама её позиция.
    const facing = worldPos.clone().normalize().dot(camera.position.clone().sub(worldPos).normalize())
    // Гасим метку, пока она уходит за лимб, а не выключаем скачком.
    const visible = Math.max(0, Math.min(1, (facing - 0.05) / 0.3))
    g.visible = visible > 0.01
    if (labelRef.current) labelRef.current.style.opacity = String(visible)
  })

  return (
    <group ref={groupRef} position={position} quaternion={quaternion}>
      <mesh position={[0, 0.004, 0]}>
        <sphereGeometry args={[0.0045, 10, 10]} />
        <meshBasicMaterial color="#f0c860" toneMapped={false} />
      </mesh>
      {/* Тонкий штырёк вверх — метку видно даже поверх светлой поверхности. */}
      <mesh position={[0, 0.021, 0]}>
        <cylinderGeometry args={[0.0007, 0.0007, 0.034, 5]} />
        <meshBasicMaterial color="#f0c860" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <Html position={[0, 0.05, 0]} center distanceFactor={1.5} zIndexRange={[2, 0]}>
        <div
          ref={labelRef}
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#f0c860",
            whiteSpace: "nowrap",
            textShadow: "0 1px 6px rgba(0,0,0,0.9)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {name}
        </div>
      </Html>
    </group>
  )
}

function CityMarkers() {
  return (
    <>
      {CITIES.map(c => (
        <CityMarker key={c.name} {...c} />
      ))}
    </>
  )
}

function EarthCore({ spin }: { spin: { current: number } }) {
  const dayMap = useLoader(THREE.TextureLoader, "/textures/earth-daymap.jpg")
  dayMap.colorSpace = THREE.SRGBColorSpace

  const earthRef = useRef<THREE.Mesh>(null)
  // Камера теперь у самой поверхности, и при 22 сегментах край планеты
  // становился видимо гранёным — многоугольник вместо дуги горизонта.
  const segments = 56

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
        <CityMarkers />
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
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#3d5f7a" roughness={0.85} metalness={0} />
    </mesh>
  )
}

// Дальше прежнего: камера подошла к Земле вплотную, и с радиуса 3.3 Луна
// висела в кадре размером с добрый астероид.
const MOON_ORBIT_RADIUS = 6.5

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
        <sphereGeometry args={[0.32, 22, 22]} />
        <meshStandardMaterial map={moonMap} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  )
}

// Направление на Солнце — то же, что у directionalLight сцены. В мировых
// координатах, чтобы наклон оси группы не уводил засветку в сторону.
const SUN_DIR = new THREE.Vector3(-3, 1.2, 1.6).normalize()

const ATMOSPHERE_VERT = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// Реальная атмосфера на снимках с орбиты — не ровное гало вокруг всего диска,
// а тонкая яркая дуга на дневной стороне лимба, которая гаснет к терминатору.
// Поэтому яркость умножается на освещённость Солнцем, а не только на френель.
const ATMOSPHERE_FRAG = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  uniform vec3 uCold;
  uniform vec3 uWarm;
  uniform float uMix;
  uniform vec3 uSun;
  uniform float uPower;
  uniform float uStrength;
  void main() {
    vec3 n = normalize(vWorldNormal);
    float rim = pow(clamp(1.0 - abs(dot(n, normalize(vViewDir))), 0.0, 1.0), uPower);
    // Мягкий терминатор: чуть заходит на ночную сторону, как настоящие сумерки.
    float sun = clamp(dot(n, uSun) * 1.35 + 0.18, 0.0, 1.0);
    sun = pow(sun, 1.5);
    vec3 color = mix(uCold, uWarm, uMix);
    gl_FragColor = vec4(color, rim * sun * uStrength * (1.0 + uMix * 0.15));
  }
`

function AtmosphereShell({
  progress,
  scale,
  segments,
  power,
  strength,
  cold,
}: {
  progress: DescentProgress
  scale: number
  segments: number
  power: number
  strength: number
  cold: string
}) {
  const ref = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uCold: { value: new THREE.Color(cold) },
      uWarm: { value: new THREE.Color("#d97b45") },
      uMix: { value: 0 },
      uSun: { value: SUN_DIR },
      uPower: { value: power },
      uStrength: { value: strength },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useFrame(() => {
    if (ref.current) ref.current.uniforms.uMix.value = progress.current
  })

  return (
    <mesh scale={scale}>
      <sphereGeometry args={[1, segments, segments]} />
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        vertexShader={ATMOSPHERE_VERT}
        fragmentShader={ATMOSPHERE_FRAG}
      />
    </mesh>
  )
}

function Atmosphere({ progress, lite }: { progress: DescentProgress; lite: boolean }) {
  return (
    <>
      {/* Тонкая яркая линия воздуха у самой поверхности. */}
      <AtmosphereShell
        progress={progress}
        scale={1.022}
        segments={lite ? 24 : 64}
        power={4.2}
        strength={1.15}
        cold="#a9d6ff"
      />
      {/* Внешняя рассеянная дымка — даёт объём, но не превращается в кольцо. */}
      <AtmosphereShell
        progress={progress}
        scale={1.11}
        segments={lite ? 18 : 40}
        power={2.4}
        strength={0.28}
        cold="#3f86d8"
      />
    </>
  )
}

/**
 * Один рой обломков одной формы. Форм две, потому что настоящий орбитальный
 * мусор — это не только куски корпуса: половина каталога это обрывки панелей,
 * экранно-вакуумной изоляции и обтекателей, то есть плоские пластины. Один
 * многогранник на всё поле читался как «полигональные камушки».
 */
function DebrisSwarm({
  progress,
  count,
  flat,
}: {
  progress: DescentProgress
  count: number
  /** Плоские обломки панелей вместо компактных кусков. */
  flat: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const seeds = useMemo(() => {
    return Array.from({ length: count }, () => {
      // Реальный пояс мусора — низкая орбита (200-2000 км), плотнее всего
      // около 800-1000 км (ESA/NASA) — в радиусах Земли это 1.03-1.34, пик
      // около 1.13-1.16. Среднее двух случайных чисел смещает разброс к
      // центру диапазона вместо равномерного — так же, как в реальности.
      // ~14% рассеяны дальше (выше НОО, вплоть до МЕО) — реже, но не ноль.
      const isFar = Math.random() < 0.09
      const radius = isFar
        ? 1.28 + Math.random() * 0.32
        : 1.012 + ((Math.random() + Math.random()) / 2) * 0.17
      const theta = Math.random() * Math.PI * 2
      // Равномерная сфера по phi выглядит как статичное облако — вращение
      // на глаз незаметно (она ротационно-симметрична), и это и читалось
      // как "мусор сам по себе". 65% частиц прижаты к экваториальной
      // плоскости (реальный пояс НОО почти плоский), это даёт узнаваемый
      // наклонный пояс, видимый даже на неподвижном кадре — как у Земли
      // с её наклоном оси, а не бесформенное гало точек.
      const isBelt = Math.random() < 0.65
      const phi = isBelt
        ? Math.PI / 2 + (Math.random() + Math.random() - 1) * 0.55
        : Math.acos(2 * Math.random() - 1)
      return {
        radius,
        theta,
        drift: 0,
        // Кеплеровская угловая скорость (∝ r^-1.5) — ближние обломки видимо
        // обгоняют дальние и саму Землю, а не крутятся одним жёстким блоком
        // с планетой. Реальный НОО-мусор облетает Землю за ~90 минут, Земля
        // вращается за сутки — они физически НЕ должны двигаться синхронно,
        // именно разница в скорости и читается как "это орбита", а не сцепка.
        driftSpeed: 0.032 / Math.pow(radius, 1.5),
        phi,
        tumble: Math.random() * Math.PI * 2,
        tumbleY: Math.random() * Math.PI * 2,
        tumbleZ: Math.random() * Math.PI * 2,
        // Размер подобран под БЛИЗКУЮ камеру: крупный обломок занимает
        // 6-8 экранных точек, мелкий едва различимую точку. Показатель 2.9
        // сильнее прежнего смещает разброс к мелочи — крупных кусков в
        // каталоге единицы, крошки сотни тысяч.
        scale: 0.0009 + Math.pow(Math.random(), 2.9) * 0.0052,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  useFrame((_, delta) => {
    if (!ref.current) return
    const p = progress.current
    // Спуск: рой чуть проседает к поверхности и сползает вниз по кадру.
    // Раньше сжатие было втрое сильнее и обломки уходили ВНУТРЬ планеты —
    // при близкой камере это сразу видно.
    const contraction = 1 - p * 0.1

    seeds.forEach((s, i) => {
      s.drift += s.driftSpeed * delta * (0.4 + p * 1.2)
      const theta = s.theta + s.drift
      const r = s.radius * contraction
      const x = r * Math.sin(s.phi) * Math.cos(theta)
      const y = r * Math.cos(s.phi) - p * 0.55
      const z = r * Math.sin(s.phi) * Math.sin(theta)
      dummy.position.set(x, y, z)
      dummy.rotation.set(s.tumble + p * 3, s.tumbleY + s.drift * 0.6, s.tumbleZ)
      if (flat) {
        // Пластина: длинная, широкая, почти без толщины. Кувыркаясь, она то
        // ловит блик всей плоскостью, то пропадает в ребро — этого мерцания
        // у одинаковых многогранников не было.
        dummy.scale.set(s.scale * 2.1, s.scale * 0.16, s.scale * 1.25)
      } else {
        dummy.scale.setScalar(s.scale)
      }
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh key={`${flat}-${count}`} ref={ref} args={[undefined, undefined, count]}>
      {flat ? <boxGeometry args={[1, 1, 1]} /> : <icosahedronGeometry args={[1, 0]} />}
      <meshStandardMaterial
        color={flat ? "#9aa3ab" : "#7c858d"}
        roughness={flat ? 0.32 : 0.6}
        metalness={flat ? 0.72 : 0.4}
      />
    </instancedMesh>
  )
}

function Debris({ progress, lite }: { progress: DescentProgress; lite: boolean }) {
  return (
    <>
      <DebrisSwarm
        progress={progress}
        count={lite ? DEBRIS_COUNT_LITE : DEBRIS_COUNT_FULL}
        flat={false}
      />
      <DebrisSwarm
        progress={progress}
        count={lite ? DEBRIS_PLATES_LITE : DEBRIS_PLATES_FULL}
        flat
      />
    </>
  )
}

const SATELLITE_COUNT = 26

function Satellites({ progress }: { progress: DescentProgress }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])

  const seeds = useMemo(
    () =>
      Array.from({ length: SATELLITE_COUNT }, () => {
        const radius = 1.04 + Math.random() * 0.28
        return {
          // Ближе к рою обломков, без разрыва до дальнего рассеянного слоя.
          radius,
          theta: Math.random() * Math.PI * 2,
          phi: Math.acos(2 * Math.random() - 1),
          // Своя орбитальная скорость (кеплеровская, как у роя обломков) —
          // спутники видимо облетают планету, а не крутятся вместе с ней
          // одним жёстким блоком.
          driftSpeed: 0.03 / Math.pow(radius, 1.5),
          driftPhase: 0,
          tumble: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
          tumbleSpeed: 0.15 + Math.random() * 0.25,
        }
      }),
    []
  )

  useFrame((_, delta) => {
    const p = progress.current
    seeds.forEach((s, i) => {
      const ref = groupRefs.current[i]
      if (!ref) return
      s.driftPhase += s.driftSpeed * delta * (0.5 + p)
      const theta = s.theta + s.driftPhase
      const r = s.radius * (1 - p * 0.1)
      ref.position.set(
        r * Math.sin(s.phi) * Math.cos(theta),
        r * Math.cos(s.phi) - p * 0.55,
        r * Math.sin(s.phi) * Math.sin(theta)
      )
      ref.rotateOnAxis(s.tumble, s.tumbleSpeed * delta)
    })
  })

  return (
    <>
      {seeds.map((_, i) => (
        <group key={i} ref={el => { groupRefs.current[i] = el }} scale={0.007}>
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
      // Выше дуги горизонта и дальше от камеры — пролёты идут по чёрному
      // небу над планетой, а не проносятся перед самым объективом.
      Array.from({ length: STREAK_COUNT }, () => ({
        z: -4 + Math.random() * 3.5,
        y: 1.2 + Math.random() * 2.2,
        cycle: 5 + Math.random() * 4,
        offset: Math.random() * 10,
        length: 0.06 + Math.random() * 0.12,
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
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    const p = progress.current
    // Камера стоит НА низкой орбите, а не смотрит на глобус издалека. Земля
    // закрывает нижние две трети кадра и обрезается краями — как на снимках
    // с орбиты. Именно из-за дальней камеры рой читался как отдельное облако
    // вокруг шарика: теперь обломки проходят на фоне самой поверхности.
    camera.position.set(0.35 + p * 0.2, 0.62 - p * 0.32, 1.86 - p * 0.41)
    // Центр планеты уходит ниже кадра, в кадре остаётся дуга горизонта.
    target.set(0, 0.88 + p * 0.27, 0)
    camera.lookAt(target)
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
      camera={{ fov: 34, position: [0.35, 0.62, 1.86] }}
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
      {/* Солнце сбоку: в кадре виден терминатор — освещённая половина и
          уходящая в тень. Ночная сторона почти чёрная (низкий ambient),
          как на реальных орбитальных снимках, и текст на ней читается. */}
      <ambientLight intensity={0.1} />
      <directionalLight position={[-3, 1.2, 1.6]} intensity={1.3} color="#fff6e8" />
      {/* Общий наклон оси (0.41 рад) — на Земле, атмосфере, поясе обломков
          и спутниках одновременно, чтобы пояс был наклонён так же, как ось
          Земли, а не крутился отдельно вокруг вертикали. Собственно
          вращение роя и спутников уже НЕ завязано на вращение Земли —
          у орбитального мусора реальная угловая скорость выше суточной,
          и видимая разница в скорости читается как "это орбита", а не
          жёсткая сцепка с планетой. */}
      <group rotation={[0, 0, 0.41]}>
        {lite ? <EarthLite spin={spin} /> : <EarthCore spin={spin} />}
        <Atmosphere progress={progress} lite={lite} />
        <Debris progress={progress} lite={lite} />
        {!lite && <Satellites progress={progress} />}
      </group>
      {!lite && <Moon />}
      {!lite && <Streaks />}
      <Rig progress={progress} />
    </Canvas>
  )
}
