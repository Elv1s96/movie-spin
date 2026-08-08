<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'

export interface Segment {
  id: string
  label: string
  weight: number
  posterUrl?: string | null
}

const props = defineProps<{
  segments: Segment[]
  spinning: boolean
}>()

// Палітра секторів: 8 виразно різних відтінків, впорядкованих тепле/холодне
// через один, щоб сусідні сектори добре контрастували. Синхронізована з
// FILLS у WheelView.vue (смужки/свотчі в списку — легенда колеса).
const FILLS = [
  { bg: '#ffd400', fg: '#141007' }, // жовтий
  { bg: '#3ea0ff', fg: '#08111f' }, // синій
  { bg: '#ff7a2f', fg: '#1f0c00' }, // помаранчевий
  { bg: '#a877ff', fg: '#120724' }, // фіолетовий
  { bg: '#43c66b', fg: '#06210f' }, // зелений
  { bg: '#ff5fa2', fg: '#25061a' }, // рожевий
  { bg: '#22c7c7', fg: '#032020' }, // бірюзовий
  { bg: '#ff5147', fg: '#260403' }, // червоний
]

const wheelEl = ref<HTMLElement | null>(null)
const pointerEl = ref<HTMLElement | null>(null)
const confettiCanvas = ref<HTMLCanvasElement | null>(null)

let rot = 0
let raf = 0
let craf = 0
let parts: any[] = []

// Ефективні ваги: ≤0 → 0; якщо всі нульові — рівні шанси (як на бекенді).
const effWeights = computed(() => {
  const w = props.segments.map((s) => (s.weight > 0 ? s.weight : 0))
  const total = w.reduce((s, x) => s + x, 0)
  return total > 0 ? w : props.segments.map(() => 1)
})

const total = computed(() => effWeights.value.reduce((s, x) => s + x, 0) || 1)

// Межі кожного сектора в градусах + оформлення підпису.
const sectors = computed(() => {
  let acc = 0
  return props.segments.map((seg, i) => {
    const f = effWeights.value[i] / total.value
    const a0 = acc * 360
    acc += f
    const a1 = acc * 360
    const mid = (a0 + a1) / 2
    const arc = a1 - a0
    const fill = FILLS[i % FILLS.length]
    const short = seg.label.length > 18 ? seg.label.slice(0, 17) + '…' : seg.label
    return { id: seg.id, a0, a1, mid, arc, fill, short, posterUrl: seg.posterUrl }
  })
})

// Усі сектори, що мають постер.
const posterSectors = computed(() => sectors.value.filter((s) => s.posterUrl))

// Постери малюємо через SVG (viewBox 200×200, центр 100,100, радіус 100).
// Клин сектора — справжній <path> з дугою, тож коректно описує будь-який
// кут, включно з секторами >180° (де трикутний clip-path раніше зникав).

// Точка на ободі під кутом deg (0° — вгорі, за годинниковою — як conic).
function pt(deg: number, r: number): [number, number] {
  const a = (deg - 90) * (Math.PI / 180)
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]
}

// SVG-контур клину сектора (для <clipPath>).
function wedgePath(s: { a0: number; a1: number; arc: number }): string {
  if (s.arc >= 359.99) return 'M 100 0 A 100 100 0 1 1 99.99 0 Z'
  const [x0, y0] = pt(s.a0, 100)
  const [x1, y1] = pt(s.a1, 100)
  const large = s.arc > 180 ? 1 : 0
  return (
    `M 100 100 L ${x0.toFixed(3)} ${y0.toFixed(3)} ` +
    `A 100 100 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`
  )
}

// Постер: радіальний прямокутник від центру (низ) до обода (верх),
// ширина ≈ хорда клину, повернутий до mid, cover (slice) — без спотворення.
function posterImgAttrs(s: { mid: number; arc: number }) {
  const w = s.arc >= 180 ? 200 : Math.max(12, 200 * Math.sin((s.arc / 2) * (Math.PI / 180)))
  return {
    x: (100 - w / 2).toFixed(3),
    y: '0',
    width: w.toFixed(3),
    height: '100',
    preserveAspectRatio: 'xMidYMid slice',
    transform: `rotate(${s.mid} 100 100)`,
  }
}

const conic = computed(() => {
  if (!sectors.value.length) return '#3a3634'
  const stops = sectors.value
    .map((s) => `${s.fill.bg} ${s.a0.toFixed(3)}deg ${s.a1.toFixed(3)}deg`)
    .join(',')
  return `conic-gradient(from 0deg,${stops})`
})

function wrapStyle(s: { mid: number }) {
  return {
    position: 'absolute',
    left: '50%',
    top: '0',
    width: '0',
    height: '50%',
    transformOrigin: '50% 100%',
    transform: `rotate(${s.mid}deg)`,
    pointerEvents: 'none',
  } as Record<string, string>
}

