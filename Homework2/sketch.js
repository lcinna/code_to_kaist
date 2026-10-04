const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;
const Query = Matter.Query;
const Events = Matter.Events;

const CANVAS_W = 1700; // 내부 해상도 (물리/그리기 좌표 기준)
const CANVAS_H = 600;
const SCALE = 0.8; // 실제 캔버스 크기와 그림 전체에 곱하는 배율 (창 크기와 무관)

let cnv;

let trees = [];
let leafRegistry = []; // 모든 나무의 잎 정보를 모아두는 전역 배열 (클릭 판별용)

let engine;

let raindrops = []; // 비 (물리 body)
let rainUntil = 0; // 이 시각까지 비가 내림
let pendingDrops = []; // 비에 맞아서 떨어질 잎 대기열

function setup() {
  // 캔버스 자체를 SCALE배 크기로 만들고, draw()에서 그림 전체를 SCALE배로 그림
  // (물리/그리기 좌표는 CANVAS_W x CANVAS_H 기준 그대로)
  cnv = createCanvas(CANVAS_W * SCALE, CANVAS_H * SCALE);
  cnv.style("display", "block");

  rectMode(CENTER);
  engine = Engine.create();
  engine.gravity.scale = 0.0006;

  let margin = 20;
  // category 0x0004: 비(mask 0x0001)가 벽을 통과하게 함
  let wall = (x, y, w, h) =>
    Bodies.rectangle(x, y, w, h, {
      isStatic: true,
      collisionFilter: { category: 0x0004 },
    });
  Composite.add(engine.world, [
    wall(CANVAS_W / 2, CANVAS_H + 190, CANVAS_W, margin),
    wall(CANVAS_W / 2, margin, CANVAS_W, margin),
    wall(margin, CANVAS_H / 2, margin, CANVAS_H),
    wall(CANVAS_W - margin, CANVAS_H / 2, margin, CANVAS_H),
  ]);

  // 비가 아직 안 떨어진 잎에 닿으면 대기열에 넣음
  Events.on(engine, "collisionStart", (event) => {
    for (let pair of event.pairs) {
      let a = pair.bodyA;
      let b = pair.bodyB;
      let other = a.label === "rain" ? b : b.label === "rain" ? a : null;
      if (!other) continue;
      let entry = leafRegistry.find(
        (e) => e.leaf.body === other && !e.leaf.fallen,
      );
      if (entry) pendingDrops.push(entry);
    }
  });

  let gap = CANVAS_W / 4 + 140;
  trees.push(new Tree(CANVAS_W / 2 - gap, 1700, 600));
  trees.push(new Tree(CANVAS_W / 2, 1700, 600));
  trees.push(new Tree(CANVAS_W / 2 + gap, 1700, 600));
}

function draw() {
  Engine.update(engine);

  // 엔진 계산이 끝난 뒤에 잎을 교체 (계산 도중 body를 지우면 문제가 생길 수 있음)
  for (let entry of pendingDrops) entry.tree.dropLeaf(entry.leaf);
  pendingDrops = [];

  background(27, 12, 225);

  push();
  scale(SCALE); // 이 아래의 모든 그림이 SCALE배로 줄어듦
  for (let tr of trees) {
    tr.update();
    tr.display();
  }
  // 삭제된 잎을 전역 레지스트리에서도 제거
  leafRegistry = leafRegistry.filter((e) => !e.leaf.death);

  updateRain();
  drawRain();
  pop();
}

// 마우스/터치 좌표를 물리·그리기 좌표(CANVAS_W x CANVAS_H 기준)로 환산
function worldMouse() {
  return {
    x: mouseX / SCALE,
    y: mouseY / SCALE,
    px: pmouseX / SCALE,
    py: pmouseY / SCALE,
  };
}

function mousePressed() {
  // 아직 안 떨어진 잎들의 body만 모아서 검사
  let candidates = leafRegistry.filter((entry) => !entry.leaf.fallen);
  let bodies = candidates.map((entry) => entry.leaf.body);

  let m = worldMouse();
  let hits = Query.point(bodies, { x: m.x, y: m.y });
  if (hits.length > 0) {
    let clickedBody = hits[0];
    let entry = candidates.find((e) => e.leaf.body === clickedBody);
    if (entry) {
      entry.tree.dropLeaf(entry.leaf, true); // 클릭 낙하는 빠르게
    }
  }
}

function mouseDragged() {
  let m = worldMouse();
  let dx = m.x - m.px;
  let dy = m.y - m.py;

  if (abs(dx) > 3 && abs(dx) > abs(dy)) {
    // 가로 드래그: 나무 흔들기
    for (let tr of trees) {
      if (tr.isOver(m.x)) tr.shakeTree();
    }
  } else if (abs(dy) > 3 && abs(dy) > abs(dx)) {
    // 세로 드래그: 비 내리기
    rainUntil = millis() + 600; // 세로 드래그가 이어지는 동안 연장됨
  }
}

class Raindrop {
  constructor() {
    this.len = random(60, 80);
    this.death = false;
    this.body = Bodies.rectangle(random(CANVAS_W), -this.len, 5, this.len, {
      label: "rain",
      friction: 0,
      frictionAir: 0,
      restitution: 0,
      // 아직 나무에 붙은 잎(category 1)하고만 충돌, 비끼리/벽/떨어진 잎은 무시
      collisionFilter: { category: 0x0002, mask: 0x0001 },
    });
    Body.setInertia(this.body, Infinity); // 회전하지 않고 곧게 떨어지게
    Body.setVelocity(this.body, { x: 0, y: random(8, 12) });
    Composite.add(engine.world, this.body);
  }

  display() {
    beginShape();
    for (let v of this.body.vertices) vertex(v.x, v.y);
    endShape(CLOSE);
  }

  // 위쪽(y < 0)은 생성 위치라서 검사하지 않음
  checkDeath() {
    let p = this.body.position;
    if (p.y > CANVAS_H + this.len || p.x < -20 || p.x > CANVAS_W + 20) {
      this.death = true;
      Composite.remove(engine.world, this.body);
    }
  }
}

function updateRain() {
  if (millis() < rainUntil && random() < 0.2) raindrops.push(new Raindrop());

  for (let d of raindrops) d.checkDeath();
  raindrops = raindrops.filter((d) => !d.death);
}

function drawRain() {
  noStroke();
  fill(255, 255, 255, 180);
  for (let d of raindrops) d.display();
}
