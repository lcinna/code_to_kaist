class Tree {
  constructor(x, ww, wh) {
    this.x = x;
    this.y = 290;
    this.w = 485;
    this.h = 490;
    this.ww = ww;
    this.wh = wh;

    this.pivotX = this.x;
    this.pivotY = this.wh + 180;

    this.angle = 0;
    this.noiseOffset = random(1000);
    this.noiseT = 0; // 노이즈 시간축 (속도를 바꿔도 튀지 않게 직접 누적)

    // 흔들기 상태
    this.shake = 0; // 0~1, 흔들림 세기
    this.shakeUntil = 0; // 이 시각까지 흔들림 유지
    this.nextShakeDrop = 0; // 다음 우수수 낙하 시각

    this.collisionGroup = -(1 + trees.length);
    this.nextDropTime = millis() + random(10000, 11000);

    this.leaves = [];
    let leafCount = 22;
    let leafPositions = [];
    let minDist = 55;

    for (let i = 0; i < leafCount; i++) {
      let lx, ly;
      let tries = 0;
      let tooClose;

      do {
        lx = this.x + random(-this.w / 2 + 40, this.w / 2 - 40);
        ly = this.y + random(-this.h / 2 + 40, this.h / 2 - 40);
        tooClose = false;
        for (let p of leafPositions) {
          if (dist(lx, ly, p.x, p.y) < minDist) {
            tooClose = true;
            break;
          }
        }
        tries++;
      } while (tooClose && tries < 30);

      leafPositions.push({ x: lx, y: ly });

      push();
      colorMode(HSB, 360, 100, 100);
      let leafColor = color(random(90, 150), random(55, 75), random(95, 100));
      pop();

      let leafAngle0 = radians(random(0, 360));
      let leafBody = Bodies.rectangle(lx, ly, 95, 55, {
        chamfer: { radius: [45, 5, 45, 5] },
        fill: leafColor,
        angle: leafAngle0,
        isStatic: true,
        collisionFilter: { group: this.collisionGroup },
      });
      Composite.add(engine.world, leafBody);

      let leafObj = {
        body: leafBody,
        offsetX: lx - this.pivotX,
        offsetY: ly - this.pivotY,
        angleOffset: leafAngle0,
        fallen: false,
      };
      this.leaves.push(leafObj);
      leafRegistry.push({ tree: this, leaf: leafObj }); // 전역 레지스트리에 등록
    }
  }

  // 화면 밖으로 나간 "떨어진 잎" 삭제
  removeOffscreenLeaves() {
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      let leaf = this.leaves[i];
      if (!leaf.fallen) continue; // 나무에 붙은 잎은 대상 아님

      let p = leaf.body.position;
      if (p.y > CANVAS_H + 60 || p.x < -60 || p.x > CANVAS_W + 60) {
        Composite.remove(engine.world, leaf.body); // 물리 세계에서 제거
        leaf.death = true; // 레지스트리 정리용 표시
        this.leaves.splice(i, 1); // 이 나무의 배열에서 제거
      }
    }
  }

  update() {
    this.removeOffscreenLeaves();

    let shaking = millis() < this.shakeUntil;
    this.shake = lerp(this.shake, shaking ? 1 : 0, shaking ? 0.15 : 0.05);

    // 평소 0.005 → 흔들릴 때 0.06
    this.noiseT += lerp(0.005, 0.06, this.shake);
    let amp = lerp(3, 8, this.shake); // 평소 ±3°, 흔들릴 때 ±8°

    let n = noise(this.noiseOffset + this.noiseT);
    this.angle = map(n, 0, 1, radians(-amp), radians(amp));

    // 흔들리는 동안 잎을 연달아 떨어뜨림
    if (shaking && millis() > this.nextShakeDrop) {
      this.dropRandomLeaf();
      this.nextShakeDrop = millis() + random(60, 160);
    }

    let cosA = cos(this.angle);
    let sinA = sin(this.angle);

    for (let leaf of this.leaves) {
      if (leaf.fallen) continue;
      let rx = leaf.offsetX * cosA - leaf.offsetY * sinA;
      let ry = leaf.offsetX * sinA + leaf.offsetY * cosA;

      Body.setPosition(leaf.body, {
        x: this.pivotX + rx,
        y: this.pivotY + ry,
      });
      Body.setAngle(leaf.body, leaf.angleOffset + this.angle);
    }

    if (millis() > this.nextDropTime) {
      this.dropLowestLeaf();
      this.nextDropTime = millis() + random(10000, 11000);
    }
  }

  // 마우스 x좌표가 이 나무 위에 있는지
  isOver(px) {
    return abs(px - this.x) < this.w / 2;
  }

  // 흔들림 상태를 0.4초 연장 (드래그 중에 계속 호출됨)
  shakeTree() {
    this.shakeUntil = millis() + 400;
  }

  // 흔들기 낙하용: 아직 안 떨어진 잎 중 아무거나 하나
  dropRandomLeaf() {
    let candidates = this.leaves.filter((leaf) => !leaf.fallen);
    if (candidates.length === 0) return;
    this.dropLeaf(random(candidates));
  }

  // 자동 낙하용: 아직 안 떨어진 잎 중 가장 아래쪽을 골라서 dropLeaf 호출
  dropLowestLeaf() {
    let candidates = this.leaves.filter((leaf) => !leaf.fallen);
    if (candidates.length === 0) return;

    let lowest = candidates[0];
    for (let leaf of candidates) {
      if (leaf.body.position.y > lowest.body.position.y) {
        lowest = leaf;
      }
    }
    this.dropLeaf(lowest);
  }

  // 공통 로직: 특정 잎 하나를 "동적 body로 교체"해서 떨어뜨림
  // fast = true 이면 클릭 낙하용으로 더 빠르게
  dropLeaf(leaf, fast = false) {
    if (leaf.fallen) return; // 이미 떨어진 잎이면 무시
    leaf.fallen = true;

    let oldBody = leaf.body;
    let pos = { x: oldBody.position.x, y: oldBody.position.y };
    let ang = oldBody.angle;
    let leafFill = oldBody.fill;
    Composite.remove(engine.world, oldBody);

    let newLeaf = Bodies.rectangle(pos.x, pos.y, 95, 55, {
      chamfer: { radius: [45, 5, 45, 5] },
      fill: leafFill,
      angle: ang,
      isStatic: false,
      frictionAir: fast ? 0.008 : 0.06, // 공기저항이 작을수록 빨리 떨어짐
      collisionFilter: {
        group: this.collisionGroup,
        category: 0x0008, // 떨어진 잎 전용 카테고리 (비는 mask 0x0001만 충돌하므로 통과)
      },
    });
    Composite.add(engine.world, newLeaf);

    Body.setVelocity(newLeaf, {
      x: random(-0.5, 0.5),
      y: fast ? 6 : 0, // 아래로 초기 속도를 줌
    });
    Body.setAngularVelocity(newLeaf, random(-0.07, 0.07));

    leaf.body = newLeaf; // leaves 배열(및 leafRegistry가 참조하는 객체)의 body 교체
    leaf.flutter = !fast; // 클릭 낙하가 아닐 때만 살랑거림
    leaf.fluttPhase = random(TWO_PI); // 잎마다 시작 위상을 다르게
    leaf.fluttSpeed = random(0.025, 0.04); // 클수록 빨리 좌우로 흔들림
  }

  display() {
    push();
    translate(this.pivotX, this.pivotY);
    rotate(this.angle);
    translate(-this.pivotX, -this.pivotY);

    rectMode(CENTER);
    noStroke();

    fill("#98ff92");
    rect(this.x, this.y, this.w, this.h, 163);

    fill("#ffa694");
    rect(this.x, this.wh, 74, 360);

    pop();

    for (let leaf of this.leaves) {
      let b = leaf.body;
      fill(b.fill);
      noStroke();
      beginShape();
      for (let v of b.vertices) vertex(v.x, v.y);
      endShape(CLOSE);
    }

    // 떨어지는 잎을 좌우로 살랑거리게
    for (let leaf of this.leaves) {
      if (!leaf.fallen || !leaf.flutter) continue;
      let b = leaf.body;
      if (b.velocity.y < 0.1) continue; // 바닥에 쌓인 잎은 제외

      leaf.fluttPhase += leaf.fluttSpeed;

      // 좌우로 미는 힘 (질량에 비례해야 잎 크기와 무관하게 일정)
      Body.applyForce(b, b.position, {
        x: sin(leaf.fluttPhase) * b.mass * 0.0003,
        y: 0,
      });

      // 흔들리는 방향에 맞춰 잎도 살짝 기울어지게
      let targetSpin = cos(leaf.fluttPhase) * 0.04;
      Body.setAngularVelocity(b, lerp(b.angularVelocity, targetSpin, 0.05));
    }
  }
}