function dividerStyle(s: { a0: number; mid: number }) {
  return {
    position: 'absolute',
    top: '0',
    left: '-1.5px',
    width: '3px',
    height: '100%',
    background: 'rgba(248,244,244,.92)',
    transformOrigin: '50% 100%',
    transform: `rotate(${s.a0 - s.mid}deg)`,
  } as Record<string, string>
}

function labelStyle(s: { mid: number; arc: number; fill: { fg: string } }) {
  const rightHalf = s.mid > 0 && s.mid < 180
  const base: Record<string, string> = {
    position: 'absolute',
    left: '0',
    top: '28px',
    whiteSpace: 'nowrap',
    fontSize: `${s.arc < 14 ? 12 : s.arc < 26 ? 14 : 17}px`,
    fontWeight: '800',
    letterSpacing: '-.01em',
    textShadow: '0 1px 2px rgba(0,0,0,.35)',
    color: s.fill.fg,
  }
  if (rightHalf) {
    base.transform = 'translate(-100%,-50%) rotate(-90deg)'
    base.transformOrigin = '100% 50%'
  } else {
    base.transform = 'translateY(-50%) rotate(90deg)'
    base.transformOrigin = '0 50%'
  }
  return base
}

function pointerKick() {
  const p = pointerEl.value
  if (!p) return
  p.style.transition = 'none'
  p.style.transform = 'rotate(-16deg)'
  requestAnimationFrame(() => {
    if (!p) return
    p.style.transition = 'transform .26s cubic-bezier(.2,1.7,.5,1)'
    p.style.transform = 'rotate(0deg)'
  })
}

/**
 * Анімує колесо так, щоб сектор `index` зупинився під стрілкою.
 * Індекс приходить з бекенду (переможець рахується там). Повертає
 * проміс, що резолвиться, коли колесо зупинилось.
 */
function spinTo(index: number, durationMs = 6800): Promise<void> {
  return new Promise((resolve) => {
    const s = sectors.value[index]
    if (!s) return resolve()

    const mid = s.a0 + (s.a1 - s.a0) * (0.18 + Math.random() * 0.64)
    const cur = ((rot % 360) + 360) % 360
    const targetMod = ((-mid % 360) + 360) % 360
    const dur = Math.max(1200, durationMs)
    const durSec = dur / 1000
    // Кількість обертів пропорційна тривалості → колесо помітно крутиться усю
    // задану тривалість, а «відчуття» спіну однакове за будь-якого часу.
    const turns = Math.max(3, Math.round(durSec)) + Math.floor(Math.random() * 2)
    const delta = turns * 360 + ((targetMod - cur + 360) % 360)
    const start = rot
    const t0 = performance.now()
    let lastSector = -1
    const bounds = sectors.value.map((x) => [x.a0, x.a1])
    // easeOutQuad: рівномірне гальмування (як реальне колесо на терті). Прогрес —
    // функція від частки часу x = t/dur, тож рух триває усю задану тривалість.
    const ease = (x: number) => 1 - (1 - x) * (1 - x)

    const step = (now: number) => {
      const x = Math.min(1, (now - t0) / dur)
      rot = start + delta * ease(x)
      if (wheelEl.value) wheelEl.value.style.transform = `rotate(${rot}deg)`
      const under = ((-rot % 360) + 360) % 360
      const sec = bounds.findIndex((b) => under >= b[0] && under < b[1])
      if (sec !== lastSector) {
        if (lastSector !== -1) pointerKick()
        lastSector = sec
      }
      if (x < 1) {
        raf = requestAnimationFrame(step)
      } else {
        rot = start + delta
        if (wheelEl.value) wheelEl.value.style.transform = `rotate(${rot}deg)`
        burst()
        resolve()
      }
    }
    raf = requestAnimationFrame(step)
  })
}

function burst() {
  const c = confettiCanvas.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  c.width = rect.width
  c.height = rect.height
  const cols = ['#ffd400', '#f5c518', '#ffe98a', '#f8f4f4', '#8a6a00']
  for (let i = 0; i < 160; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
    const v = 7 + Math.random() * 14
    parts.push({
      x: rect.width / 2,
      y: rect.height * 0.5,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      w: 4 + Math.random() * 8,
      h: 3 + Math.random() * 5,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
      col: cols[i % cols.length],
      life: 1,
    })
  }
  if (!craf) craf = requestAnimationFrame(tick)
}

function tick() {
  const c = confettiCanvas.value
  if (!c) {
    craf = 0
    return
  }
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  parts = parts.filter((p) => p.life > 0 && p.y < c.height + 40)
  parts.forEach((p) => {
    p.vy += 0.34
    p.vx *= 0.994
    p.x += p.vx
    p.y += p.vy
    p.rot += p.vr
    p.life -= 0.004
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6))
    ctx.fillStyle = p.col
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    ctx.restore()
  })
  craf = parts.length ? requestAnimationFrame(tick) : 0
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  cancelAnimationFrame(craf)
})

