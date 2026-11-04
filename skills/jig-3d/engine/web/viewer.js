// The 3D step viewer. No static import: createViewer() loads three.js with import() and, on failure, writes the
// reason into the viewer slot. Parts already built are plain, the parts of this step are lit and arrive along their
// path, parts still to come are hidden (or ghosted). Units are millimetres, y is up. One WebGL renderer is shared:
// only the viewer on screen owns the canvas.
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
const CAPTURE = /[?&]capture\b/.test(location.search); // keep the drawing buffer only for screen captures
const MSG = {
  webgl: "3D needs WebGL. The steps still work without it.",
  network: "3D needs a network connection. The steps still work without it.",
};
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));
let THREE = null, Orbit = null, loading = null, shared = null;

// WebGL first (a test canvas), then the two modules. Each failure carries its reason.
function hasWebGL() {
  try {
    const c = document.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch { return false; }
}
function load3d() {
  return (loading ??= (async () => {
    if (!hasWebGL()) throw Object.assign(new Error("WebGL is not available"), { reason: "webgl" });
    try {
      const [t, o] = await Promise.all([import("three"), import("three/addons/controls/OrbitControls.js")]);
      THREE = t;
      Orbit = o.OrbitControls;
    } catch (e) { throw Object.assign(new Error(e?.message ?? String(e)), { reason: "network" }); }
  })());
}

function fail(host, err) {
  const p = document.createElement("p");
  p.className = "vmsg";
  p.textContent = err?.reason ? MSG[err.reason] : `3D error: ${err?.message ?? err}. The steps still work without it.`;
  host.replaceChildren(p);
  host.dataset.state = err?.reason ?? "error";
  if (!err?.reason) console.warn("jig 3D:", err);
}

// One renderer for the page. The canvas moves to the viewer that is on screen.
function renderer() {
  if (shared) return shared;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: CAPTURE });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  const c = r.domElement;
  c.tabIndex = 0;
  c.setAttribute("role", "img");
  c.addEventListener("keydown", (e) => { if (shared.owner?.key(e)) { e.preventDefault(); e.stopPropagation(); } });
  return (shared = { r, canvas: c, owner: null });
}

// createViewer(host, data, { mode: "hero" | "steps", label, onSpin }) -> viewer API, or null when 3D cannot run.
export async function createViewer(host, data, opts = {}) {
  try { await load3d(); } catch (e) { fail(host, e); return null; }
  try { return build(host, data, opts); } catch (e) { fail(host, e); return null; }
}

