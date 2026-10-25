const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;
const Body = Matter.Body;

const LIFE = 30000; // 클릭하지 않으면 이 시간(ms) 뒤에 완전히 사라짐
const MAX_BUBBLES = 40; // 쉐이더가 한 번에 그릴 수 있는 최대 개수
const WRAP_CHARS = 12; // 공백 제외 이 글자 수를 넘으면 낱말 단위로 줄바꿈
const LINE_H = 24; // 줄 간격(px)
const CLICK_MOVE = 6; // 이 거리(px)보다 적게 움직이면 '클릭'으로 봄
const CLICK_PUSH = 10; // 클릭했을 때 아래로 밀리는 속도 (클수록 멀리 내려감)
const UP_DRAG = 40; // 이 거리(px) 이상 위로 드래그하면 삭제
const DIE_MS = 1500; // 삭제될 때 회색 + 투명해지는 데 걸리는 시간(ms)

let engine;
let canvas;
let input;
let mouseConstraint;
let blocks = [];
let typing = false; // 입력창에 글자가 한 글자라도 있는지
let lastTime = Date.now(); // 이전 프레임 시각

let pg; // 쉐이더로 버블을 그리는 WEBGL 레이어
let bubbleShader;

// ---------------------------------------------------------------- shader
const vert = `
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
void main() {
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

const frag = `
#ifdef GL_ES
precision highp float;
#endif
#define MAX ${MAX_BUBBLES}

uniform vec2 u_res;        // 캔버스 크기 (css px)
uniform float u_density;   // pixelDensity
uniform float u_count;     // 버블 개수
uniform vec4 u_a[MAX];     // x, y, 반지름, 투명도(0~1)
uniform vec4 u_c[MAX];     // 색조, 채도, 명도 (모두 0~1)

vec3 hsb2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  // 화면 좌표 (왼쪽 위가 0,0 / Matter 좌표와 같게)
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_density - gl_FragCoord.y) / u_density;
  vec3 col = vec3(1.0); // 흰 배경

  for (int i = 0; i < MAX; i++) {
    if (float(i) >= u_count) break;
    vec4 a = u_a[i];
    vec4 c = u_c[i];
    float r = a.z;
    float d = length(p - a.xy);

    if (d < r + 1.0) {
      float cov = 1.0 - smoothstep(r - 1.0, r + 1.0, d); // 가장자리 부드럽게

      // 그라데이션: 중심은 넓게 흰색, 가장자리 근처에서만 파랗게
      vec3 base = hsb2rgb(vec3(c.x, c.y, c.z));
      vec3 deep = hsb2rgb(vec3(c.x + 0.02, min(c.y * 1.15, 1.0), c.z * 0.9));
      vec2 hp = a.xy + vec2(-0.05, -0.05) * r; // 하이라이트를 살짝만 왼쪽 위로
      float g = clamp(length(p - hp) / (r * 1.1), 0.0, 1.0);
      vec3 bc = mix(vec3(1.0), base, smoothstep(0.55, 0.97, g)); // 55%까지는 순백
      bc = mix(bc, deep, smoothstep(0.93, 1.0, g));              // 맨 가장자리만 살짝 진하게

      col = mix(col, bc, cov * a.w);
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------- setup
function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 255); // 색조, 채도, 명도, 투명도
  textAlign(CENTER, CENTER);
  textSize(18);

  // 쉐이더 레이어 (글자는 2D 캔버스에서 그려서 한글 폰트 파일 없이도 됨)
  pg = createGraphics(windowWidth, windowHeight, WEBGL);
  pg.noStroke();
  bubbleShader = pg.createShader(vert, frag);

  //Matter setting
  engine = Engine.create();
  engine.gravity.y = -1; // 위로 떠오르는 중력
  engine.gravity.scale = 0.0001; // 클수록 빨리 올라감

  //Walls (위쪽 벽은 없음 -> 화면 밖으로 나갈 수 있게)
  let margin = 20;
  Composite.add(engine.world, [
    Bodies.rectangle(width / 2, height - margin, width, margin, {
      isStatic: true,
    }),
    Bodies.rectangle(margin, height / 2, margin, height, {
      isStatic: true,
    }),
    Bodies.rectangle(width - margin, height / 2, margin, height, {
      isStatic: true,
    }),
  ]);

  //Mouse
  let mouse = Mouse.create(canvas.elt);
  mouse.pixelRatio = pixelDensity();
  mouseConstraint = MouseConstraint.create(engine, { mouse: mouse });
  Composite.add(engine.world, mouseConstraint);

  //메모를 잡는 순간 -> 시간 리셋 + 시작 위치 기억
  Matter.Events.on(mouseConstraint, "startdrag", (e) => {
    let b = e.body.block;
    if (!b) return;
    b.touch();
    b.grabStart = { x: e.mouse.position.x, y: e.mouse.position.y };
  });

  //놓는 순간 -> 위로 드래그했으면 삭제, 거의 안 움직였으면 클릭(아래로 밀기)
  Matter.Events.on(mouseConstraint, "enddrag", (e) => {
    let b = e.body.block;
    if (!b || !b.grabStart || b.dying) return;
    let dx = e.mouse.position.x - b.grabStart.x;
    let dy = e.mouse.position.y - b.grabStart.y;
    b.grabStart = null;

    if (dy < -UP_DRAG) {
      b.startDying(); // 위로 드래그 -> 회색 + 투명해지며 삭제
    } else if (sqrt(dx * dx + dy * dy) < CLICK_MOVE) {
      b.touch();
      Body.setVelocity(b.body, { x: 0, y: CLICK_PUSH }); // 클릭 -> 아래로 내려감
    }
  });

  //text input
  input = createInput("");
  input.position(20, 20);
  input.size(200, 20);
  input.attribute("placeholder", "메모를 입력하세요.");
  input.changed(createBlock);

  //저장된 메모 불러오기 (닫혀 있던 시간도 흐른 걸로 계산)
  let saved = getItem("fadingMemo");
  if (saved !== null) {
    for (let s of saved) {
      if (blocks.length >= MAX_BUBBLES) break;
      if (Date.now() - s.touched < LIFE) {
        // 색 정보가 없는 예전 데이터는 undefined -> 기본값(랜덤)이 적용됨
        blocks.push(new Block(s.txt, s.x, s.y, s.touched, s.hue, s.sat, s.bri));
      }
    }
  }
}