defineExpose({ spinTo })
</script>

<template>
  <div class="stage">
    <canvas ref="confettiCanvas" class="confetti"></canvas>

    <div class="wheel-box">
      <div class="wheel-shadow"></div>
      <div class="wheel-rim"></div>

      <div class="wheel-clip">
        <div ref="wheelEl" class="wheel" :style="{ background: conic }">
          <svg
            v-if="posterSectors.length"
            class="poster-svg"
            viewBox="0 0 200 200"
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath v-for="s in posterSectors" :id="'cp-' + s.id" :key="'cp-' + s.id">
                <path :d="wedgePath(s)" />
              </clipPath>
            </defs>
            <g v-for="s in posterSectors" :key="'pi-' + s.id" :clip-path="`url(#cp-${s.id})`">
              <image v-bind="posterImgAttrs(s)" :href="s.posterUrl!" />
            </g>
          </svg>
          <div v-for="s in sectors" :key="s.id" :style="wrapStyle(s)">
            <span :style="dividerStyle(s)"></span>
            <span v-if="!s.posterUrl" :style="labelStyle(s)">{{ s.short }}</span>
          </div>
        </div>
        <div class="gloss"></div>
        <div class="vignette"></div>
      </div>

      <div ref="pointerEl" class="pointer">
        <div class="pointer-body"></div>
        <div class="pointer-shine"></div>
      </div>

      <div class="hub">
        <button class="hub-btn" :disabled="segments.length < 2 || spinning" @click="$emit('spin')">
          {{ spinning ? '···' : 'Start\nRoll' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  /* Заповнюємо вільне місце: до 760px, але не вище 72% висоти екрана,
     щоб колесо не перекривало кнопку/історію на нижчих екранах. */
  width: min(760px, 72vh, 100%);
  aspect-ratio: 1;
  flex: 0 0 auto;
}
.confetti {
  position: absolute;
  inset: -40% -40% 0 -40%;
  width: 180%;
  height: 140%;
  pointer-events: none;
  z-index: 20;
}
.wheel-box { position: absolute; inset: 0; }
.wheel-shadow {
  position: absolute; left: 8%; right: 8%; bottom: -3%; height: 8%;
  border-radius: 50%; background: rgba(0, 0, 0, 0.55); filter: blur(18px);
}
.wheel-rim {
  position: absolute; inset: 0; border-radius: 50%;
  background: linear-gradient(#f8f4f4, #bab6b6);
  box-shadow: 0 26px 60px rgba(0,0,0,.55), 0 2px 0 rgba(255,255,255,.35) inset, 0 -10px 22px rgba(0,0,0,.35) inset;
}
.wheel-clip {
  position: absolute; inset: 3.4%; border-radius: 50%; overflow: hidden;
  box-shadow: 0 0 0 2px rgba(32,30,29,.9), 0 14px 26px rgba(0,0,0,.5) inset;
}
.wheel { position: absolute; inset: 0; border-radius: 50%; will-change: transform; }
.poster-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.gloss {
  position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background: radial-gradient(78% 60% at 34% 22%, rgba(255,255,255,.30) 0%, rgba(255,255,255,.06) 42%, rgba(255,255,255,0) 62%),
              radial-gradient(100% 100% at 50% 105%, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 55%);
}
.vignette {
  position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  box-shadow: 0 0 44px 14px rgba(0,0,0,.45) inset;
}
.pointer {
  position: absolute; top: -3.5%; left: 50%; margin-left: -17px;
  width: 34px; height: 58px; z-index: 15; transform-origin: 50% 10%;
  filter: drop-shadow(0 6px 10px rgba(0,0,0,.6));
}
.pointer-body {
  position: absolute; inset: 0;
  background: linear-gradient(#ffe27a, #ffd400 55%, #c9a200);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.pointer-shine {
  position: absolute; top: 0; left: 26%; width: 16%; height: 62%;
  background: rgba(255,255,255,.5); clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.hub {
  position: absolute; top: 50%; left: 50%; width: 26%; height: 26%;
  transform: translate(-50%, -50%); border-radius: 50%; z-index: 12;
  background: linear-gradient(#f8f4f4, #d7d3d3);
  box-shadow: 0 10px 22px rgba(0,0,0,.55), 0 -4px 10px rgba(0,0,0,.25) inset, 0 3px 0 rgba(255,255,255,.7) inset;
  display: flex; align-items: center; justify-content: center;
}
.hub-btn {
  width: 82%; height: 82%; border-radius: 50%; border: 2px solid #201e1d;
  background: linear-gradient(#2d2b2b, #141312); color: #f3f2f2;
  font-size: 12px; font-weight: 900; line-height: 1.15; letter-spacing: .1em;
  text-transform: uppercase; white-space: pre-line; cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,.5) inset;
}
.hub-btn:disabled { background: #3a3634; color: #7d7979; cursor: not-allowed; }
</style>