function build(host, data, { mode = "steps", label = "3D view", onSpin } = {}) {
  const T = THREE, hero = mode === "hero", R = renderer(), canvas = R.canvas;
  const box = host.querySelector("[data-canvas]"), layer = host.querySelector("[data-tags]");
  const UP = new T.Vector3(0, 1, 0), V = (a) => new T.Vector3(...a), RAD = Math.PI / 180;
  const small = Math.min(screen.width || 1e4, screen.height || 1e4) < 700;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1.6, 10, 60000);
  const controls = new Orbit(camera, canvas);
  canvas.style.touchAction = ""; // OrbitControls sets none; the CSS gives pan-y until a tap turns on orbit
  controls.enabled = false;
  controls.enableDamping = true;
  controls.autoRotateSpeed = 0.7;
  controls.maxPolarAngle = Math.PI * 0.495;

  // ---- theme tokens
  const tok = {};
  const readTokens = () => {
    const cs = getComputedStyle(host);
    for (const k of ["ink", "accent", "grid"]) tok[k] = cs.getPropertyValue(`--v-${k}`).trim() || "#888888";
    const shade = parseFloat(cs.getPropertyValue("--v-prop")); // props (a white wall) are dimmed in the dark theme
    tok.prop = shade > 0 && shade <= 1 ? shade : 1;
  };
  readTokens();

  // ---- lights and floor
  const hemi = new T.HemisphereLight(0xffffff, 0x8a7f72, 2.1);
  const sun = new T.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  scene.add(hemi, sun, sun.target);
  const floor = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.ShadowMaterial({ opacity: 0.18 }));
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- shapes: a box, or a cylinder along the side that is not one of the two equal sides
  const axisOf = ([x, y, z]) => { const eq = (a, b) => Math.abs(a - b) < 1e-6; return eq(x, z) ? 1 : eq(x, y) ? 2 : eq(y, z) ? 0 : -1; };
  function shape(kind, size) {
    const axis = kind === "cylinder" ? axisOf(size) : -1;
    if (axis < 0) return new T.BoxGeometry(...size);
    const r = size[(axis + 1) % 3] / 2, g = new T.CylinderGeometry(r, r, size[axis], 28);
    if (axis === 0) g.rotateZ(Math.PI / 2);
    if (axis === 2) g.rotateX(Math.PI / 2);
    return g;
  }
  function solid(g, mat, edge) {
    const m = new T.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    if (edge) m.add(new T.LineSegments(new T.EdgesGeometry(g, 30), edge));
    return m;
  }
  // rotate [rx, ry, rz] degrees about the box centre, x then y then z (R = Rz Ry Rx, as geometry.mjs)
  const turn = (m, r) => { if (isVec(r)) m.rotation.set(r[0] * RAD, r[1] * RAD, r[2] * RAD, "ZYX"); };

  // ---- parts: an assembled mesh and a flat "kit" mesh share one material per part
  for (const p of data.parts) if (!isVec(p.at) || !isVec(p.size)) throw new Error(`part ${p.id} has no position ("at") or size`);
  const parts = data.parts.map((p, i) => {
    const size = V(p.size), center = V(p.at).addScaledVector(size, 0.5);
    const base = new T.Color(p.color || "#cfc6b8");
    base.offsetHSL(0, 0, (((i * 37) % 7) - 3) * 0.008); // a little variation, like real boards
    const mat = new T.MeshLambertMaterial({ color: base.clone() }), edge = new T.LineBasicMaterial({ color: tok.ink, transparent: true });
    const mesh = solid(shape(p.shape, p.size), mat, edge);
    mesh.position.copy(center);
    turn(mesh, p.rotate);
    mesh.updateMatrixWorld();
    const wb = new T.Box3().setFromObject(mesh);
    const flat = [...p.size].sort((a, b) => b - a), round = p.shape === "cylinder" && axisOf(p.size) >= 0;
    const kitSize = round ? [p.size[axisOf(p.size)], p.size[(axisOf(p.size) + 1) % 3], p.size[(axisOf(p.size) + 1) % 3]] : [flat[0], flat[2], flat[1]];
    const kit = p.kind === "each" ? null : solid(shape(p.shape, kitSize), mat, edge); // bought parts are not cut; printed parts lie in the kit too
    return { ...p, i, center, base, mat, edge, mesh, kit, kitSize, round, offset: new T.Vector3(), fly: new T.Vector3(), state: "hidden", wb };
  });
  const assembly = new T.Group(), kitGroup = new T.Group();
  parts.forEach((p) => { assembly.add(p.mesh); if (p.kit) kitGroup.add(p.kit); });
  scene.add(assembly, kitGroup);

  // ---- props (wall, bench): context only, never in the bill
  const props = Object.entries(data.props || {}).filter(([, pr]) => isVec(pr.at) && isVec(pr.size)).map(([id, pr]) => {
    const base = new T.Color(pr.color || "#e6e1d8"), m = solid(shape(pr.shape, pr.size), new T.MeshLambertMaterial({ color: base.clone().multiplyScalar(tok.prop) }), null);
    m.position.copy(V(pr.at).addScaledVector(V(pr.size), 0.5));
    turn(m, pr.rotate);
    m.castShadow = false;
    m.visible = false;
    scene.add(m);
    m.updateMatrixWorld(true);
    // props never move: their world box (0.5 mm inside, so a part that only touches one is not in it) stops "Apart"
    return { id, m, base, hero: pr.hero !== false, box: new T.Box3().setFromObject(m).expandByScalar(-0.5) };
  });

  // the camera frames the parts. A repair has no parts: the object that is there (the props of the Plan view) sets it.
  const bounds = new T.Box3();
  parts.forEach((p) => bounds.union(p.wb));
  if (bounds.isEmpty()) props.filter((pr) => pr.hero).forEach((pr) => bounds.union(new T.Box3().setFromObject(pr.m)));
  if (bounds.isEmpty()) bounds.set(new T.Vector3(-100, 0, -100), new T.Vector3(100, 200, 100));
  const modelCenter = bounds.getCenter(new T.Vector3()), modelSize = Math.max(1, bounds.getSize(new T.Vector3()).length());
  controls.minDistance = Math.max(10, modelSize * 0.03); // close enough for a zoomed step on a bracket
  controls.maxDistance = Math.max(2000, modelSize * 8);

  // kit layout: rows on the floor, centred under the assembly. Bounds come from the kit meshes only (all visible).
  const kitBox = new T.Box3();
  {
    const cut = parts.filter((p) => p.kit).sort((a, b) => b.kitSize[0] - a.kitSize[0]);
    const rowMax = Math.max(1600, modelSize * 0.9, ...cut.map((p) => p.kitSize[0])), gap = Math.max(20, modelSize * 0.04);
    let x = 0, z = 0, rowDepth = 0;
    for (const p of cut) {
      if (x > 0 && x + p.kitSize[0] > rowMax) { x = 0; z += rowDepth + gap; rowDepth = 0; }
      p.kit.position.set(x + p.kitSize[0] / 2, p.kitSize[1] / 2, z + p.kitSize[2] / 2);
      kitBox.union(new T.Box3().setFromCenterAndSize(p.kit.position, V(p.kitSize)));
      x += p.kitSize[0] + gap;
      rowDepth = Math.max(rowDepth, p.kitSize[2]);
    }
    if (!kitBox.isEmpty()) {
      const kc = kitBox.getCenter(new T.Vector3());
      kitGroup.position.set(modelCenter.x - kc.x, 0, modelCenter.z - kc.z);
      kitBox.translate(kitGroup.position);
    }
  }

  // ---- fasteners: one InstancedMesh pair (shaft + head) per type; head at `at`, the shaft runs along `dir`
  const HEADS = {
    flat: (d) => new T.CylinderGeometry(d, d * 0.5, d * 0.6, 16).translate(0, -d * 0.2, 0),
    pan: (d) => new T.CylinderGeometry(d * 0.8, d * 0.95, d * 0.6, 16).translate(0, d * 0.3, 0),
    hex: (d) => new T.CylinderGeometry(d * 0.95, d * 0.95, d * 0.7, 6).translate(0, d * 0.35, 0),
  };
  const types = new Map(), fast = [];
  data.steps.forEach((s, si) => (s.fasteners || []).forEach((f, fi) => {
    if (!isVec(f.at)) return; // a counted fastener: in the bill, not drawn
    if (!isVec(f.dir) || !f.dir.some((v) => v !== 0)) throw new Error(`fastener ${fi + 1} of step ${si + 1} has no direction ("dir")`);
    const len = f.len > 0 ? f.len : 30, d = f.d > 0 ? f.d : 4, head = Object.hasOwn(HEADS, f.head ?? "") ? f.head : "flat";
    const key = `${len}|${d}|${head}|${f.color || ""}`;
    if (!types.has(key)) types.set(key, { len, d, head, base: new T.Color(f.color || "#8f959c"), list: [] });
    const t = types.get(key), dir = V(f.dir).normalize();
    const item = { step: si, t, k: t.list.length, home: V(f.at), dir, len, q: new T.Quaternion().setFromUnitVectors(UP, dir.clone().negate()), state: "hidden" };
    t.list.push(item);
    fast.push(item);
  }));
  for (const t of types.values()) {
    const mat = new T.MeshLambertMaterial({ color: 0xffffff });
    t.meshes = [new T.CylinderGeometry(t.d / 2, t.d * 0.3, t.len, 10).translate(0, -t.len / 2, 0), HEADS[t.head](t.d)].map((g) => {
      const m = new T.InstancedMesh(g, mat, t.list.length);
      m.castShadow = true;
      m.frustumCulled = false;
      for (let k = 0; k < t.list.length; k++) m.setColorAt(k, t.base);
      scene.add(m);
      return m;
    });
  }
  // A fastener moves with its host when the parts move apart: the part its shank enters first, just past the head
  // (installed by its step; the smallest box when parts overlap). With no host it hides while the parts are apart.
  const volume = (b) => { const s = b.getSize(new T.Vector3()); return s.x * s.y * s.z; };
  for (const f of fast) {
    const into = f.home.clone().addScaledVector(f.dir, Math.min(1.5, f.len / 2)), all = parts.filter((p) => p.wb.containsPoint(into));
    const built = all.filter((p) => (typeof p.step === "number" ? p.step : Infinity) <= f.step);
    f.host = (built.length ? built : all).sort((a, b) => volume(a.wb) - volume(b.wb))[0] ?? null;
  }
  const M4 = new T.Matrix4(), P3 = new T.Vector3(), Q = new T.Quaternion(), SPIN = new T.Quaternion(), ONE = new T.Vector3(1, 1, 1), ZERO = new T.Vector3(0, 0, 0), C = new T.Color();
  // want: the state asks for it; visible: it is drawn (want, and a host or the parts together)
  function placeF(f, want, away = 0, spin = 0) {
    Object.assign(f, { want, away, spin });
    const visible = want && (Boolean(f.host) || !explode);
    P3.copy(f.home).addScaledVector(f.dir, -f.len * 1.6 * away);
    if (f.host) P3.add(f.host.offset);
    Q.copy(f.q).multiply(SPIN.setFromAxisAngle(UP, spin));
    M4.compose(P3, Q, visible ? ONE : ZERO);
    for (const m of f.t.meshes) { m.setMatrixAt(f.k, M4); m.instanceMatrix.needsUpdate = true; }
    f.visible = visible;
  }
  function colorF(f, lit) {
    C.copy(f.t.base);
    if (lit) C.lerp(new T.Color(tok.accent), 0.65);
    for (const m of f.t.meshes) { m.setColorAt(f.k, C); m.instanceColor.needsUpdate = true; }
  }

  // ---- frame the floor, grid and sun to the scene
  let grid;
  {
    const all = bounds.clone().union(kitBox.isEmpty() ? bounds : kitBox);
    const c = all.getCenter(new T.Vector3()), s = all.getSize(new T.Vector3());
    const span = Math.max(200, Math.ceil((Math.max(s.x, s.z) * 2.2) / 100) * 100);
    floor.scale.set(span * 2, 1, span * 2);
    floor.position.set(c.x, 0, c.z);
    grid = new T.GridHelper(span, Math.min(200, span / 100), tok.grid, tok.grid);
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    grid.position.set(c.x, 0.2, c.z);
    scene.add(grid);
    const r = Math.max(1, s.length());
    sun.position.set(c.x - r * 0.5, r * 1.3, c.z + r * 0.9);
    sun.target.position.copy(c);
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 10, far: r * 4 });
    sun.shadow.camera.updateProjectionMatrix();
  }

  // ---- tags: one letter per lit part, in HTML over the canvas
  const tags = new Map();
  const tag = (p) => {
    if (!tags.has(p.id)) {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = p.label;
      el.title = p.name;
      layer.appendChild(el);
      tags.set(p.id, el);
    }
    return tags.get(p.id);
  };
  const pins = fast.map(() => { const el = document.createElement("span"); el.className = "pin"; el.hidden = true; layer.appendChild(el); return el; });
  layer.setAttribute("aria-hidden", "true");

  // ---- state and animations. kind "camera" is dropped when the user takes over; the rest finish at once.
  let step = hero ? data.steps.length : 0, explode = false, ghost = false, userView = false, framed = false, sized = false;
  let paused = REDUCED.matches, active = false, tap = null, onScreen = false, running = false, need = true;
  const anims = [];
  const now = () => performance.now();
  const animate = (dur, fn, delay = 0, kind = "part") => {
    if (REDUCED.matches) { fn(1); wake(); return; } // an instant change still draws a new frame
    anims.push({ t0: now() + delay, dur, fn, kind });
    fn(0);
    wake();
  };
  const finish = () => { for (const a of anims.splice(0)) if (a.kind !== "camera") a.fn(1); };
  const kitPose = () => !hero && data.steps[step]?.pose === "kit";
  const stepOf = (p) => (typeof p.step === "number" ? p.step : Infinity); // a part no step installs never shows in steps
  const place = (p) => p.mesh.position.copy(p.center).add(p.offset).add(p.fly);
  // where "Apart" puts a part: 35% further out from the model centre (nowhere in the kit pose). A part never goes into
  // a prop that shows: it slides along the face of the prop that it is on (a bracket goes up the wall, not into it),
  // else it stops short of the prop.
  const apart = (p) => {
    const o = new T.Vector3();
    if (!explode || kitPose()) return o;
    o.copy(p.center).sub(modelCenter).multiplyScalar(0.35);
    const hits = (B, t = 1) => p.wb.clone().translate(o.clone().multiplyScalar(t)).intersectsBox(B);
    for (const pr of props) {
      const B = pr.box;
      if (!pr.m.visible || B.isEmpty() || p.wb.intersectsBox(B) || !hits(B)) continue;
      for (const a of ["x", "y", "z"]) if ((o[a] < 0 && p.wb.min[a] >= B.max[a]) || (o[a] > 0 && p.wb.max[a] <= B.min[a])) o[a] = 0;
      if (!hits(B)) continue;
      let lo = 0, hi = 1; // the largest share of the move that keeps the part out of the prop
      for (let k = 0; k < 8; k++) { const t = (lo + hi) / 2; if (hits(B, t)) hi = t; else lo = t; }
      o.multiplyScalar(lo);
    }
    return o;
  };

  // states: hidden, ghost, done, current (installed in this step), coat (built before, finished in this step)
  function paint(p, state) {
    p.state = state;
    const lit = state === "current" || state === "coat", see = state === "ghost";
    p.mat.color.copy(p.base);
    if (lit) p.mat.color.lerp(new T.Color(tok.accent), 0.22);
    p.mat.emissive.set(lit ? tok.accent : "#000000").multiplyScalar(lit ? 0.12 : 0);
    p.mat.transparent = see;
    p.mat.opacity = see ? 0.14 : 1;
    p.mat.depthWrite = !see;
    p.mesh.castShadow = !see; // a ghost (a part still to come) throws no shadow on the wall or the floor
    p.edge.color.set(lit ? tok.accent : tok.ink);
    p.edge.opacity = see ? 0.18 : lit ? 1 : 0.55;
    p.mat.needsUpdate = true;
  }

  function apply({ fly = true } = {}) {
    const kit = kitPose(), s = hero ? null : data.steps[step];
    assembly.visible = !kit;
    kitGroup.visible = kit;
    for (const pr of props) pr.m.visible = !kit && (hero ? pr.hero : (s?.props ?? []).includes(pr.id));
    const focus = new Set(kit ? s?.focus ?? [] : []), coat = new Set(kit ? [] : s?.finish?.parts ?? []);
    // before the first part goes in (a step that marks the wall), the parts to come show as a ghost, so the view is not empty
    const auto = !hero && !kit && parts.length > 0 && parts.every((p) => stepOf(p) > step);
    host.toggleAttribute("data-auto-ghost", auto);
    // while the view ghosts the parts on its own, "Show finished" shows as pressed and does nothing. In the kit pose, or
    // with no parts (a repair of an object that is there, all props), "Apart" and "Show finished" have no effect, so
    // both show as not pressed and do nothing. app.js skips a click on a disabled toggle. The flags stay, so a later step
    // shows the reader's own choice again. On a step where every part is already in place, "Show finished" stays as it is.
    const none = parts.length === 0; // a repair with no parts: nothing to move apart or to ghost
    const gb = host.querySelector("[data-v=ghost]"), eb = host.querySelector("[data-v=explode]");
    if (gb) { gb.setAttribute("aria-pressed", String(!kit && !none && (ghost || auto))); gb.setAttribute("aria-disabled", String(kit || none || auto)); }
    if (eb) { eb.setAttribute("aria-pressed", String(!kit && !none && explode)); eb.setAttribute("aria-disabled", String(kit || none)); }
    tags.forEach((el) => (el.hidden = true));
    for (const p of parts) {
      p.fly.set(0, 0, 0);
      if (kit) {
        paint(p, focus.has(p.id) ? "current" : "done");
        if (p.kit) tag(p).hidden = false;
        continue;
      }
      const at = stepOf(p), state = hero ? "done" : at < step ? (coat.has(p.id) ? "coat" : "done") : at === step ? "current" : ghost || auto ? "ghost" : "hidden";
      p.mesh.visible = state !== "hidden";
      paint(p, state);
      place(p);
      if (state === "current") tag(p).hidden = false;
    }
    // parts of this step arrive along a path: step.from, else outward from the model centre and from above
    const arriving = kit ? [] : parts.filter((p) => p.state === "current");
    if (fly) arriving.forEach((p, k) => {
      const away = isVec(s?.from) ? V(s.from) : p.center.clone().sub(modelCenter).setY(0).normalize().multiplyScalar(modelSize * 0.32).add(new T.Vector3(0, modelSize * 0.18, 0));
      animate(950, (t) => {
        const e = ease(t), see = e < 1;
        p.fly.copy(away).multiplyScalar(1 - e);
        place(p);
        if (p.mat.transparent !== see) { p.mat.transparent = see; p.mat.needsUpdate = true; }
        p.mat.opacity = Math.min(1, 0.15 + e * 1.2);
      }, k * 160);
    });
    const landed = arriving.length ? 950 + (arriving.length - 1) * 160 : 0;
    let order = 0;
    for (const f of fast) {
      const state = kit ? "hidden" : hero || f.step < step ? "done" : f.step === step ? "current" : "hidden";
      f.state = state;
      colorF(f, state === "current");
      placeF(f, state !== "hidden");
      if (state === "current" && fly) {
        const k = order++;
        animate(520, (t) => { const e = ease(t); placeF(f, t > 0, 1 - e, 6 * (1 - e)); }, landed + k * 45);
      }
    }
    applyExplode(false);
    frame({ jump: !fly });
    wake();
  }

  // move the parts apart or together; each fastener follows its host part
  function applyExplode(anim = true) {
    const moves = parts.map((p) => [p, p.offset.clone(), apart(p)]);
    const set = (t) => {
      const e = easeIO(t);
      for (const [p, from, to] of moves) { p.offset.lerpVectors(from, to, e); place(p); }
      for (const f of fast) placeF(f, f.want, f.away, f.spin);
    };
    anim ? animate(600, set) : set(1);
  }

  // The camera distance that fits every corner of box b around c, seen along back (target to camera), with the
  // object inside FIT_X of the half width and FIT_Y of the half height.
  const FIT_X = 0.9, FIT_Y = 0.8, LIFT = 0.06; // LIFT: the model sits this much (of the half height) above centre
  function fitDistance(b, c, back) {
    const right = new T.Vector3().crossVectors(UP, back);
    if (right.lengthSq() < 1e-9) right.set(1, 0, 0); // straight down
    right.normalize();
    const up = new T.Vector3().crossVectors(back, right);
    const tv = Math.tan((camera.fov * RAD) / 2), th = tv * camera.aspect, q = new T.Vector3();
    let d = 1;
    for (let k = 0; k < 8; k++) {
      q.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).sub(c);
      const z = q.dot(back);
      d = Math.max(d, z + Math.abs(q.dot(right)) / (th * FIT_X), z + Math.abs(q.dot(up)) / (tv * FIT_Y));
    }
    return { d, up, tv };
  }

  // ---- camera: the whole model (or the kit) in frame, clear of the hint and the toolbar; closer when a step asks
  // (view.zoom), but never so close that a lit part of the step goes out of the frame
  function frame({ force = false, jump = false } = {}) {
    if (userView && !force) return;
    const s = hero ? null : data.steps[step], v = s?.view ?? {}, kit = kitPose();
    // no az given: turn toward the side of this step's screw heads, half way from the front
    let autoAz = hero ? 32 : 36;
    const heads = kit ? new T.Vector3() : fast.filter((f) => f.step === step).reduce((a, f) => a.sub(f.dir), new T.Vector3());
    if (!hero && heads.lengthSq() > 0.25 && Math.hypot(heads.x, heads.z) > 0.5) autoAz = ((Math.atan2(heads.x, heads.z) * 180) / Math.PI) * 0.55;
    // the kit lies flat, so it is seen from higher up
    const az = (Number.isFinite(v.az) ? v.az : autoAz) * RAD, el = (Number.isFinite(v.el) ? v.el : kit ? 50 : 22) * RAD, zoom = v.zoom > 0 ? v.zoom : 1;
    const bx = kit && !kitBox.isEmpty() ? kitBox.clone() : bounds.clone();
    if (explode && !kit) parts.forEach((p) => bx.union(p.wb.clone().translate(apart(p)))); // "Apart" needs more room
    const c = bx.getCenter(new T.Vector3());
    const back = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const fit = fitDistance(bx, c, back);
    let dist = fit.d / zoom;
    const lit = kit ? [] : parts.filter((p) => p.state === "current");
    if (zoom !== 1 && lit.length) {
      const fb = new T.Box3();
      lit.forEach((p) => fb.union(p.wb.clone().translate(apart(p))));
      c.lerp(fb.getCenter(new T.Vector3()), 1 - 0.15 / zoom);
      dist = Math.max(dist, fitDistance(fb, c, back).d); // a zoom never cuts off a part of this step
    }
    c.addScaledVector(fit.up, -LIFT * dist * fit.tv); // lift the model clear of the toolbar at the bottom of the viewer
    const pos = back.clone().multiplyScalar(dist).add(c);
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    // the first frame at a real size jumps, and so do resizes and moves without animation; the rest glide
    if (REDUCED.matches || !framed || jump) { camera.position.copy(pos); controls.target.copy(c); framed = sized; wake(); return; }
    animate(850, (t) => { const e = easeIO(t); camera.position.lerpVectors(p0, pos, e); controls.target.lerpVectors(t0, c, e); }, 0, "camera");
  }

  const spin = (on) => { controls.autoRotate = hero && on; onSpin?.(controls.autoRotate); wake(); };
  controls.addEventListener("start", () => { userView = true; finish(); if (controls.autoRotate) spin(false); host.dataset.user = ""; });
  controls.addEventListener("change", () => wake());

  // keyboard orbit on the focused canvas: arrows turn, + and - zoom
  function key(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return false;
    if (e.key === "Escape" && active) { setActive(false); return true; }
    const r = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    const z = e.key === "+" || e.key === "=" ? 0.85 : e.key === "-" || e.key === "_" ? 1 / 0.85 : 0;
    if (!r && !z) return false;
    finish();
    userView = true;
    host.dataset.user = "";
    if (controls.autoRotate) spin(false);
    const sph = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (r) {
      sph.theta += r[0] * 10 * RAD;
      sph.phi = Math.min(controls.maxPolarAngle, Math.max(0.05, sph.phi + r[1] * 7 * RAD));
    }
    if (z) sph.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, sph.radius * z));
    camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(sph));
    camera.lookAt(controls.target);
    controls.update();
    wake();
    return true;
  }

  // touch: a finger scrolls the page (pan-y) until a tap on the view turns on one-finger orbit; a tap outside ends it
  const setActive = (on) => { active = on; host.toggleAttribute("data-active", on); };
  host.addEventListener("pointerdown", (e) => {
    if (R.owner !== api) return;
    const touch = e.pointerType === "touch";
    controls.enabled = !touch || active;
    tap = touch && !active && e.target === canvas ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
  }, true);
  host.addEventListener("pointerup", (e) => {
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10 && e.timeStamp - tap.t < 500) { setActive(true); controls.enabled = true; }
    tap = null;
  }, true);
  document.addEventListener("pointerdown", (e) => { if (active && !host.contains(e.target)) setActive(false); });

  // ---- loop: render only while something moves, and only in the viewer that owns the canvas
  function wake() { need = true; if (!running && onScreen && R.owner === api) { running = true; requestAnimationFrame(tick); } }
  function tick() {
    if (R.owner !== api || !onScreen) { running = false; return; }
    const t = now();
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      if (t < a.t0) continue;
      const k = Math.min(1, (t - a.t0) / a.dur);
      a.fn(k);
      if (k >= 1) anims.splice(i, 1);
    }
    const moved = controls.update();
    if (need || moved || anims.length || controls.autoRotate) { R.r.render(scene, camera); placeTags(); need = false; }
    if (anims.length || moved || controls.autoRotate) requestAnimationFrame(tick);
    else running = false;
  }

  // pins: a ring at each screw head of this step, hidden when a part is in front of it
  const ray = new T.Raycaster(), v3 = new T.Vector3(), q3 = new T.Vector3(), seen = new T.Vector3();
  // true when a visible solid other than `own` is between the camera and point q (raycasting ignores .visible: the
  // list holds only the visible solids)
  function behind(q, solids, own = null) {
    const to = q.clone().sub(camera.position), d = to.length();
    ray.set(camera.position, to.normalize());
    const hit = ray.intersectObjects(solids, false).find((x) => x.object !== own);
    return Boolean(hit && hit.distance < d - 3);
  }
  function placePins(w, h, solids) {
    fast.forEach((f, k) => {
      const el = pins[k];
      el.hidden = !(!hero && !kitPose() && f.step === step && f.visible);
      if (el.hidden) return;
      const head = f.home.clone().addScaledVector(f.dir, -1.5);
      if (f.host) head.add(f.host.offset);
      if (behind(head, solids)) { el.hidden = true; return; }
      v3.copy(head).project(camera);
      el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -50%)`;
    });
  }
  // A tag shows while some of its part can be seen: points of the part in its own frame (the centre of its own top
  // face first, then the centre, near each face, near each corner of a box). inSight gives the index of the first
  // point that is in the view and that no other solid hides (and copies that point to `seen`), or -1 when there is none.
  const FACES = [[0, 0.5, 0], [0, 0, 0], [0, 0, 0.45], [0.45, 0, 0], [-0.45, 0, 0], [0, 0, -0.45], [0, -0.45, 0]];
  const CORNERS = [-0.4, 0.4].flatMap((x) => [-0.4, 0.4].flatMap((y) => [-0.4, 0.4].map((z) => [x, y, z])));
  const inView = (q) => { v3.copy(q).project(camera); return Math.abs(v3.x) <= 1 && Math.abs(v3.y) <= 1 && v3.z <= 1; };
  function inSight(p, solids) {
    const list = p.round ? FACES : [...FACES, ...CORNERS];
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      p.mesh.localToWorld(q3.set(s[0] * p.size[0], s[1] * p.size[1], s[2] * p.size[2]));
      if (inView(q3) && !behind(q3, solids, p.mesh)) { seen.copy(q3); return k; }
    }
    return -1;
  }
  // the area that two tag boxes share
  const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  function placeTags() {
    const w = canvas.clientWidth, h = canvas.clientHeight, kit = kitPose(), placed = [];
    const solids = kit ? [] : [...parts.filter((p) => p.mesh.visible && p.state !== "ghost").map((p) => p.mesh), ...props.filter((pr) => pr.m.visible).map((pr) => pr.m)];
    placePins(w, h, solids);
    tags.forEach((el) => (el.style.visibility = ""));
    // in the order of the parts, so the first parts keep their tags; the kit reads the tag sizes before it moves one
    const shown = parts.filter((p) => tags.has(p.id) && !tags.get(p.id).hidden);
    const dims = kit ? shown.map((p) => [tags.get(p.id).offsetWidth, tags.get(p.id).offsetHeight]) : [];
    shown.forEach((p, n) => {
      const el = tags.get(p.id), k = kit ? 0 : inSight(p, solids);
      if (k < 0) { el.style.visibility = "hidden"; return; }
      // the tag stands on the point that inSight found: the centre top of the part when that can be seen
      if (kit) { p.kit.getWorldPosition(v3); v3.y += p.kitSize[1] / 2; } else v3.copy(seen);
      v3.project(camera);
      if (Math.abs(v3.x) > 1 || Math.abs(v3.y) > 1 || v3.z > 1) { el.style.visibility = "hidden"; return; } // not in the view
      const x = ((v3.x + 1) / 2) * w, y = ((1 - v3.y) / 2) * h;
      if (kit) {
        // the kit shows every part: a tag that covers more than a quarter of its area on a tag before it does not
        // show, so the tags of a pile of small parts do not cover one another
        const [tw, th] = dims[n], box = { l: x - tw / 2, r: x + tw / 2, t: y - 1.3 * th, b: y - 0.3 * th };
        if (placed.some((q) => overlap(q.box, box) > 0.25 * tw * th)) el.style.visibility = "hidden";
        else placed.push({ box });
      } else if (placed.some((q) => q.label === p.label && Math.hypot(q.x - x, q.y - y) < 34)) el.style.visibility = "hidden"; // the same letter twice in one spot reads as one tag
      else placed.push({ label: p.label, x, y });
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`;
    });
  }

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    sized = true;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frame({ jump: true });
    if (R.owner !== api) return;
    // setSize clears the canvas: draw again before the browser paints
    R.r.setSize(w, h, false);
    controls.update();
    R.r.render(scene, camera);
    placeTags();
    wake();
  }
  // take the shared canvas when this viewer comes on screen
  function claim() {
    if (R.owner === api) return;
    if (R.owner) R.owner.release();
    R.owner = api;
    box.appendChild(canvas);
    canvas.setAttribute("aria-label", label);
    controls.enabled = true;
    need = true;
    resize();
  }
  new ResizeObserver(resize).observe(box);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { claim(); wake(); } }).observe(host);
  const retheme = () => {
    readTokens();
    grid.material.color.set(tok.grid);
    for (const pr of props) pr.m.material.color.copy(pr.base).multiplyScalar(tok.prop);
    finish();
    apply({ fly: false });
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // live reduced-motion: finish every move at once and stop the turn
  REDUCED.addEventListener("change", () => { if (!REDUCED.matches) return; finish(); paused = true; spin(false); });

  const clamp = (i) => (Number.isInteger(i) ? Math.max(0, Math.min(data.steps.length - 1, i)) : 0);
  const api = {
    get step() { return step; },
    get spinning() { return controls.autoRotate; },
    go(i, fly = true) { step = clamp(i); finish(); apply({ fly }); },
    replay() { finish(); apply({ fly: true }); },
    explode(on) { explode = on; applyExplode(true); frame(); },
    ghost(on) { ghost = on; finish(); apply({ fly: false }); },
    reset() { userView = false; delete host.dataset.user; frame({ force: true }); },
    spin(on) { paused = !on; spin(on); },
    label(text) { label = String(text); if (R.owner === api) canvas.setAttribute("aria-label", label); },
    release() { controls.enabled = false; setActive(false); },
    key,
    retheme,
  };
  apply({ fly: false });
  spin(hero && !paused);
  host.dataset.ready = "";
  return api;
}
