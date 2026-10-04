const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;
const Query = Matter.Query;
const Events = Matter.Events;

let trees = [];
let leafRegistry = []; // 모든 나무의 잎 정보를 모아두는 전역 배열 (클릭 판별용)

let engine;

let raindrops = []; // 비 (물리 body)
let rainUntil = 0; // 이 시각까지 비가 내림
let pendingDrops = []; // 비에 맞아서 떨어질 잎 대기열

function setup() {
  createCanvas(1700, 600);
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
    wall(width / 2, height + 190, width, margin),
    wall(width / 2, margin, width, margin),
    wall(margin, height / 2, margin, height),
    wall(width - margin, height / 2, margin, height),
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

  let gap = width / 4 + 140;
  trees.push(new Tree(width / 2 - gap, 1700, 600));
  trees.push(new Tree(width / 2, 1700, 600));
  trees.push(new Tree(width / 2 + gap, 1700, 600));
}

function draw() {
  Engine.update(engine);

  // 엔진 계산이 끝난 뒤에 잎을 교체 (계산 도중 body를 지우면 문제가 생길 수 있음)
  for (let entry of pendingDrops) entry.tree.dropLeaf(entry.leaf);
  pendingDrops = [];

  background(27, 12, 225);

  for (let tr of trees) {
    tr.update();
    tr.display();
  }

  for (let tr of trees) {
    tr.update();
    tr.display();
  }
  leafRegistry = leafRegistry.filter((e) => !e.leaf.death);

  updateRain();
  drawRain();
  //
  print(Composite.allBodies(engine.world).length);
}

function mousePressed() {
  // 아직 안 떨어진 잎들의 body만 모아서 검사
  let candidates = leafRegistry.filter((entry) => !entry.leaf.fallen);
  let bodies = candidates.map((entry) => entry.leaf.body);

  let hits = Query.point(bodies, { x: mouseX, y: mouseY });
  if (hits.length > 0) {
    let clickedBody = hits[0];
    let entry = candidates.find((e) => e.leaf.body === clickedBody);
    if (entry) {
      entry.tree.dropLeaf(entry.leaf, true); // 클릭 낙하는 빠르게
    }
  }
}

function mouseDragged() {
  let dx = mouseX - pmouseX;
  let dy = mouseY - pmouseY;

  if (abs(dx) > 3 && abs(dx) > abs(dy)) {
    // 가로 드래그: 나무 흔들기
    for (let tr of trees) {
      if (tr.isOver(mouseX)) tr.shakeTree();
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
    this.body = Bodies.rectangle(random(width), -this.len, 5, this.len, {
      label: "rain",

      friction: 0,
      frictionAir: 0,
      restitution: 0,
      collisionFilter: { category: 0x0002, mask: 0x0001 },
    });
    Body.setInertia(this.body, Infinity);
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
    if (p.y > height + this.len || p.x < -20 || p.x > width + 20) {
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