function createBlock() {
  let txt = input.value();
  if (txt === "") return;
  if (blocks.length >= MAX_BUBBLES) return;
  blocks.push(new Block(txt, random(100, width - 100), height - 100));
  input.value("");
  saveMemos();
}

function saveMemos() {
  let data = blocks
    .filter((b) => !b.dying)
    .map((b) => ({
      txt: b.txt,
      x: b.body.position.x,
      y: b.body.position.y,
      touched: b.touched,
      hue: b.hue,
      sat: b.sat,
      bri: b.bri,
    }));
  storeItem("fadingMemo", data);
}

// ---------------------------------------------------------------- draw
function drawBubbles() {
  // 버블 정보를 쉐이더에 넘길 배열로 정리 (vec4 x MAX_BUBBLES)
  let a = new Array(MAX_BUBBLES * 4).fill(0);
  let c = new Array(MAX_BUBBLES * 4).fill(0);

  for (let i = 0; i < blocks.length; i++) {
    let b = blocks[i];
    let look = b.getLook();
    a[i * 4] = b.body.position.x;
    a[i * 4 + 1] = b.body.position.y;
    a[i * 4 + 2] = b.r;
    a[i * 4 + 3] = look.a / 255;
    c[i * 4] = b.hue / 360;
    c[i * 4 + 1] = look.s / 100;
    c[i * 4 + 2] = look.b / 100;
  }

  pg.clear();
  pg.shader(bubbleShader);
  bubbleShader.setUniform("u_res", [width, height]);
  bubbleShader.setUniform("u_density", pg.pixelDensity());
  bubbleShader.setUniform("u_count", blocks.length);
  bubbleShader.setUniform("u_a", a);
  bubbleShader.setUniform("u_c", c);
  pg.rect(-pg.width / 2, -pg.height / 2, pg.width, pg.height);

  image(pg, 0, 0, width, height);
}

function draw() {
  // 지난 프레임 이후 흐른 시간
  let now = Date.now();
  let dt = now - lastTime;
  lastTime = now;

  // 입력창에 한 글자라도 있으면 멈춤 (포커스만으로는 멈추지 않음)
  typing = input.value().length > 0;

  // 입력 중에는 중력도, 시간도 멈춤
  engine.gravity.y = typing ? 0 : -1;
  if (typing) {
    for (let b of blocks) {
      b.touched = min(b.touched + dt, now);
    }
  }

  Engine.update(engine);

  //잡고 있는 동안에는 계속 살려둠
  if (mouseConstraint.body && mouseConstraint.body.block) {
    mouseConstraint.body.block.touch();
  }

  drawBubbles(); // 배경 + 버블 (쉐이더)

  for (let b of blocks) {
    b.displayText(); // 글자는 그 위에
  }

  //사라진 메모 삭제 (뒤에서부터)
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].isDead()) {
      blocks[i].remove();
      blocks.splice(i, 1);
    }
  }

  if (frameCount % 30 === 0) saveMemos();
}

// ---------------------------------------------------------------- text wrap
// 공백 제외 WRAP_CHARS글자가 넘으면 낱말 단위로 줄을 나눔
function wrapText(txt) {
  let count = (s) => s.replace(/\s/g, "").length;
  if (count(txt) <= WRAP_CHARS) return [txt];

  let words = txt.trim().split(/\s+/);
  let lines = [];
  let line = "";
  for (let w of words) {
    if (line === "") {
      line = w; // 한 낱말이 12글자를 넘어도 쪼개지 않고 한 줄로 둠
    } else if (count(line) + count(w) <= WRAP_CHARS) {
      line += " " + w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

// ---------------------------------------------------------------- Block
class Block {
  constructor(
    txt,
    x,
    y,
    touched = Date.now(),
    hue = random(195, 215), // 하늘색~밝은 파랑
    sat = random(60, 75), // 채도는 높게 유지
    bri = 100, // 명도 최대 -> 연하고 밝게
  ) {
    this.txt = txt;
    this.touched = touched; // 마지막으로 클릭한 시각
    this.hue = hue;
    this.sat = sat;
    this.bri = bri;
    this.lines = wrapText(this.txt);
    // 줄바꿈된 글자 덩어리(가장 긴 줄 x 전체 높이)가 들어가는 반지름
    let w = max(this.lines.map((l) => textWidth(l)));
    let h = this.lines.length * LINE_H;
    this.r = max(sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2)) + 20, 40);
    this.body = Bodies.circle(x, y, this.r, { frictionAir: 0.05 });
    this.body.block = this; // body에서 Block을 찾을 수 있게
    Composite.add(engine.world, this.body);
  }

  touch() {
    if (this.dying) return; // 삭제 중에는 되살릴 수 없음
    this.touched = Date.now();
  }

  startDying() {
    // 지금 상태에서 시작해 DIE_MS 동안 회색 + 투명해지며 사라짐
    this.dieFrom = this.getProgress();
    this.dieStart = Date.now();
    this.dying = true;
    this.body.collisionFilter.mask = 0; // 더 이상 부딪히거나 잡히지 않음
  }

  getProgress() {
    // 0(방금 클릭) -> 1(완전히 사라짐)
    if (this.dying) {
      let t = constrain((Date.now() - this.dieStart) / DIE_MS, 0, 1);
      return lerp(this.dieFrom, 1, t);
    }
    return constrain((Date.now() - this.touched) / LIFE, 0, 1);
  }

  getLook() {
    let p = this.getProgress();
    // 앞 50% 동안 채도가 빠지며 회색으로 (명도도 살짝 내려가 회색이 보이게)
    let s = map(p, 0, 0.5, this.sat, 0, true);
    let b = map(p, 0, 0.5, this.bri, 70, true);
    // 회색이 되기 시작하는 순간부터 계속 조금씩 투명해짐 (글자도 같은 값 사용)
    let a = map(p, 0, 1, 255, 0, true);
    return { s: s, b: b, a: a };
  }

  isDead() {
    return this.getProgress() >= 1 || this.body.position.y < -this.r;
  }

  remove() {
    Composite.remove(engine.world, this.body);
  }

  displayText() {
    let pos = this.body.position;
    fill(0, this.getLook().a);
    let n = this.lines.length;
    for (let i = 0; i < n; i++) {
      // 전체 줄이 원의 세로 중앙에 오도록 배치
      text(this.lines[i], pos.x, pos.y + (i - (n - 1) / 2) * LINE_H);
    }
  }
}
