const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;

//저장된 메모들: done을 누를 때마다 하나씩 쌓이고, 로컬 스토리지("memoWeb")에 저장됨
let memos = [];

//가상의 격자 (화면에 그리지 않고, 심볼이 들어갈 칸의 위치만 계산): 15칸 = 5열 x 3행
let gridCols = 5;
let gridRows = 3;
let gridSide = 20; //왼쪽, 오른쪽 여백
let gridTop = 98; //위쪽 여백 (시안에서 잰 값, 닫힌 작은 사각형 아래로 40)
let gridBottom = 40; //아래쪽 여백
let cellPad = 10; //칸 안쪽 여백 (심볼이 칸 가장자리에 붙지 않게)

//심볼 크게 보기: 심볼을 누르면 화면 가운데의 이 크기(화면에 대한 비율)로 커짐
let focusWRatio = 0.7; //가로 (화면 너비의 70%)
let focusHRatio = 0.735; //세로 (화면 높이의 73.5%)
let focusXGap = 14; //크게 보이는 자리의 오른쪽 모서리에서 X자까지 거리
let focusIdx = -1; //크게 보는 메모 번호 (memos 배열 안의 번호), -1이면 없음
let focusAmt = 0; //0: 칸 안, 1: 크게 보이는 자리 (lerp로 조금씩 움직임)
let focusOpen = false; //true: 커지는 중/커진 상태, false: 작아지는 중/원위치

//메모 사각형: 처음 크기/위치 (화면 크기와 상관없이 항상 동일)
let startMargin = 22; //위, 왼쪽에서 떨어진 거리
let startW = 75;
let startH = 36;
//커졌을 때 화면 상하좌우에 남길 여백
let openMargin = 22;
//X자 (커진 사각형의 왼쪽 위 모서리 기준)
//X자 여백(왼쪽, 위쪽 똑같음)은 getXArea()에서 검은 사각형 윗선에 맞춰 계산
let xSize = 28; //X자 한 변의 길이

let memo; //사각형 정보 (중심 기준 x, y, w, h)
let opened = false; //true: 커지는 중/커진 상태, false: 작아지는 중/작은 상태
let showX = false; //X자와 조절 바를 보여줄지 (다 커졌을 때만 true)
let screen = 1; //커진 뒤 보이는 화면 (1: 그리기 화면, 2: title/symbol 화면, 3: 저장된 메모 보기 화면)
let viewIdx = -1; //보기 화면(3)에서 보고 있는 메모 번호 (memos 배열 안의 번호), -1이면 없음
let infoClosing = false; //소개 창(제목 바를 눌러 여는 화면 4)이 제목 바로 작아지며 닫히는 중인지
let viewClosing = false; //보기 창이 아래로 내려가며 닫히는 중인지

//수정 모드: 보기 창(3)에서 edit을 누르면 저장된 메모의 그림/제목/심볼을 다시 고칠 수 있음
let editIdx = -1; //수정 중인 메모 번호 (memos 배열 안의 번호), -1이면 수정 중 아님
let editInfo = null; //수정 시작 때 기록: 그림/심볼을 얼마나 줄여서 불러왔는지(scaleD, scaleS), 원래 선 개수, 원래 기준 크기
let editStash = null; //수정하는 동안 잠시 치워 두는, 새 메모 작성 중이던 내용 (수정이 끝나면 되돌려 놓음)

//보기 화면(3) 아래쪽 줄: 왼쪽부터 제목 상자, 날짜 상자, (오른쪽 끝) edit 버튼
let viewTitleWRatio = 0.4; //제목 상자 너비 (커진 사각형 너비에 대한 비율)
let sortMargin = 22; //홈 화면 정렬 버튼(date, random)이 화면 오른쪽에서 떨어진 거리
let viewGap = 12; //제목 상자와 날짜 상자 사이 간격

//펜
let penSize = 10; //지금 펜 지름
let penMin = 1; //제일 얇을 때 지름
let penMax = 20; //제일 두꺼울 때 지름
let strokes = []; //그린 선들 (선 하나 = {size: 지름, col: 색, pts: 점들의 배열})
let currentStroke = null; //지금 긋고 있는 선
let drawing = false; //사각형 안에서 누른 채 그리는 중인지
let tool = "pen"; //지금 도구 ("pen": 펜, "eraser": 지우개)

//펜 두께 조절 바 (커진 사각형의 오른쪽 위 모서리 기준)
let sliderMarginRight = 77; //사각형 오른쪽 모서리에서 바 오른쪽 끝까지 거리
let sliderMarginTop = 31; //사각형 위쪽 모서리에서 바 중심까지 거리
let sliderW = 95; //바 길이
let sliderGap = 6; //바를 이루는 두 선 사이 간격
let knobSize = 16; //원 지름
let knobT = (penSize - penMin) / (penMax - penMin); //원 위치 0(왼쪽 끝)~1(오른쪽 끝)
let draggingKnob = false; //펜 원을 잡고 있는지

//검은 사각형 (커진 사각형의 오른쪽 위 모서리 기준)
let blackMarginRight = 19; //사각형 오른쪽 모서리에서 검은 사각형 오른쪽 끝까지 거리
let blackMarginTop = 31; //사각형 위쪽 모서리에서 검은 사각형 중심까지 거리
let blackW = 32;
let blackH = 30;

//지우개 크기 조절 바 (펜 조절 바 바로 아래 줄)
let eraserSize = 20; //지금 지우개 지름
let eraserMin = 1; //제일 작을 때 지름
let eraserMax = 50; //제일 클 때 지름
let eraserT = (eraserSize - eraserMin) / (eraserMax - eraserMin); //원 위치 0~1
let draggingEraser = false; //지우개 원을 잡고 있는지
let rowGap = 41; //펜 줄과 지우개 줄 사이 간격 (중심 기준)
let eraserCircleSize = 34; //지우개 줄 오른쪽 원 지름

//글자 (시안의 글꼴은 세리프)
//글꼴: 편산 베타 A (한글, 영문 모두). 글꼴 파일(PyeonsanBetaA.otf)을 sketch.js와 같은 폴더에 두면 불러옴
//글꼴을 아직 못 불렀거나 파일이 없으면 브라우저 기본 글꼴로 보임 (불러오면 자동으로 바뀜)
const UI_FONT_NAME = "PyeonsanBetaA";
let uiFont = UI_FONT_NAME; //(p5는 글꼴 이름을 통째로 한 이름으로 보므로 대체 글꼴을 쉼표로 이어 쓰지 않음)
try {
  new FontFace(UI_FONT_NAME, "url(PyeonsanBetaA.otf)")
    .load()
    .then((f) => document.fonts.add(f))
    .catch((e) =>
      print(
        "글꼴을 불러오지 못했음 (PyeonsanBetaA.otf가 sketch.js와 같은 폴더에 있는지 확인)",
        e,
      ),
    );
} catch (e) {
  print("글꼴을 불러오지 못했음", e);
}
let uiTextSize = 16;

//버튼/이름표 상자 (next, done, title, symbol 공통 크기)
let btnW = 64;
let btnH = 28;

//두 번째 화면 배치 (커진 사각형의 왼쪽 위 모서리 기준)
let formLeft = 20; //title, symbol 이름표의 왼쪽 여백
let formTop = 83; //title 줄의 위쪽 여백
let formGap = 36; //title 줄과 symbol 줄 사이 간격
let fieldLeft = 120; //입력 칸의 왼쪽 여백
let fieldWRatio = 0.58; //입력 칸 너비 (커진 사각형 너비에 대한 비율)
let fieldBottom = 64; //큰 입력 칸의 아래쪽 여백
let fieldPad = 13; //입력 칸 안쪽 글자의 왼쪽 여백

//두 번째 화면의 입력
let titleInput; //오른쪽 위 박스(제목 칸)에 겹쳐 놓는 텍스트 입력창
let symbolSize = 26; //오른쪽 아래 큰 박스에서 그리는 펜 지름 (검은색)
let symbolEraserSize = 40; //큰 박스에서 쓰는 지우개 지름
let symbolTool = "pen"; //큰 박스의 지금 도구 ("pen": 펜, "eraser": 지우개)
let symbolToolGap = 20; //큰 박스 오른쪽 모서리에서 도구 버튼까지 거리
let symbolStrokes = []; //큰 박스에 그린 선들 (선 하나 = {size, col, pts})
let symbolCurrent = null; //지금 긋고 있는 선
let symbolDrawing = false; //큰 박스 안에서 누른 채 그리는 중인지

//브라우저 창 크기가 바뀌면 캔버스도 같이 바꿈 (메모 창, 격자 칸, 심볼, 그림이 모두 이 크기에 맞춰 다시 배치됨)
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  lastResizeMs = millis();
}

//메모를 만들 때의 창 크기에 비해 지금 창이 얼마나 커졌거나 작아졌는지 (1이면 만들 때와 같음)
//저장된 큰 그림은 만들 때의 창 크기(w, h)를 같이 저장해 두었으니, 지금 창에 꽉 맞게 비율을 유지한 채 이 비율로 보여줌
//점 크기도 이 비율만큼 같이 커지거나 작아짐
function getMemoScale(m) {
  let d = m.drawing;
  if (d === undefined || d === null || !(d.w > 0) || !(d.h > 0)) return 1;
  return Math.min(
    (width - openMargin * 2) / d.w,
    (height - openMargin * 2) / d.h,
  );
}

//예시 메모: samples.json (html, sketch.js와 같은 폴더)에 들어 있고, 방문자가 처음 열었을 때 한 번만 저장 메모에 들어감
//각 예시는 "ageHours"만큼 시간이 지난 상태로 시작하고, 일반 메모와 똑같이 시간이 지나면서/파도에 깎임
//m.sampleIdx가 있는 메모가 예시 메모. 100% 다 지워지면 데이터에서 지워지는 대신 처음 상태(ageHours 지난 상태)로 다시 생성됨
//방문자가 직접 삭제(세 손가락)하면 그대로 지워지고, "memoWebSeeded"에 기록해 두어서 다시 나타나지 않음
let sampleData = null;
//p5 버전에 따라 preload가 안 불리기도 해서, preload 대신 fetch로 읽고 다 읽으면 그때 예시 메모를 넣음
function loadSamples() {
  fetch("samples.json")
    .then((r) => r.json())
    .then((d) => {
      sampleData = d;
      seedSamples();
    })
    .catch((e) => {
      sampleData = null; //파일이 없거나 못 읽어도 그냥 넘어감
      print("samples.json 못 읽음", e);
    });
}

//예시 메모 내용(그림, 심볼)을 처음 상태로 새로 복사해서 m에 채움. 시간은 지금부터 ageHours 전으로
function fillSample(m, idx) {
  let s = sampleData.memos[idx];
  let t = Date.now() - (s.ageHours > 0 ? s.ageHours : 0) * 3600 * 1000;
  m.time = t;
  m.created = t;
  m.title = s.title;
  m.drawing = JSON.parse(JSON.stringify(s.drawing));
  m.symbol = JSON.parse(JSON.stringify(s.symbol));
  m.sampleIdx = idx;
}

function seedSamples() {
  try {
    if (getItem("memoWebSeeded") !== null) return;
    if (sampleData === null || !Array.isArray(sampleData.memos)) return;
    let used = new Set();
    for (let m of memos)
      if (pageOf(m) === 0 && typeof m.cell === "number") used.add(m.cell);
    for (let k = 0; k < sampleData.memos.length; k++) {
      let c = sampleData.memos[k].cell;
      if (used.has(c)) {
        //원래 칸이 이미 차 있으면 첫 페이지의 빈 칸 중 가장 앞쪽 칸
        c = -1;
        for (let i = 0; i < 15; i++) {
          if (!used.has(i)) {
            c = i;
            break;
          }
        }
        if (c === -1) continue; //빈 칸이 없으면 넣지 않음
      }
      used.add(c);
      let m = { cell: c, page: 0 };
      fillSample(m, k);
      memos.push(m);
    }
    storeItem("memoWeb", memos);
    storeItem("memoWebSeeded", 1);
  } catch (e) {
    print("예시 메모 저장 실패", e);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  //세 손가락으로 쓸 때 브라우저가 화면을 스크롤하거나 확대하지 않게 함
  drawingContext.canvas.style.touchAction = "none";
  //손가락 여러 개로 쓸 때 브라우저가 새로고침(당겨서 새로고침)이나 뒤로 가기 같은 동작을 하지 않게 페이지 전체를 막음
  document.documentElement.style.touchAction = "none";
  document.documentElement.style.overscrollBehavior = "none";
  document.body.style.touchAction = "none";
  document.body.style.overscrollBehavior = "none";
  document.body.style.overflow = "hidden";
  rectMode(CENTER);
  //Matter setting
  engine = Engine.create();

  //저장된 메모 불러오기 (예전 연습 코드의 "myMemo"와 섞이지 않게 다른 이름 사용)
  let saved = getItem("memoWeb");
  if (saved !== null) {
    memos = saved;
  }
  loadSamples(); //예시 메모 파일 읽기 (처음 온 방문자에게는 다 읽은 뒤 예시 메모가 들어감)
  //페이지 수 불러오기 (메모가 있는 가장 큰 페이지 번호보다는 항상 크거나 같게)
  let pc = getItem("memoWebPages");
  if (typeof pc === "number" && pc >= 1) pageCount = Math.floor(pc);
  for (let m of memos) pageCount = Math.max(pageCount, pageOf(m) + 1);
  //다 사라진 메모가 있으면 지움
  deleteExpiredMemos();

  //창을 처음 열었을 때(새로고침 포함) 파도가 위에서 아래로 한 번 지나감
  waveStartNow();

  //처음 사각형: 왼쪽 위 (rectMode가 CENTER라서 중심 좌표로 계산)
  memo = {
    x: startMargin + startW / 2,
    y: startMargin + startH / 2,
    w: startW,
    h: startH,
  };

  //제목 입력창: 오른쪽 위 박스에 겹쳐서 보여줌 (한글도 입력되도록 HTML 입력창 사용)
  titleInput = createInput("");
  titleInput.style("border", "none");
  titleInput.style("outline", "none");
  titleInput.style("background", "transparent");
  titleInput.style("font-family", uiFont + ", serif");
  titleInput.style("font-size", uiTextSize + "px");
  titleInput.style("padding", "0 " + fieldPad + "px");
  titleInput.style("box-sizing", "border-box");
  titleInput.style("user-select", "text");
  titleInput.style("-webkit-user-select", "text");
  titleInput.hide();
}

function draw() {
  Engine.update(engine);
  background(255);
  drawBgDots(); //배경에 깔린 모래 점 (가장 아래층)

  regenBudget = 2; //이번 프레임에 크기 때문에 다시 만들 수 있는 그림판 수

  //다 사라진 메모 지우기 (0.5초마다 한 번만 확인)
  if (frameCount % 30 === 0) deleteExpiredMemos();

  //심볼 크게 보기: 누른 심볼이 칸에서 화면 가운데 큰 자리로 lerp로 커지고, 닫을 때는 다시 칸으로 작아짐
  focusAmt = lerp(focusAmt, focusOpen === true ? 1 : 0, 0.1);
  if (focusOpen === false && focusAmt < 0.005) {
    //칸으로 다 돌아왔으면 크게 보기 끝 (숨겨뒀던 다른 심볼이 다시 보임)
    focusAmt = 0;
    if (focusIdx !== -1) releaseBigSand(memos[focusIdx].symbol);
    focusIdx = -1;
  }

  //심볼 크게 보기가 끝나거나 닫히기 시작하면 복구 연출은 바로 정리
  if (restoreFx !== null && (focusIdx !== restoreFx.idx || focusOpen === false))
    clearRestoreFx();

  //격자 칸에 들어간 심볼 그리기 (칸은 보이지 않고 심볼만 보임, 창 사각형이 위를 덮음)
  //페이지를 넘기는 중에는 새 페이지가 옆에서 밀려 들어오고, 이전 페이지는 반대쪽으로 밀려 나감
  //(손가락으로 끄는 동안은 손가락을 따라가고, 놓으면 넘어가거나 제자리로 돌아옴)
  if (pageDrag === null || pageDrag.active !== true)
    pageSlide = Math.abs(pageSlide) < 0.5 ? 0 : lerp(pageSlide, 0, 0.16);
  updateMoveOff();
  for (let pass = 0; pass < 2; pass++) {
    let pg = curPage;
    let dx = pageSlide;
    if (pass === 1) {
      if (pageSlide === 0 || slideFrom < 0) break;
      pg = slideFrom;
      dx = pageSlide - slideDir * width;
    }
    push();
    translate(dx, 0);
    for (let i = 0; i < memos.length; i++) {
      let m = memos[i];
      if (typeof m.cell !== "number") continue;
      if (pageOf(m) !== pg) continue;
      if (homeHold === true) continue; //메모를 지운 직후에는 홈 화면의 심볼이 아직 안 보임
      //하나를 크게 보는 동안 다른 심볼은 안 보임
      if (focusIdx !== -1 && i !== focusIdx) continue;
      let tr = getCellFit(m.symbol, getCell(m.cell), cellPad);
      //정렬해서 칸이 바뀐 직후에는 이전 자리에서 새 자리로 부드럽게 이동 (크게 보는 중에는 해당 없음)
      let mo = moveOff.get(m);
      if (mo !== undefined && i !== focusIdx)
        tr = { sc: tr.sc, ox: tr.ox + mo.dx, oy: tr.oy + mo.dy };
      let step = getFadeStep(m); //이 메모의 점이 지금까지 몇 번 사라졌는지
      let ds = getMemoScale(m); //만들 때 창 크기에 비한 지금 창 크기 (점 크기에 곱함)
      if (i === focusIdx && focusAmt > 0) {
        //칸에서의 배치 -> 크게 볼 때의 배치 사이를 focusAmt(0~1)만큼 섞어서 위치/크기를 정함
        //칸 크기 그림판과 큰 그림판은 알갱이 모양이 서로 달라서, 움직이는 동안 둘을 겹쳐서 서서히 바꿈
        let big = getFocusFit(m.symbol);
        let cellSc = tr.sc;
        tr = {
          sc: lerp(tr.sc, big.sc, focusAmt),
          ox: lerp(tr.ox, big.ox, focusAmt),
          oy: lerp(tr.oy, big.oy, focusAmt),
        };
        if (focusAmt < 0.995) {
          drawSymbol(
            m.symbol,
            tr,
            cellSc,
            "cell",
            255 * (1 - focusAmt),
            step,
            ds,
          );
          drawSymbol(m.symbol, tr, big.sc, "big", 255 * focusAmt, step, ds);
        } else if (restoreFx !== null && restoreFx.idx === i) {
          //전체 복구 연출: 복구 직전 모습을 그대로 깔고, 복구된 모습을 서서히 진하게 겹침
          let p = Math.min(1, (millis() - restoreFx.t0) / restoreMs);
          let eased = p * p * (3 - 2 * p); //처음과 끝은 천천히
          if (p < 1) {
            drawRestoreFx(m.symbol, tr, 255 * eased);
          } else {
            clearRestoreFx();
            drawSymbol(m.symbol, tr, big.sc, "big", 255, step, ds);
          }
        } else {
          drawSymbol(m.symbol, tr, big.sc, "big", 255, step, ds);
        }
      } else {
        drawSymbol(m.symbol, tr, tr.sc, "cell", 255 * homeAlpha, step, ds);
      }
    }
    pop();
  }

  //크게 보는 심볼 옆 X자 (다 커졌을 때만, 닫기 시작하면 바로 사라짐)
  if (focusIdx !== -1 && focusOpen === true && focusAmt > 0.98) {
    let fx = getFocusXArea();
    stroke(0);
    strokeWeight(1);
    line(fx.l, fx.t, fx.r, fx.b);
    line(fx.r, fx.t, fx.l, fx.b);
  }

  //목표 위치/크기
  //목표는 매 프레임 현재 화면 크기로 계산 >> 화면 크기에 맞게 자동 조정
  let tx, ty, tw, th;
  if (viewClosing === true) {
    //보기 창 닫는 중: 크기는 그대로, 화면 아래 바깥으로 내려감
    tx = width / 2;
    tw = width - openMargin * 2;
    th = height - openMargin * 2;
    ty = height + th / 2 + 20;
  } else if (opened === true) {
    tx = width / 2;
    ty = height / 2;
    tw = width - openMargin * 2;
    th = height - openMargin * 2;
  } else if (infoClosing === true) {
    //소개 창 닫는 중: 열렸던 제목 바 자리로 작아짐
    let ta = getTitleBarArea();
    tx = ta.l + ta.w / 2;
    ty = ta.t + ta.h / 2;
    tw = ta.w;
    th = ta.h;
  } else {
    tx = startMargin + startW / 2;
    ty = startMargin + startH / 2;
    tw = startW;
    th = startH;
  }

  //lerp(현재값, 목표값, 비율): 비율만큼씩 목표에 가까워짐 (열 때도, 닫을 때도 사용)
  memo.x = lerp(memo.x, tx, 0.1);
  memo.y = lerp(memo.y, ty, 0.1);
  memo.w = lerp(memo.w, tw, 0.1);
  memo.h = lerp(memo.h, th, 0.1);
  //보기 창이 화면 아래로 완전히 내려갔으면 정리하고, 처음의 작은 사각형을 왼쪽 위에 다시 놓음
  if (viewClosing === true && memo.y - memo.h / 2 >= height) {
    viewClosing = false;
    screen = 1;
    //보기 창에서 쓰던 점 그림판은 메모리 아끼려고 지움
    if (memos[viewIdx] !== undefined && memos[viewIdx].drawing !== undefined) {
      releaseSand(memos[viewIdx].drawing);
    }
    viewIdx = -1;
    memo.x = startMargin + startW / 2;
    memo.y = startMargin + startH / 2;
    memo.w = startW;
    memo.h = startH;
  }

  //소개 창이 제목 바 크기까지 작아졌으면 정리하고, 처음의 작은 사각형(memo 버튼)을 왼쪽 위에 다시 놓음
  if (
    infoClosing === true &&
    abs(memo.w - tw) < 2 &&
    abs(memo.h - th) < 2 &&
    abs(memo.x - tx) < 2
  ) {
    infoClosing = false;
    screen = 1;
    memo.x = startMargin + startW / 2;
    memo.y = startMargin + startH / 2;
    memo.w = startW;
    memo.h = startH;
  }

  //메모를 지운 뒤: 알갱이가 다 사라지면 1초 기다렸다가 홈 화면의 심볼들이 다시 나타남
  if (homeHold === true && scatter === null) {
    if (homeHoldAt === 0) homeHoldAt = millis() + HOME_HOLD_MS;
    else if (millis() >= homeHoldAt) {
      homeHold = false;
      homeHoldAt = 0;
      homeFadeStart = millis();
    }
  }
  //서서히 나타나는 중이면 투명도(0~1)를 계산 (처음과 끝은 천천히)
  homeAlpha = 1;
  if (homeFadeStart >= 0) {
    let p = (millis() - homeFadeStart) / HOME_FADE_MS;
    if (p >= 1) homeFadeStart = -1;
    else homeAlpha = p * p * (3 - 2 * p);
  }

  //세 손가락 쓸기 확인 + 흩어지는 알갱이 그리기
  updateSwipe();
  drawScatter();

  //파도에 휩쓸릴 알갱이(아직 제자리인 것 + 휩쓸려 떠내려가는 것)
  drawWashDots();

  //파도: 심볼 위, 아래의 memo 사각형(흰색으로 채워짐) 뒤에 그려짐
  drawWave();

  //사각형
  fill(255);
  stroke(0);
  strokeWeight(1);
  rect(memo.x, memo.y, memo.w, memo.h);

  //작은 사각형(메모 만드는 창 여는 버튼)에 memo 글자: next, edit 같은 버튼과 같은 서식
  //클릭해서 커지기 시작하면 바로 지워지고, 닫혀서 다시 작아진 뒤에 다시 나타남
  if (
    opened === false &&
    viewClosing === false &&
    abs(memo.w - startW) < 2 &&
    abs(memo.h - startH) < 2
  ) {
    fill(0);
    noStroke();
    textFont(uiFont);
    textSize(uiTextSize);
    textAlign(CENTER, CENTER);
    text("memo", memo.x, memo.y);

    //홈 화면 오른쪽 위의 정렬 버튼 (date, random): 파도와 배경 점 위에, 안은 흰색으로 그림
    let sa = getSortAreas();
    drawBox(
      sa.random.l,
      sa.random.t,
      sa.random.r - sa.random.l,
      sa.random.b - sa.random.t,
      "random",
      true,
      "random",
    );
    drawBox(
      sa.date.l,
      sa.date.t,
      sa.date.r - sa.date.l,
      sa.date.b - sa.date.t,
      "date",
      true,
      "date",
    );

    //위쪽 가운데 제목 바
    drawTitleBar();

    //오른쪽 아래 + 원 버튼과 아래 가운데 페이지 표시
    drawPageButtons();
  }

  //그림: 열려 있고 첫 번째 화면일 때만 보이고, 사각형 밖으로 나간 부분은 가려짐(clip)
  if (opened === true && screen === 1) {
    push();
    drawingContext.beginPath();
    drawingContext.rect(
      memo.x - memo.w / 2,
      memo.y - memo.h / 2,
      memo.w,
      memo.h,
    );
    drawingContext.clip();
    noFill();
    strokeCap(ROUND);
    strokeJoin(ROUND);
    for (let s of strokes) {
      //선마다 그릴 때의 두께와 색을 따로 저장해 둠 (지우개 = 흰색 선)
      stroke(s.col);
      strokeWeight(s.size);
      if (s.pts.length === 1) {
        //점 하나만 찍은 경우
        point(s.pts[0].x, s.pts[0].y);
      } else {
        beginShape();
        for (let p of s.pts) {
          vertex(p.x, p.y);
        }
        endShape();
      }
    }
    pop();
    //지우개(흰색 선)가 테두리를 덮었을 수 있어서 테두리를 다시 그림
    noFill();
    stroke(0);
    strokeWeight(1);
    rect(memo.x, memo.y, memo.w, memo.h);
  }

  //보기 화면: 저장된 큰 그림(drawing)을 그렸던 크기 그대로, 심볼과 같은 점(모래) 표현으로 보여줌 (창 왼쪽 위 기준, 창 밖은 가려짐)
  if (
    (opened === true || viewClosing === true) &&
    screen === 3 &&
    viewIdx !== -1
  ) {
    let vm = memos[viewIdx];
    if (
      vm !== undefined &&
      vm.drawing !== undefined &&
      vm.drawing.strokes.length > 0
    ) {
      drawSandDrawing(
        vm.drawing,
        memo.x - memo.w / 2,
        memo.y - memo.h / 2,
        getFadeStep(vm),
        getMemoScale(vm),
      );
    }
  }

  //다 커졌을 때만 X자와 화면 내용 보이기 (닫기 시작하면 바로 사라짐)
  //(크기뿐 아니라 위치도 다 도착했을 때: 아래에서 올라오는 창이 도착하기 전에 보이지 않게)
  showX =
    opened === true &&
    abs(memo.w - tw) < 2 &&
    abs(memo.h - th) < 2 &&
    abs(memo.x - tx) < 2 &&
    abs(memo.y - ty) < 2;
  if (showX === true) {
    //X자 (두 화면 공통)
    let a = getXArea();
    line(a.l, a.t, a.r, a.b);
    line(a.r, a.t, a.l, a.b);
    if (screen === 1) {
      drawScreen1();
    } else if (screen === 2) {
      drawScreen2();
    } else if (screen === 4) {
      drawScreen4();
    } else {
      drawScreen3();
    }
  }

  //제목 입력창은 두 번째 화면이 다 커졌을 때만 보임 (박스 위치/크기에 맞춤)
  if (showX === true && screen === 2) {
    let f = getForm();
    titleInput.position(f.fx, f.row1);
    titleInput.size(f.fw, btnH);
    titleInput.show();
  } else {
    titleInput.hide();
  }
}

//첫 번째 화면: 펜/지우개 조절 바, 검은 사각형, 흰 원, next 버튼
function drawScreen1() {
  //펜 조절 바
  drawSlider(getSlider(sliderMarginTop, knobT));
  //검은 사각형 (누르면 펜)
  let btn = getButtons();
  fill(0);
  rect(btn.bx, btn.by, blackW, blackH);
  //지우개 조절 바 (펜 조절 바 아래)
  drawSlider(getSlider(sliderMarginTop + rowGap, eraserT));
  //지우개 줄 오른쪽 원 (검은 사각형과 가운데 맞춤, 누르면 지우개)
  fill(255);
  circle(btn.ex, btn.ey, eraserCircleSize);
  //next 버튼 (오른쪽 아래)
  let n = getNextArea();
  drawBox(n.l, n.t, btnW, btnH, "next", true, "next");
  //수정 중이면 next 왼쪽에 done 버튼 (간격은 제목 상자와 날짜 상자 사이 간격과 같음)
  if (editIdx !== -1) {
    let d = getEditDoneArea();
    drawBox(d.l, d.t, btnW, btnH, "done", true, "editdone");
  }
}

//두 번째 화면: title, symbol 입력 칸, done 버튼
function drawScreen2() {
  let f = getForm();
  //첫 줄: title 이름표 + 제목 입력 칸
  drawBox(f.labelX, f.row1, btnW, btnH, "title", true);
  drawBox(f.fx, f.row1, f.fw, btnH, "", false);
  //둘째 줄: symbol 이름표 + 큰 입력 칸
  drawBox(f.labelX, f.row2, btnW, btnH, "cover", true);
  drawBox(f.fx, f.row2, f.fw, f.bigH, "", false);
  //큰 박스: 그린 선 (박스 밖으로 나간 부분은 가려짐(clip))
  push();
  drawingContext.beginPath();
  drawingContext.rect(f.fx, f.row2, f.fw, f.bigH);
  drawingContext.clip();
  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  for (let st of symbolStrokes) {
    //선마다 그릴 때의 두께와 색을 따로 저장해 둠 (지우개 = 흰색 선)
    stroke(st.col);
    strokeWeight(st.size);
    if (st.pts.length === 1) {
      //점 하나만 찍은 경우
      point(st.pts[0].x, st.pts[0].y);
    } else {
      beginShape();
      for (let p of st.pts) {
        vertex(p.x, p.y);
      }
      endShape();
    }
  }
  pop();
  //굵은 선이 테두리를 덮을 수 있어서 테두리를 다시 그림
  noFill();
  stroke(0);
  strokeWeight(1);
  rect(f.fx + f.fw / 2, f.row2 + f.bigH / 2, f.fw, f.bigH);
  //큰 박스 옆 도구: 검은 사각형(누르면 펜), 흰 원(누르면 지우개)
  let tl = getSymbolTools();
  fill(0);
  rect(tl.bx, tl.by, blackW, blackH);
  fill(255);
  circle(tl.ex, tl.ey, eraserCircleSize);
  //done 버튼 (next 버튼과 같은 자리)
  let n = getNextArea();
  drawBox(n.l, n.t, btnW, btnH, "done", true, "done");
}

//세 번째 화면(보기): 아래쪽 줄에 제목 상자, 날짜 상자, edit 버튼
function drawScreen3() {
  let m = memos[viewIdx];
  if (m === undefined) return;
  let v = getView(m);
  //제목 상자 (글자가 상자보다 길면 상자 밖은 가려짐)
  drawBox(v.titleL, v.t, v.titleW, btnH, "", false);
  push();
  drawingContext.beginPath();
  drawingContext.rect(v.titleL, v.t, v.titleW, btnH);
  drawingContext.clip();
  fill(0);
  noStroke();
  textFont(uiFont);
  textSize(uiTextSize);
  textAlign(LEFT, CENTER);
  text(v.title, v.titleL + fieldPad, v.t + btnH / 2);
  pop();
  //날짜 상자 (연도/월/일)
  drawBox(v.dateL, v.t, v.dateW, btnH, v.date, true);
  //edit 버튼 (next 버튼과 같은 자리)
  let n = getNextArea();
  drawBox(n.l, n.t, btnW, btnH, "edit", true, "edit");
}

//보기 화면 아래쪽 줄의 위치/내용: 제목 상자는 왼쪽(오른쪽 여백과 같은 값), 날짜 상자는 그 오른쪽
//날짜 글자가 상자보다 길면 날짜 상자 너비를 늘림
function getView(m) {
  let n = getNextArea();
  let d = new Date(dateOf(m));
  let date =
    String(d.getFullYear() % 100).padStart(2, "0") + //연도는 뒤 두 자리만 (2026 -> 26)
    "/" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(d.getDate()).padStart(2, "0");
  textFont(uiFont);
  textSize(uiTextSize);
  let titleL = memo.x - memo.w / 2 + blackMarginRight;
  let titleW = memo.w * viewTitleWRatio;
  return {
    t: n.t,
    titleL: titleL,
    titleW: titleW,
    title: typeof m.title === "string" ? m.title : "",
    dateL: titleL + titleW + viewGap,
    dateW: Math.max(btnW, textWidth(date) + fieldPad * 2),
    date: date,
  };
}

//저장된 큰 그림을 원래 크기(1:1) 그대로, 심볼과 똑같은 점(모래) 방식으로 그리기
//(l, t: 그림 영역 왼쪽 위가 놓일 화면 좌표) 창 사각형 밖으로 나간 부분은 가려짐
//s: 만들 때 창에 비한 지금 창 비율 (그림과 점 크기가 이 비율로 줄거나 늘어남)
function drawSandDrawing(d, l, t, step, s) {
  push();
  drawingContext.beginPath();
  drawingContext.rect(memo.x - memo.w / 2, memo.y - memo.h / 2, memo.w, memo.h);
  drawingContext.clip();
  drawSymbol(d, { sc: s, ox: l, oy: t }, s, "view", 255, step, s);
  pop();
}

//글자가 들어간 흰 상자 그리기 (l, t: 왼쪽 위 모서리)
//centered가 true면 글자를 가운데에, false면 왼쪽 안쪽 여백을 두고 맨 위 줄 높이에
function drawBox(l, t, w, h, txt, centered, id) {
  //버튼(id가 있는 상자)은 누르고 있는 동안 검은 바탕에 흰 글씨 (테두리는 그대로)
  let down = id !== undefined && isBtnDown(id);
  fill(down ? 0 : 255);
  stroke(0);
  strokeWeight(1);
  rect(l + w / 2, t + h / 2, w, h);
  if (txt === "") return; //글자가 없으면 상자만
  fill(down ? 255 : 0);
  noStroke();
  textFont(uiFont);
  textSize(uiTextSize);
  if (centered === true) {
    textAlign(CENTER, CENTER);
    text(txt, l + w / 2, t + h / 2);
  } else {
    textAlign(LEFT, CENTER);
    text(txt, l + fieldPad, t + btnH / 2);
  }
}

//조절 바 그리기: 두 줄 + 흰 원
function drawSlider(s) {
  line(s.left, s.cy - sliderGap / 2, s.right, s.cy - sliderGap / 2);
  line(s.left, s.cy + sliderGap / 2, s.right, s.cy + sliderGap / 2);
  fill(255);
  circle(s.kx, s.cy, knobSize);
}

//X자 영역: X의 끝을 다 이었을 때 생기는 사각형
function getXArea() {
  //X자 여백: 왼쪽 = 위쪽
  //위쪽 값은 X자 윗선이 검은 사각형 윗선과 같아지는 값
  let m = blackMarginTop - blackH / 2;
  let l = memo.x - memo.w / 2 + m;
  let t = memo.y - memo.h / 2 + m;
  return { l: l, t: t, r: l + xSize, b: t + xSize };
}

//도구 버튼 위치: 검은 사각형(펜), 흰 원(지우개) 중심 좌표
function getButtons() {
  let cx = memo.x + memo.w / 2 - blackMarginRight - blackW / 2;
  return {
    bx: cx,
    by: memo.y - memo.h / 2 + blackMarginTop,
    ex: cx,
    ey: memo.y - memo.h / 2 + sliderMarginTop + rowGap,
  };
}

//next / done 버튼 영역: 오른쪽 아래
//오른쪽 여백 = 검은 사각형의 오른쪽 여백, 아래쪽 여백 = 검은 사각형의 위쪽 여백
function getNextArea() {
  let r = memo.x + memo.w / 2 - blackMarginRight;
  let b = memo.y + memo.h / 2 - (blackMarginTop - blackH / 2);
  return { l: r - btnW, t: b - btnH, r: r, b: b };
}

//두 번째 화면 배치 (모두 커진 사각형 기준, 화면 크기에 따라 입력 칸 크기가 달라짐)
function getForm() {
  let left = memo.x - memo.w / 2;
  let top = memo.y - memo.h / 2;
  let bottom = memo.y + memo.h / 2;
  let row2 = top + formTop + btnH + formGap; //둘째 줄 위쪽
  return {
    labelX: left + formLeft,
    row1: top + formTop,
    row2: row2,
    fx: left + fieldLeft,
    fw: memo.w * fieldWRatio,
    bigH: bottom - fieldBottom - row2,
  };
}

//새 선 만들기: 펜이면 검은 선(펜 두께), 지우개면 흰 선(지우개 크기)
function newStroke(pts) {
  let st = {
    size: tool === "pen" ? penSize : eraserSize,
    col: tool === "pen" ? 0 : 255,
    pts: pts,
  };
  strokes.push(st);
  return st;
}

//조절 바 위치 정보 (marginTop: 사각형 위쪽 모서리에서 바 중심까지, t: 원 위치 0~1)
function getSlider(marginTop, t) {
  let right = memo.x + memo.w / 2 - sliderMarginRight;
  let left = right - sliderW;
  let cy = memo.y - memo.h / 2 + marginTop;
  //원이 바 안에서만 움직이도록, 원 중심이 움직일 수 있는 범위
  let minX = left + knobSize / 2;
  let maxX = right - knobSize / 2;
  let kx = lerp(minX, maxX, t);
  return {
    left: left,
    right: right,
    cy: cy,
    minX: minX,
    maxX: maxX,
    kx: kx,
  };
}

//마우스가 사각형 영역(왼, 위, 오른, 아래) 안에 있는지
function isInside(l, t, r, b) {
  return mouseX > l && mouseX < r && mouseY > t && mouseY < b;
}

//홈 화면 오른쪽 위 정렬 버튼 영역: 맨 오른쪽이 date, 그 왼쪽이 random
//높이는 memo 버튼과 같고, date는 memo 버튼과 같은 크기, random은 글자가 더 길어서 조금 더 김
//간격은 done과 next 사이 간격(viewGap)과 같고, 위쪽은 memo 버튼과 같은 높이(startMargin), 오른쪽은 sortMargin만큼 떨어짐
function getSortAreas() {
  textFont(uiFont);
  textSize(uiTextSize);
  let randomW = Math.max(startW + 20, textWidth("random") + fieldPad * 2);
  let t = startMargin; //위쪽 위치는 memo 버튼과 똑같이 맞춤
  let b = startMargin + startH;
  let dateR = width - sortMargin;
  let dateL = dateR - startW;
  let randomR = dateL - viewGap;
  let randomL = randomR - randomW;
  return {
    date: { l: dateL, t: t, r: dateR, b: b },
    random: { l: randomL, t: t, r: randomR, b: b },
  };
}

// ───────────────── 페이지 ─────────────────
// 홈 화면은 여러 페이지로 나뉘고, 페이지마다 15칸 격자가 따로 있음. 메모는 만들 때 머무르고 있던 페이지(m.page)에 생김
// 오른쪽 아래 + 원을 누르면 빈 페이지가 하나 늘어나고, 아래 가운데 정사각형(페이지 개수만큼, 머무는 페이지는 검정)을 누르거나
// 홈 화면을 좌우로 드래그하면 페이지가 넘어감. 페이지 개수는 로컬 스토리지("memoWebPages")에 저장됨
let curPage = 0; //지금 머무르는 페이지 번호 (0부터)
let pageCount = 1; //전체 페이지 수
let pageSlide = 0; //페이지가 밀려 들어오는 중일 때 새 페이지의 가로 위치 (0이면 멈춤)
let slideFrom = 0; //밀려 나가는 이전 페이지 번호
let slideDir = 1; //1: 새 페이지가 오른쪽에서 들어옴, -1: 왼쪽에서 들어옴
let removeAsk = false; //- 버튼을 한 번 눌러서 remove? 를 보여주는 중인지
let pageDrag = null; //홈 화면 좌우 드래그 정보 { sx, sy, focusedByPress, active, lx, lt, vx }
const PAGE_BTN_D = 40; //+ 원 지름
const PAGE_MARGIN = 22; //+ 원이 화면 아래쪽에서 떨어진 거리 (페이지 정사각형도 아래쪽은 같음)
const PAGE_MARGIN_R = 22; //+ 원이 화면 오른쪽에서 떨어진 거리
const PAGE_MINUS_GAP = 12; //- 원과 + 원 사이 간격
const PAGE_SQ = 14; //페이지 정사각형 한 변
const PAGE_SQ_GAP = 10; //정사각형 사이 간격
const PAGE_DRAG_START = 12; //이만큼 이상 가로로 움직이면 페이지 끌기가 시작됨 (px)
const PAGE_DRAG_RATIO = 0.2; //화면 너비의 이 비율 이상 끌고 놓으면 다음 페이지로 넘어감 (아니면 제자리로 돌아옴)
const PAGE_FLICK_SPEED = 0.6; //이 속도(px/ms) 이상으로 빠르게 쓸고 놓으면 조금만 끌어도 넘어감
const PAGE_EDGE_RESIST = 0.3; //첫/마지막 페이지에서 더 끌 때 손가락보다 덜 움직이는 정도

function pageOf(m) {
  return typeof m.page === "number" ? m.page : 0;
}

//+ 원 버튼과 페이지 정사각형들의 영역
function getPageAreas() {
  let r = PAGE_BTN_D / 2;
  let plus = {
    x: width - PAGE_MARGIN_R - r,
    y: height - PAGE_MARGIN - r,
    r: r,
  };
  let minus = { x: plus.x, y: plus.y - PAGE_BTN_D - PAGE_MINUS_GAP, r: r };
  let total = pageCount * PAGE_SQ + (pageCount - 1) * PAGE_SQ_GAP;
  let left = width / 2 - total / 2;
  let squares = [];
  for (let i = 0; i < pageCount; i++) {
    let l = left + i * (PAGE_SQ + PAGE_SQ_GAP);
    squares.push({
      l: l,
      t: height - PAGE_MARGIN - PAGE_SQ,
      r: l + PAGE_SQ,
      b: height - PAGE_MARGIN,
    });
  }
  return { plus: plus, minus: minus, squares: squares };
}

//지금 마우스 아래의 페이지 버튼 이름 ("plus", "pg0", "pg1"...), 없으면 null
function pageBtnAtMouse() {
  let pa = getPageAreas();
  if (dist(mouseX, mouseY, pa.plus.x, pa.plus.y) <= pa.plus.r) return "plus";
  if (dist(mouseX, mouseY, pa.minus.x, pa.minus.y) <= pa.minus.r)
    return "minus";
  for (let i = 0; i < pa.squares.length; i++) {
    let q = pa.squares[i];
    //작은 정사각형이라 누르기 쉽게 사방 6px 더 넓게 받음
    if (isInside(q.l - 6, q.t - 6, q.r + 6, q.b + 6)) return "pg" + i;
  }
  return null;
}

//오른쪽 아래 + 원과 아래 가운데 페이지 정사각형 그리기
function drawPageButtons() {
  let pa = getPageAreas();
  stroke(0);
  strokeWeight(1);
  //누르고 있는 동안은 검은 바탕에 흰 십자 (테두리는 그대로)
  let down = isBtnDown("plus");
  fill(down ? 0 : 255);
  circle(pa.plus.x, pa.plus.y, PAGE_BTN_D);
  let h = PAGE_BTN_D * 0.3; //십자 선의 반 길이
  if (down) stroke(255);
  line(pa.plus.x - h, pa.plus.y, pa.plus.x + h, pa.plus.y);
  line(pa.plus.x, pa.plus.y - h, pa.plus.x, pa.plus.y + h);
  stroke(0);
  //그 위의 - 원 버튼 (머무는 페이지 삭제, + 와 같은 모양에 가로선만)
  let downM = isBtnDown("minus");
  fill(downM ? 0 : 255);
  circle(pa.minus.x, pa.minus.y, PAGE_BTN_D);
  if (downM) stroke(255);
  line(pa.minus.x - h, pa.minus.y, pa.minus.x + h, pa.minus.y);
  stroke(0);
  //내용이 있는 페이지에서 - 를 한 번 눌렀으면 위에 remove? 가 나옴 (한 번 더 누르면 삭제)
  if (removeAsk === true) {
    textFont(uiFont);
    textSize(uiTextSize);
    let tw = textWidth("remove?") + 8;
    noStroke();
    fill(255);
    rect(pa.minus.x, pa.minus.y - pa.minus.r - 16, tw, uiTextSize + 6);
    fill(0);
    textAlign(CENTER, CENTER);
    text("remove?", pa.minus.x, pa.minus.y - pa.minus.r - 16);
    stroke(0);
  }
  for (let i = 0; i < pa.squares.length; i++) {
    let q = pa.squares[i];
    fill(i === curPage ? 0 : 255);
    rect((q.l + q.r) / 2, (q.t + q.b) / 2, PAGE_SQ, PAGE_SQ);
  }
}

//다른 페이지로 이동 (심볼을 크게 보는 중이거나 창이 열려 있으면 이동하지 않음)
function changePage(n, startX) {
  if (n < 0 || n >= pageCount || n === curPage) return;
  if (focusIdx !== -1 || opened === true || viewClosing === true) return;
  removeAsk = false;
  slideFrom = curPage;
  slideDir = n > curPage ? 1 : -1;
  curPage = n;
  pageSlide = startX !== undefined ? startX : slideDir * width; //손가락으로 끌던 중이면 끌던 위치에서 이어서 넘어감
  //아직 휩쓸리기를 기다리던 이전 페이지의 알갱이는 치움 (이미 떠내려가는 알갱이는 계속 떨어짐)
  washDots = washDots.filter(
    (d) => d.body !== null || (d.m !== undefined && pageOf(d.m) === curPage),
  );
}

//빈 페이지 하나를 맨 뒤에 만들고 그 페이지로 이동
function addPage() {
  pageCount++;
  try {
    storeItem("memoWebPages", pageCount);
  } catch (e) {
    print("저장 실패", e);
  }
  changePage(pageCount - 1);
}

//끄는 동안 매번: 가로로 충분히 움직이면 끌기 시작, 그 뒤로는 페이지가 손가락을 그대로 따라감
function pageDragMove() {
  let pd = pageDrag;
  if (opened === true || viewClosing === true) {
    pageDrag = null;
    return;
  }
  let dx = mouseX - pd.sx;
  let dy = mouseY - pd.sy;
  if (pd.active !== true) {
    if (Math.abs(dx) < PAGE_DRAG_START || Math.abs(dx) < Math.abs(dy) * 1.5)
      return;
    pd.active = true;
    pd.lx = mouseX;
    pd.lt = millis();
    pd.vx = 0;
    //끌기를 시작한 자리가 칸이라 심볼이 커지기 시작했다면 바로 되돌림
    if (pd.focusedByPress === true && focusIdx !== -1) {
      if (memos[focusIdx] !== undefined) releaseBigSand(memos[focusIdx].symbol);
      focusIdx = -1;
      focusOpen = false;
      focusAmt = 0;
    }
  }
  //손가락 속도 (놓을 때 빠르게 쓸었는지 알기 위해)
  let now = millis();
  if (now > pd.lt) {
    pd.vx = pd.vx * 0.6 + ((mouseX - pd.lx) / (now - pd.lt)) * 0.4;
    pd.lx = mouseX;
    pd.lt = now;
  }
  //다음(왼쪽으로 끌 때)/이전(오른쪽으로 끌 때) 페이지가 옆에서 같이 딸려 옴. 없는 쪽이면 손가락보다 덜 움직임
  let nb = dx < 0 ? curPage + 1 : curPage - 1;
  slideDir = dx < 0 ? -1 : 1;
  if (nb >= 0 && nb < pageCount) {
    slideFrom = nb;
    pageSlide = dx;
  } else {
    slideFrom = -1;
    pageSlide = dx * PAGE_EDGE_RESIST;
  }
}

//- 버튼: 머무는 페이지에 메모가 있으면 첫 번째 누름은 remove? 만 보여주고, 한 번 더 누르면 삭제. 빈 페이지는 바로 삭제
function pressMinus() {
  if (pageCount <= 1) return; //페이지가 하나뿐이면 지울 수 없음
  let hasContent = memos.some((m) => pageOf(m) === curPage);
  if (hasContent === true && removeAsk === false) {
    removeAsk = true;
    return;
  }
  removeCurrentPage();
}

//머무는 페이지와 그 안의 메모를 삭제하고, 바로 전 페이지로 이동 (첫 페이지를 지우면 다음 페이지가 첫 페이지가 됨)
function removeCurrentPage() {
  removeAsk = false;
  let gone = curPage;
  for (let i = memos.length - 1; i >= 0; i--) {
    let m = memos[i];
    if (pageOf(m) === gone) {
      if (m.symbol !== undefined) releaseSand(m.symbol);
      if (m.drawing !== undefined) releaseSand(m.drawing);
      memos.splice(i, 1);
    } else if (pageOf(m) > gone) {
      m.page = pageOf(m) - 1; //뒤 페이지는 번호가 하나씩 당겨짐
    }
  }
  washDots = washDots.filter(
    (d) => d.m === undefined || memos.indexOf(d.m) !== -1,
  );
  pageCount--;
  try {
    storeItem("memoWebPages", pageCount);
    storeItem("memoWeb", memos);
  } catch (e) {
    print("저장 실패", e);
  }
  //이동: 바로 전 페이지 (없으면 새 첫 페이지). 지워진 페이지는 이미 없으니 새 페이지만 옆에서 밀려 들어옴
  let target = Math.max(gone - 1, 0);
  slideDir = gone > 0 ? -1 : 1;
  slideFrom = -1;
  curPage = target;
  pageSlide = slideDir * width;
}

//홈 화면 페이지 버튼 누르기 (뗄 때 불림): 눌렀으면 true
function pressPageButton() {
  if (focusIdx !== -1 || viewClosing === true) return false;
  let id = pageBtnAtMouse();
  if (id === null) return false;
  if (id === "plus") addPage();
  else if (id === "minus") pressMinus();
  else changePage(parseInt(id.slice(2)));
  return true;
}

//홈 화면 정렬 버튼(date, random) 누르기: 눌렀으면 true
//심볼을 크게 보는 중이거나 memo 창이 움직이는 중에는 버튼이 보이지 않으므로 누를 수 없음
function pressSortButton() {
  if (focusIdx !== -1 || viewClosing === true) return false;
  if (abs(memo.w - startW) >= 2 || abs(memo.h - startH) >= 2) return false;
  let sa = getSortAreas();
  if (isInside(sa.date.l, sa.date.t, sa.date.r, sa.date.b)) {
    sortMemosByDate();
    return true;
  }
  if (isInside(sa.random.l, sa.random.t, sa.random.r, sa.random.b)) {
    sortMemosRandom();
    return true;
  }
  return false;
}

//메모들을 새 칸 번호로 옮김 (order: 옮길 메모 배열, cells: 각 메모가 갈 칸 번호). 저장하고, 파도에 휩쓸릴 차례를 기다리는 알갱이도 같이 옮김
//칸을 옮길 때 심볼이 이전 자리에서 새 자리로 부드럽게 이동하도록 남은 이동 거리를 메모마다 들고 있음 (저장하지 않음)
const moveOff = new Map(); //메모 -> { dx, dy } (새 자리 기준으로 아직 덜 온 거리, 매 프레임 0으로 lerp)
const MOVE_LERP = 0.1; //한 프레임에 남은 거리의 이만큼씩 다가감 (클수록 빨리 도착)

function updateMoveOff() {
  for (let [m, o] of moveOff) {
    o.dx = lerp(o.dx, 0, MOVE_LERP);
    o.dy = lerp(o.dy, 0, MOVE_LERP);
    if (Math.abs(o.dx) < 0.3 && Math.abs(o.dy) < 0.3) moveOff.delete(m);
  }
}

function moveMemosToCells(order, cells) {
  for (let i = 0; i < order.length; i++) {
    let m = order[i];
    let from = getCell(m.cell);
    let to = getCell(cells[i]);
    let dx = to.l - from.l;
    let dy = to.t - from.t;
    //지금 화면에 보이는 위치(이동 중이었다면 그 위치)에서 새 자리까지 이어서 움직임
    let cur = moveOff.get(m);
    if (dx !== 0 || dy !== 0 || cur !== undefined) {
      moveOff.set(m, {
        dx: from.l - to.l + (cur ? cur.dx : 0),
        dy: from.t - to.t + (cur ? cur.dy : 0),
      });
    }
    if (dx !== 0 || dy !== 0) {
      for (let d of washDots) {
        if (d.m === m && d.body === null) {
          d.x += dx;
          d.y += dy;
        }
      }
    }
    m.cell = cells[i];
  }
  saveMemos();
}

//메모의 날짜(보기 창에 보이는 날짜, 날짜순 정렬 기준): 만들 때 정해지고, 복구해도 바뀌지 않으며, 편집해서 고쳤을 때만 그 시각으로 바뀜
//(m.time은 사라지는 시간 계산용이라 복구하면 다시 시작되지만, 날짜는 따로 m.created에 저장됨. 예전에 저장된 메모는 m.time을 날짜로 씀)
function dateOf(m) {
  return typeof m.created === "number" ? m.created : m.time;
}

//날짜순 정렬: 가장 최근에 만든 메모가 왼쪽 위 칸, 오래된 순서대로 가로로 채움
//시, 분, 초(밀리초)까지 따져서 정함 (보기 창에 보이는 날짜와 같은 값인 dateOf(m) 기준)
function sortMemosByDate() {
  let list = memos.filter(
    (m) => typeof m.cell === "number" && pageOf(m) === curPage,
  );
  list.sort((a, b) => dateOf(b) - dateOf(a));
  let cells = [];
  for (let i = 0; i < list.length; i++) cells.push(i);
  moveMemosToCells(list, cells);
}

//랜덤 정렬: 모든 칸 중에서 무작위로 골라 메모를 하나씩 배치 (누를 때마다 새로 섞임)
function sortMemosRandom() {
  let list = memos.filter(
    (m) => typeof m.cell === "number" && pageOf(m) === curPage,
  );
  let all = [];
  for (let i = 0; i < gridCols * gridRows; i++) all.push(i);
  //Fisher-Yates 섞기
  for (let i = all.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let tmp = all[i];
    all[i] = all[j];
    all[j] = tmp;
  }
  moveMemosToCells(list, all.slice(0, list.length));
}

//위쪽 가운데 제목 바: 높이는 memo 버튼과 같고 위쪽 높이도 memo 버튼과 같음. 가로는 화면 너비의 40%이고,
//화면이 좁아서 memo 버튼이나 date/random 버튼과 겹치게 되면 그 사이에 맞게 줄어듦 (양쪽 간격은 viewGap)
const TITLE_BAR_RATIO = 0.4;
const TITLE_TEXT = "NOsTElgia";
function getTitleBarArea() {
  let sa = getSortAreas();
  let half = Math.min(
    width / 2 - (startMargin + startW + viewGap),
    sa.random.l - viewGap - width / 2,
  );
  let w = Math.max(0, Math.min(width * TITLE_BAR_RATIO, half * 2));
  return { l: width / 2 - w / 2, t: startMargin, w: w, h: startH };
}

function drawTitleBar() {
  let a = getTitleBarArea();
  if (a.w <= 0) return;
  fill(255);
  stroke(0);
  strokeWeight(1);
  rect(a.l + a.w / 2, a.t + a.h / 2, a.w, a.h);
  //글자: 굵게/기울임 없이 대소문자만 적은 그대로 가운데에
  noStroke();
  fill(0);
  textFont(uiFont);
  textSize(uiTextSize);
  textStyle(NORMAL);
  textAlign(CENTER, CENTER);
  text(TITLE_TEXT, a.l + a.w / 2, a.t + a.h / 2);
  stroke(0);
}

//제목 바를 누르면: 제목 바 크기에서 시작해 memo 창과 같은 크기까지 lerp로 커지며 소개 화면(화면 4)이 나옴
//(심볼을 크게 보는 중이거나 창/페이지가 움직이는 중에는 열리지 않음)
function pressTitleBar() {
  if (
    focusIdx !== -1 ||
    viewClosing === true ||
    infoClosing === true ||
    pageSlide !== 0
  )
    return false;
  if (abs(memo.w - startW) >= 2 || abs(memo.h - startH) >= 2) return false;
  let a = getTitleBarArea();
  if (a.w <= 0 || !isInside(a.l, a.t, a.l + a.w, a.t + a.h)) return false;
  memo.x = a.l + a.w / 2;
  memo.y = a.t + a.h / 2;
  memo.w = a.w;
  memo.h = a.h;
  screen = 4;
  opened = true;
  return true;
}

// ───────────────── 소개 화면 (화면 4) ─────────────────
// 왼쪽: 프로젝트 소개 글, 오른쪽: 사용법 글과 버튼 설명. 글 내용은 아래 상수를 고치면 바뀜 (빈 줄 = 문단 나눔)
const INFO_LEFT_TITLE = "NOsTElgia";
const INFO_LEFT_TEXT =
  "디지털은 ‘별도의 노력 없이’ 기록을 닳지 않게 보존하고 우리는 거의 무한대에 가깝게(한도가 있지만 개인이 실감할 정도가 아닌) 스크린샷을 하고 메모를 저장할 수 있다. 기록이 영원화될 수 있는 지금, 우리의 메모장에 남아있는 텍스트는 우리가 선택했기에 남아 있는 것일까? 혹은 기록의 기본 상태가 ‘영원’이기에 남아 있는 것일까?\n\n" +
  "프로젝트는 모래에 기록을 남기는 손의 감각과 오래된 기록은 지워진다는 사실을 다시 화면 안으로 불러온다. 메모는 개인이 돌보지 않으면 사라진다. 선택에 수고스러움을 더하며 어떤 것을 ‘보존할지’ 고민하게 만든다. 어쩌면 그때는 중요하지 않아 휘발되었던 메모를 다시 생각하면 그리워질 수도 있겠다.";
const INFO_RIGHT_TITLE = "How to Use";
const INFO_RIGHT_TEXT =
  "메모는 48시간이 지나면 완전히 지워집니다. 파도가 한 번 올 때마다 메모의 3%씩 지워집니다. 메모의 커버를 클릭하면 커버가 확대되고, 그 상태에서 커버를 다시 손으로 따라 그리면 메모가 다시 기록됩니다. 메모의 커버를 다시 클릭하면 메모를 볼 수 있고, 편집할 수 있습니다.\n\n" +
  "메모는 세 손가락으로 지울 수 있습니다. 커버가 확대된 상태에서 세 손가락으로 커버를 쓸면 삭제됩니다. 같은 방식으로, 메인 화면의 배경 모래를 이리저리 움직일 수 있습니다.";
//버튼 설명: 왼쪽 그림(box: memo 버튼 크기 상자, plus/minus: 원) + 오른쪽 글
//왼쪽 그림은 홈 화면의 실제 버튼(memo, +, −, date, random)을 INFO_ICON_SCALE 배로 작게 그린 것
const INFO_LEGEND = [
  { icon: "memo", text: "눌러서 손으로 메모를 쓸 수 있습니다." },
  { icon: "plus", text: "눌러서 새 페이지를 만듭니다." },
  { icon: "minus", text: "눌러서 페이지를 지웁니다." },
  { icon: "date", text: "날짜순으로 정렬합니다." },
  { icon: "random", text: "랜덤하게 배치합니다." },
];
const INFO_ICON_SCALE = 0.7;
const INFO_LEGEND_Y = [0, 52, 102, 158, 215]; //첫 줄 가운데에서 각 줄 가운데까지의 거리 (px)
const INFO_HEAD_SIZE = 32; //제목 글자 크기
const INFO_LEADING = 26; //본문 줄 간격
let infoWrapCache = {};

//글을 칸 너비에 맞춰 줄바꿈 (단어는 띄어쓰기 기준, 빈 줄은 문단 나눔). 같은 글/너비면 한 번만 계산
function infoWrap(str, maxW) {
  let key = str.length + ":" + Math.round(maxW) + ":" + uiTextSize;
  if (infoWrapCache[key] !== undefined) return infoWrapCache[key];
  textFont(uiFont);
  textSize(uiTextSize);
  let lines = [];
  for (let para of str.split("\n")) {
    if (para === "") {
      lines.push("");
      continue;
    }
    let cur = "";
    for (let word of para.split(" ")) {
      let test = cur === "" ? word : cur + " " + word;
      if (cur !== "" && textWidth(test) > maxW) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    lines.push(cur);
  }
  infoWrapCache[key] = lines;
  return lines;
}

//한 칸(제목 + 본문) 그리기: 본문이 끝난 아래쪽 y를 돌려줌
function drawInfoColumn(title, body, x, w, t, H) {
  noStroke();
  fill(0);
  textFont(uiFont);
  textStyle(NORMAL);
  textSize(INFO_HEAD_SIZE);
  textAlign(LEFT, CENTER);
  text(title, x, t + H * 0.138);
  textSize(uiTextSize);
  textAlign(LEFT, TOP);
  let y = t + H * 0.217 - INFO_LEADING / 2;
  for (let line of infoWrap(body, w)) {
    text(line, x, y);
    y += INFO_LEADING;
  }
  return y;
}

function drawScreen4() {
  let l = memo.x - memo.w / 2;
  let t = memo.y - memo.h / 2;
  let W = memo.w;
  let H = memo.h;
  let leftL = l + W * 0.0316;
  let rightL = l + W * 0.534;
  drawInfoColumn(INFO_LEFT_TITLE, INFO_LEFT_TEXT, leftL, W * 0.423, t, H);
  let endY = drawInfoColumn(
    INFO_RIGHT_TITLE,
    INFO_RIGHT_TEXT,
    rightL,
    W * 0.427,
    t,
    H,
  );
  //버튼 설명: 본문과 겹치지 않게 본문 아래에서 시작
  let y0 = Math.max(t + H * 0.525, endY + 50);
  let k = INFO_ICON_SCALE;
  let hh = PAGE_BTN_D * 0.3 * k; //십자/마이너스 선의 반 길이 (홈 화면 버튼과 같은 비율)
  let iconW = (startW + 20) * k; //가장 넓은 그림(random 버튼)의 너비. 그림은 모두 이 칸의 왼쪽 끝(오른쪽 칼럼 글의 왼쪽 끝)에 맞춤
  for (let i = 0; i < INFO_LEGEND.length; i++) {
    let it = INFO_LEGEND[i];
    let cy = y0 + INFO_LEGEND_Y[i];
    stroke(0);
    strokeWeight(1);
    fill(255);
    if (it.icon === "plus" || it.icon === "minus") {
      let cx = rightL + (PAGE_BTN_D * k) / 2;
      circle(cx, cy, PAGE_BTN_D * k);
      line(cx - hh, cy, cx + hh, cy);
      if (it.icon === "plus") line(cx, cy - hh, cx, cy + hh);
    } else {
      //memo, date는 버튼 크기, random은 더 긴 크기. 안에 버튼 글자를 작게 적음
      let bw = (it.icon === "random" ? startW + 20 : startW) * k;
      let cx = rightL + bw / 2;
      rect(cx, cy, bw, startH * k);
      noStroke();
      fill(0);
      textFont(uiFont);
      textSize(uiTextSize * k);
      textAlign(CENTER, CENTER);
      text(it.icon, cx, cy);
    }
    noStroke();
    fill(0);
    textFont(uiFont);
    textSize(uiTextSize);
    textAlign(LEFT, CENTER);
    text(it.text, rightL + iconW + 24, cy);
  }
}

//마우스가 메모 사각형 안에 있는지
function isInsideMemo() {
  return isInside(
    memo.x - memo.w / 2,
    memo.y - memo.h / 2,
    memo.x + memo.w / 2,
    memo.y + memo.h / 2,
  );
}

function mousePressed() {
  //손가락이 2개 이상 닿았으면 (세 손가락 쓸기 등) 클릭/복구 드래그로 보지 않음: 이미 시작된 복구 드래그도 취소
  if (touches.length >= 2) {
    healDrag = null;
    pageDrag = null;
    //첫 번째 손가락이 칸 위에 닿아서 방금 심볼이 커지기 시작했다면, 세 손가락 쓸기 중이니 다시 작게 되돌림
    if (
      focusIdx !== -1 &&
      focusOpen === true &&
      millis() - lastCellClickMs < 600
    )
      focusOpen = false;
    return;
  }
  //보기 창이 내려가는 중, 소개 창이 닫히는 중에는 누르는 동작 없음
  if (viewClosing === true || infoClosing === true || homeHold === true) return;
  //버튼(memo, date, random, next, done, edit)을 누르면 바로 실행하지 않고, 누르고 있는 동안은 검게 보이다가 버튼 위에서 뗄 때 실행
  let bid = btnAtMouse();
  if (bid !== null) {
    pressedBtn = bid;
    return;
  }
  handlePress();
}

//누른 곳에 따라 동작 (버튼은 뗄 때 이 함수를 불러서 실행, 나머지는 누를 때 바로)
function handlePress() {
  //- 버튼이 아닌 곳을 누르면 remove? 질문은 사라짐
  if (removeAsk === true && (opened === true || pageBtnAtMouse() !== "minus"))
    removeAsk = false;
  if (opened === false) {
    //작은 사각형을 클릭하면 열기
    if (isInsideMemo()) {
      opened = true;
    } else if (pressSortButton()) {
      //정렬 버튼을 눌렀으면 칸 클릭으로는 넘기지 않음
    } else if (pressPageButton()) {
      //페이지 버튼도 마찬가지
    } else if (pressTitleBar()) {
      //제목 바를 눌렀으면 소개 창이 열림
    } else {
      //빈 곳이나 칸에서 좌우로 끌면 페이지 넘기기 (뗄 때 확인). 칸을 눌러 심볼이 커지기 시작했다면 같이 기억해 둠
      let wasFree = focusIdx === -1;
      pressHome();
      if (wasFree === true)
        pageDrag = { sx: mouseX, sy: mouseY, focusedByPress: focusIdx !== -1 };
    }
  } else if (showX === true) {
    let a = getXArea();
    if (isInside(a.l, a.t, a.r, a.b)) {
      //X자 영역을 클릭하면 닫기 (다음에 열 때는 첫 번째 화면부터)
      //수정 중이었다면 고친 내용은 버리고, 보기 창이 내려가며 닫힘
      if (editIdx !== -1) {
        cancelEdit();
      } else if (screen === 1 || screen === 2) {
        //새 메모를 쓰다가 X로 닫으면 쓰던 내용(그림, 제목, 심볼)은 저장하지 않고 삭제
        discardDraft();
      }
      opened = false;
      if (screen === 3) {
        //보기 창은 작아지지 않고 화면 아래로 내려가며 닫힘 (다 내려가면 draw에서 정리)
        viewClosing = true;
      } else if (screen === 4) {
        //소개 창은 제목 바 자리로 작아지며 닫힘 (다 작아지면 draw에서 정리)
        infoClosing = true;
      } else {
        screen = 1;
      }
    } else if (screen === 1) {
      pressScreen1();
    } else if (screen === 2) {
      pressScreen2();
    } else if (screen === 4) {
      //소개 화면에는 누르는 버튼이 없음 (X자만)
    } else {
      pressScreen3();
    }
  }
}

//지금 마우스(손가락) 아래에 있는 버튼의 이름 (없으면 null): "memo", "date", "random", "next", "done", "editdone", "edit"
//화면에 보이는 버튼만 해당. X자, 펜/지우개는 여기에 넣지 않음
let pressedBtn = null; //누르고 있는 버튼의 이름 (뗄 때까지 유지)
function btnAtMouse() {
  if (viewClosing === true || infoClosing === true) return null;
  if (opened === false) {
    //memo 버튼은 누르는 순간 바로 열리고 검게 바뀌지 않음 (여기서 제외)
    if (isInsideMemo()) return null;
    if (
      focusIdx === -1 &&
      abs(memo.w - startW) < 2 &&
      abs(memo.h - startH) < 2
    ) {
      let sa = getSortAreas();
      if (isInside(sa.date.l, sa.date.t, sa.date.r, sa.date.b)) return "date";
      if (isInside(sa.random.l, sa.random.t, sa.random.r, sa.random.b))
        return "random";
      let pb = pageBtnAtMouse();
      if (pb !== null) return pb;
    }
    return null;
  }
  if (showX !== true) return null;
  let n = getNextArea();
  if (screen === 1) {
    if (editIdx !== -1) {
      let d = getEditDoneArea();
      if (isInside(d.l, d.t, d.r, d.b)) return "editdone";
    }
    if (isInside(n.l, n.t, n.r, n.b)) return "next";
  } else if (screen === 2) {
    if (isInside(n.l, n.t, n.r, n.b)) return "done";
  } else if (screen === 3) {
    if (isInside(n.l, n.t, n.r, n.b)) return "edit";
  }
  return null;
}

//이 버튼을 지금 누르고 있는지 (누른 채 버튼 밖으로 나가면 원래대로 돌아옴)
function isBtnDown(id) {
  return pressedBtn === id && mouseIsPressed === true && btnAtMouse() === id;
}

//창이 닫혀 있을 때 누른 곳에 따라 동작 (심볼 크게 보기)
function pressHome() {
  if (focusIdx !== -1) {
    //심볼을 크게 보는 중: 다 커졌을 때 X자를 누르면 원위치로 작아짐
    if (focusOpen === true && focusAmt > 0.98) {
      let a = getFocusXArea();
      if (isInside(a.l, a.t, a.r, a.b)) {
        //작아질 때 10%를 못 채운 부분 복구는 반영하지 않고 되돌림
        discardHeal(memos[focusIdx]);
        focusOpen = false;
      } else {
        //커진 심볼 위에서 누르기: 바로 열지 않고, 뗄 때까지 드래그했는지 보고 정함
        //(드래그하면 선을 따라 그려서 복구, 그냥 눌렀다 떼면 보기 창이 열림)
        let fr = getFocusRect();
        if (isInside(fr.l, fr.t, fr.l + fr.w, fr.t + fr.h)) {
          healDrag = {
            idx: focusIdx,
            moved: false,
            sx: mouseX,
            sy: mouseY,
            lx: mouseX,
            ly: mouseY,
            changed: false,
          };
        }
      }
    }
    return;
  }
  //심볼이 들어 있는 칸을 누르면 그 심볼을 크게 보기
  for (let i = 0; i < memos.length; i++) {
    if (typeof memos[i].cell !== "number") continue;
    if (pageOf(memos[i]) !== curPage || pageSlide !== 0) continue;
    let c = getCell(memos[i].cell);
    if (isInside(c.l, c.t, c.l + c.w, c.t + c.h)) {
      //칸의 심볼을 누르면 그 심볼을 크게 보기
      focusIdx = i;
      focusOpen = true;
      lastCellClickMs = millis();
      break;
    }
  }
}

//크게 보는 심볼을 눌렀다 뗐을 때: 보기 창 열기 (그림 그리던 창과 같은 크기로, 아래에서 위로 올라옴)
function openView(idx) {
  viewIdx = idx;
  screen = 3;
  opened = true;
  //보기 창의 점 그림을 미리 만들어 둠 (올라오는 동안 끊기지 않게)
  let vd = memos[viewIdx].drawing;
  if (vd !== undefined && vd.strokes.length > 0)
    getSandBuf(
      vd,
      getMemoScale(memos[viewIdx]),
      "view",
      getFadeStep(memos[viewIdx]),
      getMemoScale(memos[viewIdx]),
    );
  //창을 화면 맨 아래 바깥(크기는 다 커진 상태)에서 시작시켜서, lerp로 아래에서 위로 올라오게 함
  memo.w = width - openMargin * 2;
  memo.h = height - openMargin * 2;
  memo.x = width / 2;
  memo.y = height + memo.h / 2;
}

//복구: 크게 보는 심볼 위에서 드래그해서, 처음 그린 선을 따라 지나간 자리의 점을 되살림
//드래그한 자리(복구 원)를 심볼 데이터(symbol.heal)에 저장해 두고, 알갱이를 만들 때 그 안에 있는 알갱이는 사라졌어도 살려 둠
//원래 선의 healGoal(0.1 = 10%)만큼을 따라 그리면 전체가 복구되고, 사라지는 시간(48시간)도 그때부터 다시 시작
let healR = 18; //복구되는 붓 반지름 (화면 픽셀, 클수록 넓게 복구됨)
let healGoal = 0.1; //원래 선의 몇 %를 따라 그리면 전체 복구되는지 (0.1 = 10%)
let restoreMs = 1600; //전체 복구될 때 사라졌던 점이 서서히 돌아오는 시간 (밀리초)
let restoreFx = null; //전체 복구 연출 중인 정보: { idx: 메모 번호, b: 복구 직전 모습(그림판), t0: 시작 시각 }
let lastCellClickMs = -9999; //칸을 눌러 심볼을 크게 보기 시작한 시각
let healDrag = null; //복구 드래그 중인 정보 (null이면 드래그 중 아님)
let inkSampleCache = new WeakMap(); //심볼마다 원래 선 위에 찍어 둔 기준점들 (복구 비율 계산용)
let healState = new WeakMap(); //심볼마다 기준점이 복구됐는지 표시와 개수

//원래 그린 펜 선 위에 일정 간격으로 찍은 기준점들 [x, y, ...] (지우개로 지워진 자리는 제외)
function getInkSamples(sym) {
  let c = inkSampleCache.get(sym);
  if (c !== undefined) return c;
  let erasers = buildErasers(sym);
  let out = [];
  for (let i = 0; i < sym.strokes.length; i++) {
    let st = sym.strokes[i];
    if (st.col === 255) continue;
    let gap = Math.max(1.5, st.size * 0.35);
    let pts = st.pts;
    let add = function (x, y) {
      if (isErasedBy(erasers, x, y, i) === false) out.push(x, y);
    };
    if (pts.length === 1) add(pts[0][0], pts[0][1]);
    for (let k = 0; k + 1 < pts.length; k++) {
      let ax = pts[k][0],
        ay = pts[k][1];
      let len = Math.hypot(pts[k + 1][0] - ax, pts[k + 1][1] - ay);
      let n = Math.max(1, Math.ceil(len / gap));
      for (let q = 0; q < n; q++) {
        let t = q / n;
        add(ax + (pts[k + 1][0] - ax) * t, ay + (pts[k + 1][1] - ay) * t);
      }
    }
  }
  c = Float32Array.from(out);
  inkSampleCache.set(sym, c);
  return c;
}

//기준점 중 복구된 것의 상태 (저장된 복구 원에서 처음 한 번 계산하고, 이후엔 늘어날 때마다 갱신)
function getHealState(sym) {
  let st = healState.get(sym);
  if (st !== undefined) return st;
  let samples = getInkSamples(sym);
  st = { hit: new Uint8Array(samples.length / 2), count: 0 };
  if (sym.heal !== undefined) {
    for (let h of sym.heal) markHealed(sym, st, h[0], h[1], h[2]);
  }
  healState.set(sym, st);
  return st;
}

//원 (x, y, r) 안의 기준점을 복구됨으로 표시하고 새로 복구된 개수를 돌려줌
function markHealed(sym, st, x, y, r) {
  let samples = getInkSamples(sym);
  let added = 0;
  let r2 = r * r;
  for (let k = 0; k < samples.length; k += 2) {
    if (st.hit[k / 2] === 1) continue;
    let dx = samples[k] - x;
    let dy = samples[k + 1] - y;
    if (dx * dx + dy * dy <= r2) {
      st.hit[k / 2] = 1;
      added++;
    }
  }
  st.count += added;
  return added;
}

//화면 좌표 (px, py)를 복구 붓으로 한 번 찍음 (symbol 그림 좌표로 바꿔서 저장). 전체 복구가 됐으면 true
function healAt(m, tr, px, py) {
  let sym = m.symbol;
  let samples = getInkSamples(sym);
  if (samples.length === 0) return false;
  let r = healR / tr.sc;
  let x = (px - tr.ox) / tr.sc;
  let y = (py - tr.oy) / tr.sc;
  if (sym.heal === undefined) sym.heal = [];
  //이미 복구한 원과 너무 겹치면 건너뜀 (데이터가 불어나지 않게)
  for (let h of sym.heal) {
    if (Math.hypot(h[0] - x, h[1] - y) < r * 0.5) return false;
  }
  let st = getHealState(sym);
  let added = markHealed(sym, st, x, y, r);
  if (added === 0) {
    //원래 선에 닿지 않은 자리는 저장하지 않음 (복구 데이터는 선 위에서만 쌓임)
    if (sym.heal.length === 0) sym.heal = undefined;
    return false;
  }
  sym.heal.push([
    Math.round(x * 10) / 10,
    Math.round(y * 10) / 10,
    Math.round(r * 10) / 10,
  ]);
  if (st.count / (samples.length / 2) >= healGoal) {
    restoreMemo(m);
    return true;
  }
  return false;
}

//전체 복구: 점이 처음 상태로 돌아오고, 사라지는 시간은 지금부터 다시 시작
function restoreMemo(m) {
  clearRestoreFx();
  let sym = m.symbol;
  if (sym !== undefined) {
    //복구 직전 모습(ghost)과, 복구되면서 새로 나타날 알갱이만 따로 그린 그림판(delta)을 둘 다 새로 만들어 둠
    //둘은 서로 겹치는 알갱이가 없어서, delta를 서서히 진하게 해도 겹쳐서 진해지는 부분이 없음 (연출이 끝나면 복구된 모습과 똑같음)
    let ds = getMemoScale(m);
    let sc = getFocusFit(sym).sc;
    let oldStep = getFadeStep(m);
    let only = {
      fade: getFadeFrac(oldStep),
      heal: sym.heal,
      wash: getWashFrac(sym),
    };
    restoreFx = {
      idx: memos.indexOf(m),
      sc: sc,
      ghost: renderSand(sym, sc, "big", oldStep, ds),
      delta: renderSand(sym, sc, "big", 0, ds, only),
      t0: millis(),
    };
  }
  m.time = Date.now();
  if (sym !== undefined) {
    sym.heal = undefined;
    sym.wash = undefined; //파도에 휩쓸려 사라진 것도 처음 상태로 돌아옴
    healState.delete(sym);
    releaseSand(sym);
  }
  if (m.drawing !== undefined) releaseSand(m.drawing);
  saveMemos();
}

//10%를 못 채운 부분 복구 되돌리기 (저장된 적 없으니 메모리에서만 지우면 됨)
function discardHeal(m) {
  healDrag = null;
  if (m === undefined || m.symbol === undefined || m.symbol.heal === undefined)
    return;
  m.symbol.heal = undefined;
  healState.delete(m.symbol);
}

//복구 연출 정리 (연출용 그림판 지우기)
function clearRestoreFx() {
  if (restoreFx !== null) {
    restoreFx.ghost.remove();
    restoreFx.delta.remove();
    restoreFx = null;
  }
}

//복구 연출 그리기: 복구 직전 모습은 그대로 두고, 새로 나타날 알갱이만 투명도 alpha로 같은 자리에 겹침
function drawRestoreFx(sym, tr, alpha) {
  let k = tr.sc / restoreFx.sc;
  let box = getSandBox(sym);
  let x = tr.ox + box.l * tr.sc;
  let y = tr.oy + box.t * tr.sc;
  let g = restoreFx.ghost;
  image(g, x, y, g.width * k, g.height * k);
  push();
  tint(255, alpha);
  image(
    restoreFx.delta,
    x,
    y,
    restoreFx.delta.width * k,
    restoreFx.delta.height * k,
  );
  pop();
}

function saveMemos() {
  try {
    storeItem("memoWeb", memos);
  } catch (e) {
    print("저장 실패", e);
  }
}

//복구 드래그 중 마우스가 움직일 때: 지난 위치에서 지금 위치까지 붓 간격마다 찍음
function healDragMove() {
  let hd = healDrag;
  let m = memos[hd.idx];
  if (m === undefined || m.symbol === undefined) return;
  if (hd.moved === false) {
    //조금(5px) 넘게 움직여야 드래그로 침 (그냥 클릭과 구분)
    if (dist(mouseX, mouseY, hd.sx, hd.sy) < 5) return;
    hd.moved = true;
    hd.lx = hd.sx;
    hd.ly = hd.sy;
  }
  let tr = getFocusFit(m.symbol);
  let stepPx = Math.max(2, healR * 0.4);
  let d = dist(hd.lx, hd.ly, mouseX, mouseY);
  let n = Math.max(1, Math.ceil(d / stepPx));
  for (let q = 1; q <= n; q++) {
    let px = lerp(hd.lx, mouseX, q / n);
    let py = lerp(hd.ly, mouseY, q / n);
    let before = m.symbol.heal === undefined ? 0 : m.symbol.heal.length;
    let full = healAt(m, tr, px, py);
    let after = m.symbol.heal === undefined ? 0 : m.symbol.heal.length;
    if (after !== before) hd.changed = true;
    if (full === true) {
      hd.changed = false; //restoreMemo에서 이미 저장함
      hd.done = true;
      break;
    }
  }
  hd.lx = mouseX;
  hd.ly = mouseY;
}

//심볼이 크게 보이는 자리: 화면 가운데, 화면 크기에 비례
function getFocusRect() {
  let w = width * focusWRatio;
  let h = height * focusHRatio;
  return { l: (width - w) / 2, t: (height - h) / 2, w: w, h: h };
}

//크게 보는 심볼 옆 X자 영역: 크게 보이는 자리의 오른쪽 위
function getFocusXArea() {
  let f = getFocusRect();
  let l = f.l + f.w + focusXGap;
  return { l: l, t: f.t, r: l + xSize, b: f.t + xSize };
}

//격자 칸 하나의 위치/크기 (번호 i: 0~14, 왼쪽 위부터 가로 방향으로)
//매 번 현재 화면 크기로 계산해서 화면에 맞게 자동 조정됨
function getCell(i) {
  let cw = (width - gridSide * 2) / gridCols;
  let ch = (height - gridTop - gridBottom) / gridRows;
  return {
    l: gridSide + (i % gridCols) * cw,
    t: gridTop + Math.floor(i / gridCols) * ch,
    w: cw,
    h: ch,
  };
}

//아직 심볼이 안 들어간 칸 중에서 랜덤으로 하나 고르기 (빈 칸이 없으면 null)
function pickFreeCell() {
  let free = [];
  for (let i = 0; i < gridCols * gridRows; i++) {
    let used = memos.some((m) => m.cell === i && pageOf(m) === curPage);
    if (used === false) {
      free.push(i);
    }
  }
  if (free.length === 0) return null;
  return random(free);
}

//심볼 배치 계산 (1) 칸 안: 그림 영역이 아니라 실제로 그린 선(펜)의 범위를 기준으로,
//비율은 그대로 두고 칸 안(여백 pad 제외)에 꽉 차게 키우거나 줄여서 칸 가운데에 놓음
//(작게 그려도 칸에 맞게 커지고, 영역 안 어디에 그렸든 가운데에 옴)
//sc: 키우거나 줄이는 비율, ox/oy: 그림 영역 왼쪽 위가 놓일 화면 좌표
function getCellFit(sym, c, pad) {
  let b = getInkBounds(sym);
  let bw = Math.max(1, b.r - b.l);
  let bh = Math.max(1, b.b - b.t);
  let sc = Math.min((c.w - pad * 2) / bw, (c.h - pad * 2) / bh);
  return {
    sc: sc,
    ox: c.l + c.w / 2 - ((b.l + b.r) / 2) * sc,
    oy: c.t + c.h / 2 - ((b.t + b.b) / 2) * sc,
  };
}

//심볼 배치 계산 (2) 크게 볼 때: 실제로 그린 선의 범위가 노란 자리 안에 꽉 차게 맞추고,
//그린 선의 한가운데가 화면 가운데에 오도록 함
function getFocusFit(sym) {
  let fr = getFocusRect();
  let b = getInkBounds(sym);
  let bw = Math.max(1, b.r - b.l);
  let bh = Math.max(1, b.b - b.t);
  let sc = Math.min(fr.w / bw, fr.h / bh);
  return {
    sc: sc,
    ox: fr.l + fr.w / 2 - ((b.l + b.r) / 2) * sc,
    oy: fr.t + fr.h / 2 - ((b.t + b.b) / 2) * sc,
  };
}

//실제로 그린 선(펜)이 차지하는 범위 (그림 영역 기준 좌표, 선 두께 포함, 지우개 선은 제외)
function getInkBounds(sym) {
  //매 프레임 부르니까 한 번 계산한 값은 기억해 둠
  let cached = inkCache.get(sym);
  if (cached !== undefined) return cached;
  let res = calcInkBounds(sym);
  inkCache.set(sym, res);
  return res;
}

function calcInkBounds(sym) {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (let st of sym.strokes) {
    if (st.col === 255) continue;
    for (let p of st.pts) {
      l = Math.min(l, p[0] - st.size / 2);
      t = Math.min(t, p[1] - st.size / 2);
      r = Math.max(r, p[0] + st.size / 2);
      b = Math.max(b, p[1] + st.size / 2);
    }
  }
  //펜으로 그린 선이 하나도 없으면 그림 영역 전체를 기준으로 함
  if (l === Infinity) return { l: 0, t: 0, r: sym.w, b: sym.h };
  return { l: l, t: t, r: r, b: b };
}

//모래 알갱이 표현 설정 (심볼 그림 좌표 기준)
let sandDensity = 0.1; //화면에서 선이 차지하는 넓이 1당 알갱이 수 (클수록 빽빽). 어떤 크기로 보여도 똑같이 적용됨
let sandSpread = 0.45; //알갱이가 퍼지는 정도 (선 반지름 대비, 클수록 가장자리까지 퍼짐)
let sandLimit = 1.25; //선 반지름의 몇 배까지만 퍼질지
let sandDotR = 0.95; //알갱이 반지름 (화면 픽셀, 심볼을 클릭해서 크게 볼 때의 크기. 심볼이 커지거나 작아져도 같은 크기)
let homeDotRatio = 0.8; //홈 화면(격자 칸 안)에서의 알갱이 크기 = 크게 볼 때 크기의 몇 배 (0.8이면 크게 볼 때의 80%)
//점이 사라지는 설정: 메모를 만든 때부터 fadeIntervalMin분마다 점이 랜덤하게 사라짐
//처음에는 급격하게 사라지다가 갈수록 덜 사라지고, fadeHours시간이 지나면 100% 다 사라져서 그 메모는 데이터에서 지워짐
//(테스트할 때는 데이터의 time 값을 옮기는 게 편함. fadeIntervalMin을 줄이면 시간 흐름이 그만큼 빨라짐)
let lastResizeMs = -10000; //브라우저 창 크기가 마지막으로 바뀐 때 (millis)
let regenBudget = 2; //한 프레임에 크기 때문에 다시 만들 수 있는 점 그림판 개수 (한꺼번에 다시 만들다 끊기지 않게)
let fadeIntervalMin = 30; //몇 분마다 점이 줄어드는지
let fadeHours = 48; //몇 시간이 지나면 100% 다 사라지는지
let fadeHalfPercent = 75; //절반 시간(fadeHours의 절반, 기본 24시간)이 지났을 때 몇 %가 사라져 있는지
let fadeFirstPercent = 4; //처음 한 번(30분)에 몇 %가 사라지는지
let inkCache = new WeakMap(); //심볼마다 실제로 그린 선의 범위를 기억
let sandBuf = new WeakMap(); //심볼마다 알갱이를 미리 그려 둔 그림판(칸 크기용, 크게 볼 때용)을 기억

//seed로 항상 같은 랜덤값을 내는 함수 (다시 열어도 모래 모양이 안 바뀜)
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

//점 (x, y)에서 선분 (a-b)까지의 거리
function distToSegment(x, y, ax, ay, bx, by) {
  let dx = bx - ax;
  let dy = by - ay;
  let len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

//지우개 선들을 미리 정리: 선분 목록과, 이 선이 지나가는 범위(상자)를 저장해 두면
//알갱이마다 모든 선분을 검사하지 않고 범위 밖은 바로 건너뛸 수 있음
function buildErasers(sym) {
  let erasers = [];
  for (let j = 0; j < sym.strokes.length; j++) {
    let er = sym.strokes[j];
    if (er.col !== 255) continue;
    let r = er.size / 2;
    let segs = [];
    if (er.pts.length === 1) {
      segs.push([er.pts[0][0], er.pts[0][1], er.pts[0][0], er.pts[0][1]]);
    }
    for (let k = 0; k + 1 < er.pts.length; k++) {
      segs.push([
        er.pts[k][0],
        er.pts[k][1],
        er.pts[k + 1][0],
        er.pts[k + 1][1],
      ]);
    }
    erasers.push({ idx: j, r: r, segs: segs });
  }
  return erasers;
}

//점 (x, y)가 stroke i보다 나중에 그린 지우개에 지워졌는지
function isErasedBy(erasers, x, y, i) {
  for (let er of erasers) {
    if (er.idx <= i) continue;
    let r = er.r;
    for (let sg of er.segs) {
      if (x < Math.min(sg[0], sg[2]) - r || x > Math.max(sg[0], sg[2]) + r)
        continue;
      if (y < Math.min(sg[1], sg[3]) - r || y > Math.max(sg[1], sg[3]) + r)
        continue;
      if (distToSegment(x, y, sg[0], sg[1], sg[2], sg[3]) <= r) return true;
    }
  }
  return false;
}

//점 (x, y)가 복구한 자리(원) 안에 있는지
function isHealed(heal, x, y) {
  for (let h of heal) {
    let dx = x - h[0];
    if (dx > h[2] || dx < -h[2]) continue;
    let dy = y - h[1];
    if (dx * dx + dy * dy <= h[2] * h[2]) return true;
  }
  return false;
}

//파도 한 번에 사라지는 심볼 알갱이 비율
const WASH_PERCENT = 3;

//알갱이마다 정해진 두 번째 랜덤값 (0~1): 좌표와 선 번호로 계산해서 항상 같음
function washRank(x, y, i) {
  let v = Math.sin(x * 12.9898 + y * 78.233 + i * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

//심볼에서 파도에 휩쓸려 사라진 알갱이 비율 (0~1)
function getWashFrac(sym) {
  if (sym === undefined || !(sym.wash > 0)) return 0;
  return Math.min(1, (sym.wash * WASH_PERCENT) / 100);
}

//펜 선(검정)을 알갱이들로 바꿈: 선 가운데는 빽빽하고 가장자리로 갈수록 성기게 (가운데 쪽으로 몰린 분포)
//지우개(흰색) 선이 나중에 지나간 자리의 알갱이는 빼서, 지운 부분은 그려지지 않음
//결과는 [x0, y0, x1, y1, ...] 형태의 Float32Array (메모리와 속도를 아끼려고 배열 안에 배열을 만들지 않음)
//sc: 화면에 보일 확대 비율. 크게 보일수록 알갱이를 늘려서(넓이에 비례), 알갱이 크기는 그대로 두고 개수만 달라지게 해
//크기와 상관없이 점 질감(빽빽한 정도)이 비슷하게 보이게 함
//boost: 알갱이 개수에 곱하는 배수 (알갱이를 작게 그릴 때 개수를 늘려서 진하기를 맞추는 데 씀)
//fadeFrac: 사라진 알갱이의 비율 (0~1). 알갱이마다 정해 둔 랜덤값(rank)이 이 값보다 작으면 사라짐
//(rank는 항상 같은 순서로 정해지니까 시간이 지나면 이미 사라진 알갱이는 계속 사라진 채로, 사라지는 알갱이만 늘어남)
function makeSand(sym, sc, boost, fadeFrac, only) {
  let total = 0;
  for (let st of sym.strokes) total += st.pts.length;
  let rnd = seededRandom(
    total * 7919 + sym.strokes.length * 104729 + Math.round(sym.w),
  );
  let gauss = function () {
    let u = 1 - rnd();
    let v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  //지우개 선들을 미리 정리해 두고, 알갱이가 나중에 그린 지우개에 지워졌는지 검사
  let erasers = buildErasers(sym);
  let isErased = function (x, y, i) {
    return isErasedBy(erasers, x, y, i);
  };
  let heal = sym.heal; //따라 그려서 복구한 자리들 [[x, y, r], ...] (없으면 undefined)
  //only가 있으면 "복구 직전엔 사라져 있었는데 복구되면 보이는 알갱이"만 만듦 (복구 연출에서 서서히 나타낼 알갱이들)
  //이때 복구 후 모습은 fadeFrac=0, 복구 자리 없음으로 계산하고, 복구 직전 모습은 only.fade, only.heal로 계산
  if (only !== undefined && only.washRange === undefined) heal = undefined;
  //파도에 휩쓸려 사라진 알갱이: 심볼마다 파도를 맞은 횟수(sym.wash) x 3%만큼, 알갱이마다 정해 둔 두 번째 랜덤값(rank2)이 작은 것부터 사라짐
  //(rank2는 알갱이 좌표로 계산해서 항상 같은 값이고, 시간이 지나 사라지는 순서(rank)와는 따로 정해짐)
  let washFrac = getWashFrac(sym);
  if (only !== undefined && only.washRange === undefined) washFrac = 0; //복구 연출용: 복구 후 모습은 파도 맞은 흔적도 없음
  let dots = [];
  for (let i = 0; i < sym.strokes.length; i++) {
    let st = sym.strokes[i];
    if (st.col === 255) continue; //지우개 선은 알갱이를 만들지 않음
    let half = st.size / 2;
    let pts = st.pts;
    //점 하나짜리 선은 길이 0인 선분으로 취급
    let segs = pts.length === 1 ? [[pts[0], pts[0]]] : [];
    for (let k = 0; k + 1 < pts.length; k++) segs.push([pts[k], pts[k + 1]]);
    for (let sg of segs) {
      let ax = sg[0][0],
        ay = sg[0][1],
        bx = sg[1][0],
        by = sg[1][1];
      let len = Math.hypot(bx - ax, by - ay);
      //알갱이 수는 화면에서 선이 차지하는 넓이(그림 좌표 넓이 x sc x sc)에 비례. 소수점은 확률로 올림해서 치우침 없게 함
      let nf = (len + half) * st.size * sandDensity * sc * sc * boost;
      let n = Math.floor(nf) + (rnd() < nf - Math.floor(nf) ? 1 : 0);
      let nx = len === 0 ? 1 : -(by - ay) / len; //선에 수직인 방향
      let ny = len === 0 ? 0 : (bx - ax) / len;
      for (let q = 0; q < n; q++) {
        let t = rnd();
        let off = gauss() * half * sandSpread;
        if (Math.abs(off) > half * sandLimit) continue;
        //선이 가는 방향으로도 똑같이 퍼뜨림 >> 선 끝이 칼로 자른 듯 뭉툭하지 않고 가장자리처럼 성기게 퍼짐
        let along = gauss() * half * sandSpread;
        if (Math.abs(along) > half * sandLimit) continue;
        let ux = len === 0 ? 0 : (bx - ax) / len; //선이 가는 방향
        let uy = len === 0 ? 0 : (by - ay) / len;
        let x = ax + (bx - ax) * t + nx * off + ux * along;
        let y = ay + (by - ay) * t + ny * off + uy * along;
        //점 하나 선은 원형으로 퍼짐
        if (len === 0) {
          let ang = rnd() * Math.PI * 2;
          let rr = Math.abs(gauss()) * half * sandSpread;
          if (rr > half * sandLimit) continue;
          x = ax + Math.cos(ang) * rr;
          y = ay + Math.sin(ang) * rr;
        }
        //이 알갱이가 사라질 차례를 정하는 랜덤값 (지워진 알갱이든 아니든 항상 똑같이 뽑아야 순서가 안 흔들림)
        let rank = rnd();
        //이 선보다 나중에 그린 지우개 선이 덮은 알갱이와, 시간이 지나 사라진 알갱이는 만들지 않음
        //(단, 사라질 차례였어도 따라 그려서 복구한 자리 안에 있으면 그대로 살려 둠)
        let rank2 = washRank(x, y, i);
        if (only !== undefined && only.washRange !== undefined) {
          //이번 파도에 휩쓸릴 알갱이만 모음: 지금 보이고 있는 알갱이 중에서 rank2가 이번 파도 몫 범위(3%)에 든 것
          if (rank2 >= only.washRange[0] && rank2 < only.washRange[1]) {
            let hiddenByTime =
              rank < fadeFrac && !(heal !== undefined && isHealed(heal, x, y));
            if (hiddenByTime === false && isErased(x, y, i) === false)
              dots.push(x, y);
          }
          continue;
        }
        let gone = rank < fadeFrac || rank2 < washFrac;
        if (
          gone === true &&
          heal !== undefined &&
          isHealed(heal, x, y) === true
        )
          gone = false;
        if (only !== undefined) {
          let wasGone =
            (rank < only.fade || rank2 < only.wash) &&
            !(only.heal !== undefined && isHealed(only.heal, x, y));
          if (gone === false && wasGone === true && isErased(x, y, i) === false)
            dots.push(x, y);
        } else if (gone === false && isErased(x, y, i) === false)
          dots.push(x, y);
      }
    }
  }
  return Float32Array.from(dots);
}

//알갱이가 퍼질 수 있는 범위 = 펜 선의 점들이 지나가는 범위 + 알갱이가 퍼져 나가는 거리 (그림 좌표 기준)
//그림판을 이 범위만큼만 만들면 되고(그림 영역 전체를 만들 필요 없음), 가장자리 알갱이도 잘리지 않음
//선 두께가 클수록 더 멀리 퍼지니까 가장 두꺼운 펜 기준으로 여유를 둠
function getSandBox(sym) {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  let maxSize = 0;
  for (let st of sym.strokes) {
    if (st.col === 255) continue;
    maxSize = Math.max(maxSize, st.size);
    for (let p of st.pts) {
      l = Math.min(l, p[0]);
      t = Math.min(t, p[1]);
      r = Math.max(r, p[0]);
      b = Math.max(b, p[1]);
    }
  }
  //펜으로 그린 점이 하나도 없으면 그림 영역 전체
  if (l === Infinity)
    return { l: 0, t: 0, w: Math.max(1, sym.w), h: Math.max(1, sym.h) };
  let pad = Math.ceil((maxSize / 2) * sandLimit) + 2;
  return { l: l - pad, t: t - pad, w: r - l + pad * 2, h: b - t + pad * 2 };
}

//알갱이들을 sc 비율로 그려 둔 그림판(버퍼) 만들기: 알갱이는 여기에 딱 한 번만 그림
//slot: "cell"(홈 화면 칸 안)이면 알갱이를 homeDotRatio만큼 작게, "big"(크게 볼 때)이면 sandDotR 그대로
//step: 지금까지 사라지는 일이 몇 번 있었는지 (getFadeStep)
//dotScale: 점 크기에 곱하는 비율 (창 크기 비율). 점이 작아지면 개수를 늘려서 진하기는 그대로 유지
function renderSand(sym, sc, slot, step, dotScale, only) {
  //이 크기(sc)에 맞는 알갱이를 만들어서 그림판에 그리고, 알갱이 목록은 따로 보관하지 않음 (메모리 절약)
  //홈 화면은 알갱이가 작은 만큼 개수를 늘려서(작아진 크기의 제곱에 반비례), 크게 볼 때와 같은 진하기로 보이게 함
  let ratio = (slot === "cell" ? homeDotRatio : 1) * dotScale;
  let fadeFrac = getFadeFrac(step);
  let dots = makeSand(
    sym,
    sc,
    1 / (ratio * ratio),
    only === undefined ? fadeFrac : 0,
    only,
  );
  let box = getSandBox(sym);
  let g = createGraphics(
    Math.max(1, Math.ceil(box.w * sc)),
    Math.max(1, Math.ceil(box.h * sc)),
  );
  let r = sandDotR * ratio;
  let ctx = g.drawingContext;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  for (let k = 0; k < dots.length; k += 2) {
    let x = (dots[k] - box.l) * sc;
    let y = (dots[k + 1] - box.t) * sc;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  return g;
}

//저장된 심볼 하나 그리기: 미리 그려 둔 그림판을 화면에 붙이기만 해서 가볍게 그림
//baseSc: 그림판을 만들 때의 비율, tr.sc: 지금 보여줄 비율 (커지는 동안만 둘이 다름)
//slot: "cell"(칸 안 크기 그림판) / "big"(크게 볼 때 크기 그림판)
//alpha: 투명도 (0~255). 칸 크기 그림판과 큰 그림판을 겹쳐서 부드럽게 바꿀 때 씀
function drawSymbol(sym, tr, baseSc, slot, alpha, step, dotScale) {
  let b = getSandBuf(sym, baseSc, slot, step, dotScale);
  //창 크기를 바꾸는 중에는 예전 그림판이 그대로 올 수 있어서, 그림판을 만들 때의 비율(b.sc) 기준으로 늘리고 줄임
  let k = tr.sc / b.sc;
  //그림판은 그림 영역의 일부(box)만 담고 있으니, box 왼쪽 위가 놓일 자리에 붙임
  let box = getSandBox(sym);
  let x = tr.ox + box.l * tr.sc;
  let y = tr.oy + box.t * tr.sc;
  push();
  if (alpha < 255) tint(255, alpha);
  if (Math.abs(k - 1) < 0.001) {
    //같은 크기면 정수 좌표에 그대로 붙임 (흐려지지 않게)
    image(b.g, Math.round(x), Math.round(y));
  } else {
    image(b.g, x, y, b.g.width * k, b.g.height * k);
  }
  pop();
}

//미리 그려 둔 그림판 가져오기 (없거나 기준 크기가 달라졌으면 새로 만듦)
//slot: "cell"(홈 화면 칸), "big"(크게 볼 때), "view"(보기 창의 큰 그림)
//step이 달라졌으면(알갱이가 더 사라질 때가 됐으면) 그림판도 새로 만듦
//창 크기가 바뀐 경우(baseSc, dotScale 변화)에는 크기를 바꾸는 동안은 예전 그림판을 늘려서 쓰다가, 바꾸기가 멈추면(0.25초) 한 프레임에 몇 개씩 새로 만듦
function getSandBuf(sym, baseSc, slot, step, dotScale) {
  let e = sandBuf.get(sym);
  if (e === undefined) {
    e = {};
    sandBuf.set(sym, e);
  }
  let b = e[slot];
  let healN =
    (sym.heal === undefined ? 0 : sym.heal.length) +
    (sym.wash > 0 ? sym.wash * 100000 : 0); //복구한 자리나 파도 맞은 횟수가 바뀌었는지 확인용
  let sizeChanged =
    b !== undefined &&
    (Math.abs(b.sc - baseSc) > 0.005 ||
      Math.abs(b.dotScale - dotScale) > 0.005);
  if (
    b === undefined ||
    b.step !== step ||
    sizeChanged === true ||
    b.healN !== healN
  ) {
    //크기만 바뀐 거면 아직 창 크기를 바꾸는 중이거나 이번 프레임 몫을 다 썼을 땐 예전 걸 그대로 씀
    if (b !== undefined && b.step === step) {
      if (sizeChanged === true) {
        if (millis() - lastResizeMs < 250 || regenBudget <= 0) return b;
        regenBudget--;
      } else if (millis() - b.builtMs < 80) {
        //복구하며 드래그하는 동안은 0.08초에 한 번씩만 다시 그림 (끊기지 않게)
        return b;
      }
    }
    if (b !== undefined) b.g.remove();
    b = {
      sc: baseSc,
      step: step,
      dotScale: dotScale,
      healN: healN,
      builtMs: millis(),
      g: renderSand(sym, baseSc, slot, step, dotScale),
    };
    e[slot] = b;
  }
  return b;
}

//크게 보기가 끝난 심볼의 큰 그림판은 메모리 아끼려고 지움
function releaseBigSand(sym) {
  let e = sandBuf.get(sym);
  if (e !== undefined && e.big !== undefined) {
    e.big.g.remove();
    e.big = undefined;
  }
}

//새 메모 작성 중이던 내용 삭제: 큰 그림, 제목, 심볼 모두 비움 (다시 열면 빈 화면에서 시작)
function discardDraft() {
  strokes = [];
  symbolStrokes = [];
  currentStroke = null;
  symbolCurrent = null;
  titleInput.value("");
}

//수정 중 첫 번째 화면의 done 버튼 영역: next 버튼 왼쪽 (간격은 viewGap)
function getEditDoneArea() {
  let n = getNextArea();
  return { l: n.l - viewGap - btnW, t: n.t, r: n.l - viewGap, b: n.b };
}

//보기 화면(3)에서 누른 곳에 따라 동작: edit 버튼을 누르면 수정 시작
function pressScreen3() {
  let n = getNextArea();
  if (isInside(n.l, n.t, n.r, n.b)) {
    startEdit();
  }
}

//저장된 그림 데이터를 다시 화면 좌표의 선들로 되돌리기 (packDrawing의 반대)
//(l, t): 그림 영역 왼쪽 위의 화면 좌표
//scale: 만들 때보다 지금 화면이 얼마나 작아지거나 커졌는지 (선 좌표와 두께에 곱함, 기본 1)
function unpackDrawing(d, l, t, scale) {
  if (d === undefined || d === null || d.strokes === undefined) return [];
  if (scale === undefined) scale = 1;
  return d.strokes.map((s) => ({
    size: s.size * scale,
    col: s.col,
    pts: s.pts.map((p) => ({ x: l + p[0] * scale, y: t + p[1] * scale })),
  }));
}

//수정 시작: 새 메모 작성 중이던 내용은 잠시 치워 두고, 저장된 그림/심볼/제목을 불러와서 첫 번째 화면(그림 그리던 화면)으로 감
function startEdit() {
  let m = memos[viewIdx];
  if (m === undefined) return;
  editIdx = viewIdx;
  editStash = {
    strokes: strokes,
    symbolStrokes: symbolStrokes,
    title: titleInput.value(),
  };
  let l = memo.x - memo.w / 2;
  let t = memo.y - memo.h / 2;
  let f = getForm();
  //지금 창이 만들 때보다 작으면(또는 크면) 그림과 심볼도 그만큼 줄여서(늘려서) 불러옴 (작은 상태로 편집)
  let scaleD = getMemoScale(m);
  let scaleS = 1;
  if (m.symbol !== undefined && m.symbol.w > 0 && m.symbol.h > 0) {
    scaleS = Math.min(f.fw / m.symbol.w, f.bigH / m.symbol.h);
  }
  strokes = unpackDrawing(m.drawing, l, t, scaleD);
  symbolStrokes = unpackDrawing(m.symbol, f.fx, f.row2, scaleS);
  editInfo = {
    scaleD: scaleD,
    scaleS: scaleS,
    strokes0: strokes.length,
    symbol0: symbolStrokes.length,
  };
  titleInput.value(typeof m.title === "string" ? m.title : "");
  screen = 1;
}

//수정 끝(done): 수정사항을 메모에 반영하고 보기 창(3)으로 돌아감
//full이 false면 그림만 반영 (첫 번째 화면에서 done), true면 그림 + 제목 + 심볼 모두 반영 (두 번째 화면에서 done)
function finishEdit(full) {
  let m = memos[editIdx];
  if (m !== undefined && editInfo !== null) {
    //그림: 선이 늘었을 때(고쳤을 때)만 다시 만들어 저장. 지금 화면 크기에 맞춰 줄어 있던 만큼 되돌려서 저장 기준 크기로 저장함
    let edited = false; //실제로 고쳤는지 (고쳤을 때만 날짜가 바뀜)
    if (strokes.length !== editInfo.strokes0) {
      edited = true;
      let old = m.drawing;
      m.drawing = packDrawing(
        strokes,
        memo.x - memo.w / 2,
        memo.y - memo.h / 2,
        old.w,
        old.h,
        editInfo.scaleD,
      );
      releaseSand(old);
    }
    if (full === true) {
      let f = getForm();
      if (m.title !== titleInput.value()) edited = true;
      m.title = titleInput.value();
      //심볼도 선이 늘었을 때만 교체 (바뀌면 모래 알갱이와 미리 그려 둔 그림판도 새로 만들어짐)
      if (symbolStrokes.length !== editInfo.symbol0) {
        edited = true;
        let oldSym = m.symbol;
        m.symbol = packDrawing(
          symbolStrokes,
          f.fx,
          f.row2,
          oldSym.w,
          oldSym.h,
          editInfo.scaleS,
        );
        m.symbol.wash = oldSym.wash; //파도 맞은 횟수는 심볼을 고쳐도 이어짐
        releaseSand(oldSym);
      }
    }
    if (edited === true) m.created = Date.now();
    try {
      storeItem("memoWeb", memos);
    } catch (e) {
      print("저장 실패", e);
    }
  }
  endEdit();
}

//수정 취소 (X): 고친 내용은 버리고 원래 작성 중이던 내용을 되돌려 놓음 (창 닫는 건 X 처리에서 이어서 함)
function cancelEdit() {
  endEdit();
}

//수정 모드 정리: 치워 둔 새 메모 작성 내용을 되돌리고 보기 화면(3)으로
function endEdit() {
  if (editStash !== null) {
    strokes = editStash.strokes;
    symbolStrokes = editStash.symbolStrokes;
    titleInput.value(editStash.title);
  }
  editStash = null;
  editInfo = null;
  editIdx = -1;
  currentStroke = null;
  symbolCurrent = null;
  screen = 3;
}

//몇 번째 단계에서 사라진 점의 비율 (0~1): 처음엔 급격하게, 갈수록 계속 느려지고, 마지막 단계에 정확히 100%
//모양: 지수 곡선 두 개를 섞음. F(u) = a*g(u, tau1) + (1-a)*g(u, tau2)   (u: 지난 시간 / 전체 시간, 0~1)
// g(u, tau) = (1 - e^(-u/tau)) / (1 - e^(-1/tau))  → u=0에서 0, u=1에서 정확히 1, tau가 작을수록 처음이 급격함
// tau1은 고정(처음 급격한 부분), a와 tau2는 "절반 시간에 fadeHalfPercent%" + "첫 단계에 fadeFirstPercent%"가 되도록 자동 계산
let fadeCurve = null;
let fadeCurveKey = "";
function fadeG(u, tau) {
  return (1 - Math.exp(-u / tau)) / (1 - Math.exp(-1 / tau));
}
function buildFadeCurve() {
  let total = getFadeTotalSteps();
  let key = [total, fadeHalfPercent, fadeFirstPercent].join("_");
  if (key === fadeCurveKey) return fadeCurve;
  fadeCurveKey = key;
  let half = fadeHalfPercent / 100;
  let first = fadeFirstPercent / 100;
  let u1 = 1 / total;
  let tau1 = 0.08;
  let best = null;
  for (let i = 1; i < 4000; i++) {
    let tau2 = 0.1 + i * 0.002;
    let a = (half - fadeG(0.5, tau2)) / (fadeG(0.5, tau1) - fadeG(0.5, tau2));
    if (!(a >= 0 && a <= 1)) continue;
    let d = a * fadeG(u1, tau1) + (1 - a) * fadeG(u1, tau2);
    let err = Math.abs(d - first);
    if (best === null || err < best.err) best = { err: err, a: a, tau2: tau2 };
  }
  //조건을 맞출 수 없으면 일정한 속도로 줄어듦
  fadeCurve =
    best !== null && best.err < 0.005
      ? { a: best.a, tau1: tau1, tau2: best.tau2 }
      : null;
  return fadeCurve;
}
function getFadeFrac(step) {
  let total = getFadeTotalSteps();
  if (step >= total) return 1;
  if (step <= 0) return 0;
  let u = step / total;
  let c = buildFadeCurve();
  if (c === null) return u;
  return c.a * fadeG(u, c.tau1) + (1 - c.a) * fadeG(u, c.tau2);
}

//전체 단계 수 (기본: 48시간 / 30분 = 96번)
function getFadeTotalSteps() {
  return Math.max(1, Math.round((fadeHours * 60) / fadeIntervalMin));
}

//메모를 만든 뒤 점이 사라진 횟수: (지난 시간 / fadeIntervalMin분), 전체 단계 수를 넘으면 더 세지 않음
function getFadeStep(m) {
  let age = Math.max(0, Date.now() - m.time);
  let step = Math.floor(age / (fadeIntervalMin * 60 * 1000));
  return Math.min(step, getFadeTotalSteps());
}

//점이 100% 다 사라진 메모는 데이터에서 지움 (칸도 비워짐). 단, 예시 메모는 처음 상태로 다시 생성됨
//보고 있거나 수정 중인 메모가 있으면 번호가 꼬이니까, 홈 화면에서 아무것도 안 열려 있을 때만 지움
function deleteExpiredMemos() {
  if (
    focusIdx !== -1 ||
    viewIdx !== -1 ||
    editIdx !== -1 ||
    viewClosing === true
  )
    return;
  let changed = false;
  for (let i = memos.length - 1; i >= 0; i--) {
    if (
      getFadeFrac(getFadeStep(memos[i])) >= 1 ||
      getWashFrac(memos[i].symbol) >= 1
    ) {
      if (memos[i].symbol !== undefined) releaseSand(memos[i].symbol);
      if (memos[i].drawing !== undefined) releaseSand(memos[i].drawing);
      let si = memos[i].sampleIdx;
      if (
        typeof si === "number" &&
        sampleData !== null &&
        Array.isArray(sampleData.memos) &&
        sampleData.memos[si] !== undefined
      ) {
        //예시 메모는 지워지는 대신 처음 상태(ageHours 지난 상태)로 같은 칸에 다시 생성됨
        healState.delete(memos[i].symbol);
        fillSample(memos[i], si);
      } else {
        memos.splice(i, 1);
      }
      changed = true;
    }
  }
  if (changed === true) {
    try {
      storeItem("memoWeb", memos);
    } catch (e) {
      print("저장 실패", e);
    }
  }
}

//심볼 하나의 모래 알갱이와 미리 그려 둔 그림판을 모두 지움 (심볼이 바뀌었을 때)
function releaseSand(sym) {
  let e = sandBuf.get(sym);
  if (e !== undefined) {
    if (e.cell !== undefined) e.cell.g.remove();
    if (e.big !== undefined) e.big.g.remove();
    if (e.view !== undefined) e.view.g.remove();
    sandBuf.delete(sym);
  }
  inkCache.delete(sym);
}

//done: 메모를 저장하고 창을 닫음
function finishMemo() {
  let isEmpty =
    strokes.length === 0 &&
    symbolStrokes.length === 0 &&
    titleInput.value().trim() === "";
  let saved = true;
  //아무것도 안 쓰고 그리지 않았으면 저장하지 않음
  if (isEmpty === false) {
    saved = saveMemo();
  }
  //저장이 끝나면 다음 메모를 위해 비움 (저장에 실패하면 내용 유지)
  if (saved === true) {
    strokes = [];
    symbolStrokes = [];
    titleInput.value("");
  }
  //창 닫기: X자를 눌렀을 때와 똑같이 lerp로 작아짐 (다음에 열 때는 첫 번째 화면부터)
  opened = false;
  screen = 1;
}

//메모 하나를 데이터로 만들어 저장
function saveMemo() {
  let f = getForm();
  let l = memo.x - memo.w / 2;
  let t = memo.y - memo.h / 2;
  //심볼을 그렸으면 격자에서 비어 있는 칸 중 랜덤으로 한 칸을 골라 넣음 (빈 칸이 없으면 null)
  let cell = null;
  if (symbolStrokes.length > 0) {
    cell = pickFreeCell();
  }
  memos.push({
    time: Date.now(), //사라지는 시간 계산 기준 시각 (밀리초, 복구하면 다시 시작)
    created: Date.now(), //날짜: 만든 시각 (편집하면 그때로 바뀜)
    title: titleInput.value(), //두 번째 창에 입력한 텍스트
    drawing: packDrawing(strokes, l, t, memo.w, memo.h), //첫 번째 창의 큰 그림
    symbol: packDrawing(symbolStrokes, f.fx, f.row2, f.fw, f.bigH), //두 번째 창의 작은 그림
    cell: cell, //심볼이 들어간 격자 칸 번호 (0~14, 왼쪽 위부터 가로로 세어서)
    page: curPage, //머무르던 페이지 번호 (그 페이지의 칸에 들어감)
  });
  try {
    storeItem("memoWeb", memos);
    return true;
  } catch (e) {
    print("저장 실패", e);
    memos.pop();
    return false;
  }
}

//그림 데이터 만들기: 선 좌표를 그림 영역의 왼쪽 위 기준으로 바꾸고, 영역 크기(w, h)도 같이 저장
//(나중에 다른 화면 크기에서 보여줄 때 w, h 비율로 맞추면 됨)
//scale: 지금 화면이 저장 기준 크기(w, h)보다 얼마나 작거나 큰지 (기본 1). 선 좌표와 두께를 이 비율로 나눠서 저장 기준 크기로 되돌림
function packDrawing(list, l, t, w, h, scale) {
  if (scale === undefined) scale = 1;
  return {
    w: Math.round(w),
    h: Math.round(h),
    strokes: list.map((s) => ({
      size: Math.round((s.size / scale) * 10) / 10, //선 두께(지름)
      col: s.col, //0: 검은 선(펜), 255: 흰 선(지우개)
      pts: s.pts.map((p) => [
        Math.round(((p.x - l) / scale) * 10) / 10,
        Math.round(((p.y - t) / scale) * 10) / 10,
      ]),
    })),
  };
}

//큰 박스 옆 도구 버튼 중심 좌표: 검은 사각형은 큰 박스 윗선에 맞추고, 흰 원은 그 아래
function getSymbolTools() {
  let f = getForm();
  let cx = f.fx + f.fw + symbolToolGap + blackW / 2;
  return {
    bx: cx,
    by: f.row2 + blackH / 2,
    ex: cx,
    ey: f.row2 + blackH / 2 + rowGap,
  };
}

//큰 박스에 새 선 만들기: 펜이면 검은 선(20), 지우개면 흰 선(40)
function newSymbolStroke(pts) {
  let st = {
    size: symbolTool === "pen" ? symbolSize : symbolEraserSize,
    col: symbolTool === "pen" ? 0 : 255,
    pts: pts,
  };
  symbolStrokes.push(st);
  return st;
}

//큰 박스(오른쪽 아래) 영역 안인지
function isInsideBigBox() {
  let f = getForm();
  return isInside(f.fx, f.row2, f.fx + f.fw, f.row2 + f.bigH);
}

//두 번째 화면에서 누른 곳에 따라 동작
//제목 칸은 입력창을 직접 누르면 됨
function pressScreen2() {
  let t = getSymbolTools();
  let n = getNextArea();
  if (isInside(n.l, n.t, n.r, n.b)) {
    //done 버튼을 누르면 저장하고 창 닫기 (수정 중이면 수정사항을 반영하고 보기 창으로 돌아감)
    if (editIdx !== -1) {
      finishEdit(true);
    } else {
      finishMemo();
    }
  } else if (
    isInside(
      t.bx - blackW / 2,
      t.by - blackH / 2,
      t.bx + blackW / 2,
      t.by + blackH / 2,
    )
  ) {
    //검은 사각형을 누르면 펜
    symbolTool = "pen";
  } else if (dist(mouseX, mouseY, t.ex, t.ey) < eraserCircleSize / 2) {
    //흰 원을 누르면 지우개
    symbolTool = "eraser";
  } else if (isInsideBigBox()) {
    //큰 박스 안을 누르면 새 선 시작 (펜이면 검은 선, 지우개면 흰 선)
    symbolDrawing = true;
    symbolCurrent = newSymbolStroke([{ x: mouseX, y: mouseY }]);
  }
}

//첫 번째 화면에서 누른 곳에 따라 동작
function pressScreen1() {
  let pen = getSlider(sliderMarginTop, knobT);
  let eraser = getSlider(sliderMarginTop + rowGap, eraserT);
  let btn = getButtons();
  let n = getNextArea();
  let ed = getEditDoneArea();
  if (editIdx !== -1 && isInside(ed.l, ed.t, ed.r, ed.b)) {
    //수정 중에 done을 누르면 그림 수정사항을 반영하고 보기 창으로 돌아감
    finishEdit(false);
  } else if (dist(mouseX, mouseY, pen.kx, pen.cy) < knobSize / 2 + 4) {
    //펜 원을 잡으면 드래그 시작 (잡기 쉽게 +4만큼 여유)
    draggingKnob = true;
  } else if (dist(mouseX, mouseY, eraser.kx, eraser.cy) < knobSize / 2 + 4) {
    //지우개 원을 잡으면 드래그 시작
    draggingEraser = true;
  } else if (
    isInside(
      btn.bx - blackW / 2,
      btn.by - blackH / 2,
      btn.bx + blackW / 2,
      btn.by + blackH / 2,
    )
  ) {
    //검은 사각형을 누르면 펜
    tool = "pen";
  } else if (dist(mouseX, mouseY, btn.ex, btn.ey) < eraserCircleSize / 2) {
    //흰 원을 누르면 지우개
    tool = "eraser";
  } else if (isInside(n.l, n.t, n.r, n.b)) {
    //next 버튼을 누르면 두 번째 화면으로 (움직임 없이 바로 바뀜)
    screen = 2;
  } else if (isInsideMemo()) {
    //사각형 안을 누르면 새 선 시작 (펜이면 검은 선, 지우개면 흰 선)
    drawing = true;
    currentStroke = newStroke([{ x: mouseX, y: mouseY }]);
  }
}

function mouseDragged() {
  //홈 화면 페이지 끌기: 손가락(마우스)을 따라 페이지가 움직임
  if (pageDrag !== null) {
    pageDragMove();
    return;
  }
  if (healDrag !== null) {
    if (healDrag.done !== true) healDragMove();
    return;
  }
  if (symbolDrawing === true) {
    if (isInsideBigBox()) {
      //밖으로 나갔다가 다시 들어오면 새 선으로 시작
      if (symbolCurrent === null) {
        symbolCurrent = newSymbolStroke([]);
      }
      symbolCurrent.pts.push({ x: mouseX, y: mouseY });
    } else {
      symbolCurrent = null;
    }
    return;
  }
  if (draggingKnob === true) {
    //펜 원을 좌우로 움직이면 펜 두께가 바뀜
    let s = getSlider(sliderMarginTop, knobT);
    knobT = constrain(map(mouseX, s.minX, s.maxX, 0, 1), 0, 1);
    penSize = lerp(penMin, penMax, knobT);
    return;
  }
  if (draggingEraser === true) {
    //지우개 원을 좌우로 움직이면 지우개 크기가 바뀜
    let s = getSlider(sliderMarginTop + rowGap, eraserT);
    eraserT = constrain(map(mouseX, s.minX, s.maxX, 0, 1), 0, 1);
    eraserSize = lerp(eraserMin, eraserMax, eraserT);
    return;
  }
  if (drawing === false) return;
  if (isInsideMemo()) {
    //밖으로 나갔다가 다시 들어오면 새 선으로 시작
    if (currentStroke === null) {
      currentStroke = newStroke([]);
    }
    currentStroke.pts.push({ x: mouseX, y: mouseY });
  } else {
    currentStroke = null;
  }
}

function mouseReleased() {
  //페이지를 끌다 놓았을 때: 충분히 끌었거나 빠르게 쓸었으면 그 페이지로 넘어가고(끌던 위치에서 이어서), 아니면 제자리로 돌아옴
  if (pageDrag !== null) {
    let pd = pageDrag;
    pageDrag = null;
    if (pd.active === true) {
      let dx = mouseX - pd.sx;
      let nb = dx < 0 ? curPage + 1 : curPage - 1;
      let far = Math.abs(dx) >= width * PAGE_DRAG_RATIO;
      let flick =
        Math.abs(pd.vx) >= PAGE_FLICK_SPEED &&
        Math.abs(dx) >= 30 &&
        pd.vx * dx > 0;
      if (slideFrom >= 0 && nb === slideFrom && (far || flick)) {
        changePage(nb, pageSlide - slideDir * width);
      }
      return;
    }
  }
  //버튼을 누르고 있었다면: 같은 버튼 위에서 뗐을 때만 실행
  if (pressedBtn !== null) {
    let id = pressedBtn;
    pressedBtn = null;
    if (touches.length < 2 && btnAtMouse() === id) handlePress();
    return;
  }
  if (healDrag !== null) {
    let hd = healDrag;
    healDrag = null;
    if (hd.moved === false) {
      //드래그 없이 눌렀다 뗐으면 클릭: 보기 창 열기 (아직 커진 상태이고 심볼 위일 때만)
      let fr = getFocusRect();
      if (
        focusIdx === hd.idx &&
        focusOpen === true &&
        focusAmt > 0.98 &&
        isInside(fr.l, fr.t, fr.l + fr.w, fr.t + fr.h)
      ) {
        openView(hd.idx);
      }
    }
    //부분 복구는 저장하지 않음 (심볼을 작게 닫을 때 되돌아감). 전체 복구(10%)만 restoreMemo에서 저장됨
    return;
  }
  drawing = false;
  draggingKnob = false;
  draggingEraser = false;
  currentStroke = null;
  symbolDrawing = false;
  symbolCurrent = null;
}

// ───────────────── 파도 인터랙션 ─────────────────
// 브라우저 창을 처음 열었을 때(새로고침 포함) 화면 위에서 아래로 파도가 한 번 지나감
// 점은 심볼 알갱이와 똑같이 그림: 같은 크기(홈 화면 칸 안 심볼 알갱이 지름)의 검은 원, 테두리는 심볼 알갱이처럼 부드럽게 (안티앨리어싱)
// 진하기는 점이 빽빽한지 성긴지로만 표현함
// 점은 제자리에서 나타났다 사라지지 않고, 앞머리가 닿으면 파도와 함께 아래로 움직임 (점마다 속도가 달라 앞머리에서 뒤로 흘러 퍼짐)
// 파도는 심볼 위, memo 버튼(흰색으로 채워진 사각형) 아래에 그려짐
//
// 끊기지 않게 하려고 한 일:
// 1) 점을 위에서 아래(y) 순서로 정렬해 두고, 지금 파도가 걸쳐 있는 높이의 점만 검사함 (이미 지나갔거나 아직 안 온 점은 검사 자체를 안 함)
// 2) 점마다 객체를 만들지 않고 숫자 배열(Float32Array)에 담아서 계산이 빠름
// 3) 점마다 그리기 명령을 부르지 않고, 화면 픽셀 배열(ImageData)에 미리 만들어 둔 원 모양을 찍은 뒤 한 번에 올림
//    (점이 몇만 개여도 그리기 호출은 프레임당 한 번, 파도가 걸친 높이 줄만 올림)
//창 크기에 맞춰 점 크기 조정: 창이 DOT_REF_W x DOT_REF_H일 때 지정한 크기 그대로이고, 창이 작아지면 점도 같은 비율로 작아짐
//(점이 작아진 만큼 개수를 늘려서 진하기는 그대로 유지. 심볼 점과 같은 방식)
const DOT_REF_W = 1440; //점 크기의 기준 창 너비 (px)
const DOT_REF_H = 900; //점 크기의 기준 창 높이 (px)
const DOT_SCALE_MIN = 0.3; //점이 줄어드는 한계 비율
const DOT_SCALE_MAX = 2; //점이 커지는 한계 비율
function dotScaleNow() {
  return constrain(
    Math.min(width / DOT_REF_W, height / DOT_REF_H),
    DOT_SCALE_MIN,
    DOT_SCALE_MAX,
  );
}
let waveDotScale = 1; //파도 점을 만들 때의 점 크기 비율

const WAVE_CYCLE = 12000; //들어와서 반대편으로 완전히 빠지는 총 시간(ms)
const WAVE_LAG = 0.3; //꼬리가 앞머리를 따라오는 지연 (클수록 파도 폭이 넓음)
const WAVE_START = -0.45; //출발 위치 (화면 밖, 화면 높이 비율)
const WAVE_END = 1.45; //도착 위치 (화면 밖)
const WAVE_ROW = 4; //경계를 계산하는 간격(px)
const WAVE_AREA_PER_DOT = 6; //점 하나가 맡는 화면 넓이(px²). 작을수록 점이 많음 (예전: 16, 8)
const WAVE_MAX_DOTS = 220000; //점 개수 상한
const WAVE_TAIL_KEEP = 0.04; //맨 뒤(앞머리에서 가장 먼 곳)에서 남는 점의 비율 (작을수록 뒷머리가 성김, 이전: 0.3)
const WAVE_TAIL_CURVE = 0.7; //1보다 작을수록 앞머리에서 조금만 멀어져도 빨리 성겨짐 (1이면 일정하게)
const WAVE_FRONT_EXTRA = 1.0; //앞머리에서만 쓰는 덧점 개수 (기본 점 개수의 몇 배인지). 클수록 앞머리가 훨씬 빽빽함, 0이면 덧점 없음
const WAVE_FRONT_ZONE = 0.05; //덧점이 나타나는 앞머리 안쪽 두께 (화면 높이 비율). 이 안에서 앞머리에 가까울수록 덧점이 많이 그려짐
const WAVE_FRONT_FALL = 1.2; //덧점이 앞머리에서 멀어지며 줄어드는 정도 (클수록 앞머리 바로 앞에만 몰림)
const WAVE_FRONT_FILL = 0.9; //앞머리에서 점을 남기는 기본 비율의 바닥 (클수록 앞머리가 거의 빈틈없이 빽빽함, 이전: 0.6)
//점이 움직이는 방식: 앞머리가 점의 원래 자리를 지나간 거리(ahead)만큼, 점마다 정해진 비율(FLOW_MIN~FLOW_MAX)로 같이 아래로 따라감
//비율이 1에 가까우면 앞머리에 붙어서 가고, 작으면 앞머리에서 뒤로 처짐 (그래서 앞머리는 빽빽하고 뒤로 흘러 퍼짐)
const WAVE_FLOW_MIN = 0.35;
const WAVE_FLOW_MAX = 0.95;
//옆으로 일렁이는 정도: 앞머리에서 멀수록 커지고(최대 SWAY_MAX px), 점마다 박자가 달라 흩날리는 느낌이 남
const WAVE_SWAY_RATE = 0.03;
const WAVE_SWAY_MAX = 14;
const WAVE_SWAY_SPEED = 2.2;
//점 지름(px): 홈 화면 칸 안 심볼 알갱이와 같음 (sandDotR x 2 x homeDotRatio). 파도 점도 배경 점도 모두 같은 크기, 파도가 지나가는 동안 변하지 않음
const WAVE_DOT_DIAMETER = sandDotR * 2 * homeDotRatio;
let waveN = 0; //점 개수
let waveX = null; //점마다 원래 x, y 순서로 정렬되어 있음
let waveY = null; //점마다 원래 y
let waveCol = null; //점마다 가로 줄 번호 (x / WAVE_ROW)
let waveR = null; //고정 랜덤값: 점이 나타나는 순서를 결정
let waveR2 = null; //고정 랜덤값: 앞머리에서 멀어질 때 점이 성겨지는 순서를 결정
let waveLace = null; //고정된 거품 결
let waveK = null; //점마다 파도를 따라가는 비율 (WAVE_FLOW_MIN~MAX)
let waveP = null; //점마다 일렁임 박자
let waveEN = 0; //앞머리 덧점 개수 (덧점은 앞머리 근처에서만 그려지고, 위에서 아래로 정렬되어 있어서 그 높이만 검사함)
let waveEX = null;
let waveEY = null;
let waveECol = null;
let waveER2 = null;
let waveEK = null;
let waveEP = null;
let waveMask = null; //점 모양 (안티앨리어싱 된 원, 소수점 위치별 16가지): { n, R, masks }
let waveBuf = null; //픽셀을 찍어 두는 화면 크기 버퍼: { c, cx, img, u32, W, H, pd, prevLo, prevHi }
//pow, exp는 점마다 매 프레임 부르면 느려서 미리 계산해 둔 표로 대신함
let wavePowTab = null; //far(0~1) -> pow(far, WAVE_TAIL_CURVE)
let waveExpTab = null; //ahead / fade (0~8) -> exp(-값)
const WAVE_EXP_RES = 64; //표 한 칸이 나타내는 간격의 역수
function waveMakeTables() {
  wavePowTab = new Float32Array(257);
  for (let i = 0; i <= 256; i++)
    wavePowTab[i] = Math.pow(i / 256, WAVE_TAIL_CURVE);
  waveExpTab = new Float32Array(8 * WAVE_EXP_RES + 2);
  for (let i = 0; i < waveExpTab.length; i++)
    waveExpTab[i] = Math.exp(-i / WAVE_EXP_RES);
}
let waveFront = []; //줄마다 앞머리 위치
let waveTail = []; //줄마다 꼬리 위치
let waveStart = 0; //파도가 시작된 시각(millis)
let waveRunning = false;
let waveBuiltW = 0; //점들을 만들 때의 창 크기 (창 크기가 바뀌면 다시 만듦)
let waveBuiltH = 0;

//점 모양 만들기: 심볼 알갱이처럼 가장자리가 부드러운 검은 원. 점이 놓이는 위치의 소수점(1/4 픽셀 단위)마다 따로 만들어 둠
//(그래서 점이 움직여도 가장자리가 흔들리거나 번지지 않고, 어느 위치에 있어도 같은 모양)
const WAVE_SUBPIX = 4;
function waveMakeMask(diameter) {
  const pd = pixelDensity();
  const R = Math.max(0.35, (diameter * pd) / 2); //실제 픽셀 단위 반지름
  const n = Math.ceil(2 * R) + 2;
  const S = 4; //한 픽셀을 4x4로 쪼개서 원이 차지하는 비율(0~255)을 계산
  const masks = [];
  for (let qy = 0; qy < WAVE_SUBPIX; qy++) {
    for (let qx = 0; qx < WAVE_SUBPIX; qx++) {
      const cx = qx / WAVE_SUBPIX + R; //마스크 안에서 원 중심
      const cy = qy / WAVE_SUBPIX + R;
      const m = new Uint8Array(n * n);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          let inside = 0;
          for (let sy = 0; sy < S; sy++) {
            for (let sx = 0; sx < S; sx++) {
              const dx = x + (sx + 0.5) / S - cx;
              const dy = y + (sy + 0.5) / S - cy;
              if (dx * dx + dy * dy <= R * R) inside++;
            }
          }
          m[y * n + x] = Math.round((inside / (S * S)) * 255);
        }
      }
      masks.push(m);
    }
  }
  return { n: n, R: R, masks: masks };
}

//중심이 (cxd, cyd) (실제 픽셀 좌표)인 점을 버퍼에 찍음. 겹치는 곳은 더 진한 쪽을 남김 (심볼 알갱이처럼 겹쳐도 더 진해지지 않음)
function waveStamp(u32, W, H, mk, cxd, cyd) {
  const left = cxd - mk.R;
  const top = cyd - mk.R;
  const ix = Math.floor(left);
  const iy = Math.floor(top);
  const n = mk.n;
  if (ix < 0 || iy < 0 || ix + n > W || iy + n > H) return;
  const qx = ((left - ix) * WAVE_SUBPIX) | 0;
  const qy = ((top - iy) * WAVE_SUBPIX) | 0;
  const m = mk.masks[qy * WAVE_SUBPIX + qx];
  for (let jy = 0; jy < n; jy++) {
    const row = (iy + jy) * W + ix;
    const mr = jy * n;
    for (let jx = 0; jx < n; jx++) {
      const a = m[mr + jx];
      if (a !== 0 && a > u32[row + jx] >>> 24) u32[row + jx] = a << 24; //검정(0,0,0)에 알파만 a
    }
  }
}

//화면 크기(실제 픽셀)의 버퍼 만들기
function waveMakeBuf() {
  const pd = pixelDensity();
  const W = Math.max(1, Math.round(width * pd));
  const H = Math.max(1, Math.round(height * pd));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const cx = c.getContext("2d");
  const img = cx.createImageData(W, H);
  return {
    c: c,
    cx: cx,
    img: img,
    u32: new Uint32Array(img.data.buffer),
    W: W,
    H: H,
    pd: pd,
    prevLo: 0,
    prevHi: 0,
  };
}

//파도 점 만들기 (위치, 나타나는 순서, 진하기 순서, 거품 결, 따라가는 비율, 일렁임 박자는 모두 고정)
function waveBuild() {
  const ds = dotScaleNow(); //창이 작을수록 점이 작아지고, 같은 진하기를 위해 개수는 비율의 제곱만큼 늘어남
  waveDotScale = ds;
  const n = Math.min(
    WAVE_MAX_DOTS,
    Math.floor((width * height) / (WAVE_AREA_PER_DOT * ds * ds)),
  );
  const list = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = random(width);
    const y = random(height);
    list[i] = {
      x: x,
      y: y,
      r: random(),
      r2: random(),
      lace: noise((x / ds) * 0.012, (y / ds) * 0.012), //거품 결 크기도 창 크기에 비례
      k: random(WAVE_FLOW_MIN, WAVE_FLOW_MAX),
      p: random(Math.PI * 2),
    };
  }
  list.sort((a, b) => a.y - b.y); //위에서 아래 순서로 정렬: 파도가 걸친 높이만 빠르게 찾기 위해
  waveN = n;
  waveX = new Float32Array(n);
  waveY = new Float32Array(n);
  waveCol = new Int32Array(n);
  waveR = new Float32Array(n);
  waveR2 = new Float32Array(n);
  waveLace = new Float32Array(n);
  waveK = new Float32Array(n);
  waveP = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = list[i];
    waveX[i] = d.x;
    waveY[i] = d.y;
    waveCol[i] = (d.x / WAVE_ROW) | 0;
    waveR[i] = d.r;
    waveR2[i] = d.r2;
    waveLace[i] = d.lace;
    waveK[i] = d.k;
    waveP[i] = d.p;
  }
  //앞머리 덧점: 앞머리 근처에서만 추가로 그려서 앞머리를 훨씬 빽빽하게 만드는 점들
  const ne = Math.floor(n * WAVE_FRONT_EXTRA);
  const el = new Array(ne);
  for (let i = 0; i < ne; i++) {
    el[i] = {
      x: random(width),
      y: random(height),
      r2: random(),
      k: random(WAVE_FLOW_MIN, WAVE_FLOW_MAX),
      p: random(Math.PI * 2),
    };
  }
  el.sort((a, b) => a.y - b.y);
  waveEN = ne;
  waveEX = new Float32Array(ne);
  waveEY = new Float32Array(ne);
  waveECol = new Int32Array(ne);
  waveER2 = new Float32Array(ne);
  waveEK = new Float32Array(ne);
  waveEP = new Float32Array(ne);
  for (let i = 0; i < ne; i++) {
    waveEX[i] = el[i].x;
    waveEY[i] = el[i].y;
    waveECol[i] = (el[i].x / WAVE_ROW) | 0;
    waveER2[i] = el[i].r2;
    waveEK[i] = el[i].k;
    waveEP[i] = el[i].p;
  }
  waveMask = waveMakeMask(WAVE_DOT_DIAMETER * ds);
  waveMakeTables();
  waveBuf = waveMakeBuf();
  waveBuiltW = width;
  waveBuiltH = height;
}

function waveStartNow() {
  noiseSeed(7);
  waveBuild();
  washBegin(); //이 파도에 휩쓸릴 심볼 알갱이들을 정함
  waveStart = millis();
  waveRunning = true;
}

const waveEase = (x) => -(Math.cos(Math.PI * x) - 1) / 2;

//q: 0~1 진행도 → 화면 비율 위치
function wavePos(q) {
  return lerp(WAVE_START, WAVE_END, waveEase(constrain(q, 0, 1)));
}

//경계의 모양: 크기가 다른 노이즈 3겹을 섞어서 규칙성을 없앰
//pow()로 앞으로 튀어나온 곳은 뾰족한 혀처럼, 들어간 곳은 완만하게 만듦
function waveEdgeOffset(y, t, seed) {
  //p5의 noise()는 음수 좌표를 거울처럼 접기 때문에 항상 양수로 유지
  const Y = y + 10000;
  //층마다 세기가 시간에 따라 커졌다 작아짐 (어떤 때는 혀가 솟고, 어떤 때는 잠잠해짐)
  const k = (v) => constrain(0.5 + (v - 0.5) * 3, 0.15, 1.6);
  const am = k(noise(t * 0.12, seed + 300));
  const bm = k(noise(t * 0.2, seed + 400));
  const cm = k(noise(t * 0.3, seed + 500));
  //층마다 앞머리를 따라 다른 속도와 방향으로 흘러가서 굴곡이 제자리에 있지 않음
  const a = noise((Y - t * 25) * 0.0015 + seed, t * 0.12); //큰 굽이
  const b = noise((Y + t * 60) * 0.006 + seed + 10, t * 0.35 + 5); //중간 혀
  const c = noise((Y - t * 90) * 0.022 + seed + 20, t * 0.7 + 9); //잔 물결
  return (
    (Math.pow(a, 1.6) - 0.3) * am +
    (Math.pow(b, 2.0) - 0.25) * 0.55 * bm +
    (c - 0.5) * 0.18 * cm
  );
}

//파도 한 프레임 그리기 (draw에서 심볼을 그린 뒤, memo 사각형을 그리기 전에 부름)
function drawWave() {
  if (waveRunning === false) return;
  const p = ((millis() - waveStart) / WAVE_CYCLE) * (1 + WAVE_LAG);
  if (p >= 1 + WAVE_LAG) {
    waveRunning = false;
    waveX = waveY = waveCol = waveR = waveR2 = waveLace = waveK = waveP = null; //끝나면 메모리 반납
    waveEX = waveEY = waveECol = waveER2 = waveEK = waveEP = null;
    waveEN = 0;
    waveMask = null;
    wavePowTab = waveExpTab = null;
    waveBuf = null;
    waveN = 0;
    washEnd(); //아직 남은 알갱이/물리 몸체 정리
    return;
  }
  //창 크기가 바뀌고 멈췄으면 점을 새 크기에 맞게 다시 만듦
  if (
    (waveBuiltW !== width || waveBuiltH !== height) &&
    millis() - lastResizeMs > 200
  ) {
    waveBuild();
  }

  const t = millis() * 0.001;
  const L = height; //파도가 달리는 거리 (위 -> 아래)
  const F = wavePos(p) * L; //앞머리
  const T = wavePos(p - WAVE_LAG) * L; //꼬리

  //파도가 달려가는 중간에 가장 거칠게 부서지고, 들어올 때와 나갈 때는 비교적 잔잔함
  const prog = constrain(p / (1 + WAVE_LAG), 0, 1);
  const amp = L * (0.12 + 0.12 * Math.sin(Math.PI * prog)); //경계가 튀어나오고 들어가는 폭
  const spray = L * 0.02; //앞머리 앞쪽으로 점이 흩날리는 폭
  const fade = L * 0.07; //앞머리에서 진하기가 옅어지는 거리
  const reach = L * 0.55; //이 거리까지 가면 점이 가장 성겨짐
  const tailSoft = L * 0.18; //꼬리 쪽에서 점이 서서히 사라지는 폭

  //경계는 줄마다 한 번만 계산 (줄은 가로 방향). 동시에 파도가 걸친 높이 범위도 구함
  const rows = Math.ceil(width / WAVE_ROW) + 1;
  let lowY = Infinity; //꼬리가 가장 위로 간 곳
  let highY = -Infinity; //앞머리가 가장 아래로 간 곳
  let lowF = Infinity; //앞머리가 가장 위로 간 곳 (덧점이 걸친 높이 범위 계산용)
  for (let i = 0; i < rows; i++) {
    const x = i * WAVE_ROW;
    const f = F + waveEdgeOffset(x, t, 0) * amp;
    const tl = T + waveEdgeOffset(x, t * 0.8, 77) * amp * 1.4;
    waveFront[i] = f;
    waveTail[i] = tl;
    if (tl < lowY) lowY = tl;
    if (f > highY) highY = f;
    if (f < lowF) lowF = f;
  }
  washStep(F, rows); //앞머리에 닿은 알갱이를 물리엔진 몸체로 바꾸고 파도에 실어 보냄
  highY += spray;
  if (highY < 0 || lowY > height) return; //파도가 화면 밖에 있음

  //정렬된 y에서 [lowY, highY] 구간의 시작과 끝을 이진 탐색으로 찾음
  let lo = 0;
  let hi = waveN;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (waveY[mid] < lowY) lo = mid + 1;
    else hi = mid;
  }
  const first = lo;
  hi = waveN;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (waveY[mid] <= highY) lo = mid + 1;
    else hi = mid;
  }
  const last = lo;

  //지난 프레임에 찍은 줄을 비우고 이번 프레임 점을 찍음 (파도가 걸친 높이의 줄만 다룸)
  const B = waveBuf;
  const pd = B.pd;
  const u32 = B.u32;
  const W = B.W;
  const H = B.H;
  if (B.prevHi > B.prevLo) u32.fill(0, B.prevLo * W, B.prevHi * W);
  const mk = waveMask;
  const swayT = t * WAVE_SWAY_SPEED;
  for (let k = first; k < last; k++) {
    const i = waveCol[k];
    if (i >= rows) continue; //창이 줄어든 경우
    const y0 = waveY[k]; //점의 원래 자리
    const ahead = waveFront[i] - y0; //앞머리가 원래 자리를 지나간 거리
    const past = y0 - waveTail[i]; //꼬리 앞쪽에 남은 거리
    if (ahead < -spray || past < 0) continue; //아직 안 왔거나, 이미 지나간 곳

    //앞머리 앞쪽은 점이 드문드문 흩날리다가 경계 안쪽에서 촘촘해짐 (칼로 자른 듯한 선 방지)
    let edgeRamp = (ahead + spray) / (spray * 1.5);
    if (edgeRamp > 1) edgeRamp = 1;
    //뒤로 갈수록 성기게 + 꼬리에 가까울수록 더 성기게 흩어짐
    let tailRamp = past / tailSoft;
    if (tailRamp > 1) tailRamp = 1;
    let far = ahead / reach;
    far = far < 0 ? 0 : far > 1 ? 1 : far;
    //앞머리 쪽은 거의 모든 점을 남기고(빽빽), 뒤로 갈수록 WAVE_TAIL_KEEP까지 빠르게 줄어듦(성김)
    const keep =
      (1.0 - (1.0 - WAVE_TAIL_KEEP) * wavePowTab[(far * 256) | 0]) *
      (WAVE_FRONT_FILL + 0.5 * waveLace[k]) *
      tailRamp *
      edgeRamp *
      edgeRamp;
    if (waveR[k] > keep) continue;

    //앞머리에 가까울수록 빽빽하게: 회색으로 옅게 하지 않고, 점을 일부만 그려서 성기게 함
    let fu = ahead > 0 ? (ahead / fade) * WAVE_EXP_RES : 0;
    if (fu > 8 * WAVE_EXP_RES) fu = 8 * WAVE_EXP_RES;
    const foam = waveExpTab[fu | 0];
    if (waveR2[k] > 0.1 + 0.9 * foam) continue;

    //점이 움직임: 앞머리가 지나간 거리(ahead)의 일부(k)만큼 같이 아래로 내려가고, 옆으로 일렁임
    let x = waveX[k];
    let y = y0;
    if (ahead > 0) {
      y += ahead * waveK[k];
      let sw = ahead * WAVE_SWAY_RATE;
      if (sw > WAVE_SWAY_MAX) sw = WAVE_SWAY_MAX;
      x += Math.sin(swayT + waveP[k]) * sw;
    }
    waveStamp(u32, W, H, mk, x * pd, y * pd);
  }

  //앞머리 덧점: 앞머리 안쪽 두께(zone) 안에서만, 앞머리에 가까울수록 많이 그림
  if (waveEN > 0) {
    const zone = L * WAVE_FRONT_ZONE;
    const eLow = lowF - spray;
    let a = 0;
    let b = waveEN;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (waveEY[mid] < eLow - zone) a = mid + 1;
      else b = mid;
    }
    const e0 = a;
    b = waveEN;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (waveEY[mid] <= highY) a = mid + 1;
      else b = mid;
    }
    const e1 = a;
    for (let k = e0; k < e1; k++) {
      const i = waveECol[k];
      if (i >= rows) continue;
      const y0 = waveEY[k];
      const ahead = waveFront[i] - y0;
      if (ahead < -spray || ahead > zone) continue;
      let edgeRamp = (ahead + spray) / (spray * 1.5);
      if (edgeRamp > 1) edgeRamp = 1;
      const inside = ahead > 0 ? 1 - ahead / zone : 1; //앞머리에 가까울수록 1
      const dense = edgeRamp * edgeRamp * Math.pow(inside, WAVE_FRONT_FALL);
      if (waveER2[k] > dense) continue;
      let x = waveEX[k];
      let y = y0;
      if (ahead > 0) {
        y += ahead * waveEK[k];
        let sw = ahead * WAVE_SWAY_RATE;
        if (sw > WAVE_SWAY_MAX) sw = WAVE_SWAY_MAX;
        x += Math.sin(swayT + waveEP[k]) * sw;
      }
      waveStamp(u32, W, H, mk, x * pd, y * pd);
    }
  }

  //올릴 줄 범위: 이번 프레임 + 지난 프레임 (지난 프레임 점을 지운 줄도 같이 올려야 함)
  const r0 = Math.max(0, Math.floor(lowY * pd) - 2);
  const r1 = Math.min(B.H, Math.ceil(highY * pd) + 4 * Math.ceil(pd) + 2);
  const up0 = Math.min(r0, B.prevHi > B.prevLo ? B.prevLo : r0);
  const up1 = Math.max(r1, B.prevHi > B.prevLo ? B.prevHi : r1);
  B.prevLo = r0;
  B.prevHi = r1;
  if (up1 <= up0) return;
  B.cx.putImageData(B.img, 0, 0, 0, up0, W, up1 - up0);
  //버퍼의 실제 픽셀을 화면에 1:1로 겹쳐 붙임 (캔버스에 걸린 배율 때문에 높이/너비를 pd로 나눔)
  const ctx = drawingContext;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    B.c,
    0,
    up0,
    W,
    up1 - up0,
    0,
    up0 / pd,
    W / pd,
    (up1 - up0) / pd,
  );
  ctx.restore();
}

// ───────────────── 배경 모래 점 ─────────────────
// 흰 배경 위에 검은 원을 성기게, 뭉친 곳과 흩어진 곳이 섞이게 깔아 둠 (모래가 흩뿌려진 것처럼)
// 한 번만 그려서 버퍼에 저장해 두고, 매 프레임 그 그림 한 장만 붙임 (점이 많아도 가벼움)
// 점은 파도·심볼 알갱이와 똑같은 모양과 크기의 검은 원. 파도, 심볼, memo 버튼은 모두 이 위에 그려짐
const BG_AREA_PER_CANDIDATE = 50; //후보 점 하나가 맡는 화면 넓이(px²). 작을수록 점이 많아짐
const BG_NOISE_SCALE = 0.0035; //뭉침 덩어리의 크기 (작을수록 덩어리가 큼)
const BG_SPARSE = 0.4; //전체 성긴 정도: 후보 중 점이 되는 최대 비율 (작을수록 성김)
const BG_CONTRAST = 2.2; //클수록 뭉친 곳과 빈 곳의 차이가 커짐 (불규칙한 정도)
const BG_SCATTER = 0.045; //덩어리와 상관없이 아무 곳에나 드문드문 흩어지는 점의 비율
const BG_CLUMP_MAX = 6; //점 하나 옆에 붙는 알갱이 수의 최대 (뭉친 느낌)
const BG_CLUMP_R = 9; //붙는 알갱이가 퍼지는 거리(px)
let bgBuf = null; //배경 점을 그려 둔 화면 크기 버퍼 { c, W, H, pd }
let bgBuiltW = 0;
let bgBuiltH = 0;
//세 손가락으로 쓸면 배경 점이 쓴 방향으로 밀려 움직이도록, 점마다 위치/속도를 따로 들고 있음
let bgN = 0;
let bgX = null; //점 위치
let bgY = null;
let bgVX = null; //점 속도 (px/프레임)
let bgVY = null;
let bgG = null; //점마다 손가락에 밀리는 정도 (제각각이라 불규칙하게 움직임)
let bgMoving = false; //지금 움직이는 점이 있는지 (움직일 때만 다시 그림)
let bgCx = null;
let bgImg = null;
let bgU32 = null;
let bgMask = null;
const BG_PUSH_R = 130; //손가락 주변 이 거리(px) 안의 점이 밀림 (창 크기 비율에 맞춰짐)
const BG_PUSH_GAIN = 0.3; //손가락 속도에 곱하는 세기 (클수록 멀리 밀림)
const BG_JITTER = 0.5; //밀릴 때 옆으로 어긋나는 정도 (클수록 불규칙)
const BG_FRICTION = 0.93; //매 프레임 속도에 곱함 (작을수록 금방 멈춤)

function bgBuild() {
  const pd = pixelDensity();
  const W = Math.max(1, Math.round(width * pd));
  const H = Math.max(1, Math.round(height * pd));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const cx = c.getContext("2d");
  const img = cx.createImageData(W, H);
  const u32 = new Uint32Array(img.data.buffer);
  const ds = dotScaleNow(); //창 크기에 맞춘 점 크기 비율 (파도 점과 같음)
  const mk = waveMakeMask(WAVE_DOT_DIAMETER * ds); //파도 점, 심볼 알갱이와 같은 모양
  //새로고침해도 같은 모양이 나오게 고정된 랜덤을 씀
  const rnd = seededRandom(20260426);
  const px = [];
  const py = [];
  const cand = Math.floor((width * height) / (BG_AREA_PER_CANDIDATE * ds * ds));
  for (let i = 0; i < cand; i++) {
    const x = rnd() * width;
    const y = rnd() * height;
    //덩어리: 노이즈가 큰 곳에서는 점이 많이 남고, 작은 곳에서는 거의 사라짐
    const nv = noise(
      (x / ds) * BG_NOISE_SCALE + 50,
      (y / ds) * BG_NOISE_SCALE + 50,
    ); //덩어리 크기도 창 크기에 비례
    const dens = Math.pow(constrain((nv - 0.25) / 0.6, 0, 1), BG_CONTRAST);
    const p = BG_SCATTER + BG_SPARSE * dens;
    if (rnd() > p) continue;
    waveStamp(u32, W, H, mk, x * pd, y * pd);
    px.push(x);
    py.push(y);
    //덩어리 안쪽일수록 옆에 알갱이가 더 붙어서 뭉친 모양이 됨
    const extra = Math.floor(rnd() * (1 + BG_CLUMP_MAX * dens));
    for (let e = 0; e < extra; e++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.abs(rnd() + rnd() - 1) * BG_CLUMP_R * ds * (0.4 + dens);
      waveStamp(
        u32,
        W,
        H,
        mk,
        (x + Math.cos(a) * r) * pd,
        (y + Math.sin(a) * r) * pd,
      );
      px.push(x + Math.cos(a) * r);
      py.push(y + Math.sin(a) * r);
    }
  }
  cx.putImageData(img, 0, 0);
  bgBuf = { c: c, W: W, H: H, pd: pd };
  bgN = px.length;
  bgX = Float32Array.from(px);
  bgY = Float32Array.from(py);
  bgVX = new Float32Array(bgN);
  bgVY = new Float32Array(bgN);
  bgG = new Float32Array(bgN);
  for (let i = 0; i < bgN; i++) bgG[i] = 0.3 + rnd() * 1.0;
  bgMoving = false;
  bgCx = cx;
  bgImg = img;
  bgU32 = u32;
  bgMask = mk;
  bgBuiltW = width;
  bgBuiltH = height;
}

//손가락(touches)이 지나간 자리의 배경 점을 손가락이 움직인 방향으로 밀어 줌 (prev: 지난 프레임 손가락 위치 { id: [x, y] })
function bgPush(prev) {
  if (bgN === 0) return;
  const R = BG_PUSH_R * dotScaleNow();
  const R2 = R * R;
  for (let ti = 0; ti < touches.length; ti++) {
    const t = touches[ti];
    const key = t.id !== undefined ? t.id : ti;
    const pv = prev[key];
    if (pv === undefined) continue;
    const fvx = t.x - pv[0];
    const fvy = t.y - pv[1];
    const sp = Math.hypot(fvx, fvy);
    if (sp < 0.5) continue;
    for (let i = 0; i < bgN; i++) {
      const dx = bgX[i] - t.x;
      if (dx > R || dx < -R) continue;
      const dy = bgY[i] - t.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const f = (1 - Math.sqrt(d2) / R) * bgG[i] * BG_PUSH_GAIN;
      //손가락 방향으로 밀리되, 점마다 옆으로 조금씩 어긋나서 불규칙하게 퍼짐
      const j = (Math.random() - 0.5) * sp * BG_JITTER;
      bgVX[i] += fvx * f - (fvy / sp) * j;
      bgVY[i] += fvy * f + (fvx / sp) * j;
    }
    bgMoving = true;
  }
}

//움직이는 점이 있으면 한 프레임 움직이고(마찰로 서서히 멈춤) 배경 그림을 다시 그림
function bgStep() {
  if (bgMoving === false || bgN === 0) return;
  let maxV = 0;
  for (let i = 0; i < bgN; i++) {
    let vx = bgVX[i];
    let vy = bgVY[i];
    if (vx === 0 && vy === 0) continue;
    let x = bgX[i] + vx;
    let y = bgY[i] + vy;
    //화면 가장자리에서는 튕겨 나오게 함
    if (x < 0) {
      x = 0;
      vx = -vx * 0.4;
    } else if (x > width) {
      x = width;
      vx = -vx * 0.4;
    }
    if (y < 0) {
      y = 0;
      vy = -vy * 0.4;
    } else if (y > height) {
      y = height;
      vy = -vy * 0.4;
    }
    vx *= BG_FRICTION;
    vy *= BG_FRICTION;
    if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) {
      vx = 0;
      vy = 0;
    }
    bgX[i] = x;
    bgY[i] = y;
    bgVX[i] = vx;
    bgVY[i] = vy;
    const m = Math.abs(vx) + Math.abs(vy);
    if (m > maxV) maxV = m;
  }
  //점을 새 위치에 다시 찍음 (파도 점과 같은 방식)
  bgU32.fill(0);
  const pd = bgBuf.pd;
  for (let i = 0; i < bgN; i++)
    waveStamp(bgU32, bgBuf.W, bgBuf.H, bgMask, bgX[i] * pd, bgY[i] * pd);
  bgCx.putImageData(bgImg, 0, 0);
  if (maxV === 0 && touches.length < SWIPE_FINGERS) bgMoving = false;
}

//배경 점 붙이기 (draw에서 background(255) 바로 뒤에 부름). 창 크기 바뀜이 멈추면 새 크기에 맞게 다시 만듦
function drawBgDots() {
  if (
    bgBuf === null ||
    ((bgBuiltW !== width || bgBuiltH !== height) &&
      millis() - lastResizeMs > 200)
  ) {
    bgBuild();
  }
  bgStep();
  const ctx = drawingContext;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bgBuf.c, 0, 0, bgBuf.W / bgBuf.pd, bgBuf.H / bgBuf.pd);
  ctx.restore();
}

// ───────────────── 파도에 휩쓸리는 심볼 알갱이 (물리엔진) ─────────────────
// 파도가 시작될 때 각 심볼(격자 칸 안)의 알갱이 중 3%(WASH_PERCENT)를 정해 둠. 나머지 97%는 물리엔진과 상관없이 제자리에 있음
// 정해진 알갱이는 파도 앞머리가 닿을 때까지 제자리에 있다가, 닿으면 Matter.js 물체가 되어 파도에 휩쓸려 아래로 떠내려가고
// 화면 밖으로 나가면 삭제됨. 사라진 알갱이는 심볼 데이터(symbol.wash = 파도 맞은 횟수)에 기록되어 새로고침해도 다시 나타나지 않음
// 시간이 지나 사라지는 것(48시간)과 따로 쌓이므로, 파도를 여러 번 맞으면 48시간보다 빨리 닳음
let washDots = []; //휩쓸릴 알갱이들 { x, y, r, body } (body가 null이면 아직 제자리)
let washLastF = null; //지난 프레임의 파도 앞머리 위치 (앞머리 속도 계산용)
let washPush = 1.0; //파도가 알갱이를 밀어 내리는 힘의 세기 (앞머리 속도에 곱함)
let washTurb = 0.7; //휩쓸릴 때 옆으로 흔들리는 정도
let washGravity = 0.0025; //중력 세기 (Matter 기본은 0.001)

function washBegin() {
  washEnd();
  engine.gravity.scale = washGravity;
  for (let m of memos) {
    if (typeof m.cell !== "number" || m.symbol === undefined) continue;
    let sym = m.symbol;
    sym.wash = (sym.wash > 0 ? sym.wash : 0) + 1; //파도를 맞은 횟수 (저장됨)
    let w0 = ((sym.wash - 1) * WASH_PERCENT) / 100;
    let w1 = (sym.wash * WASH_PERCENT) / 100;
    if (w0 >= 1) continue;
    if (pageOf(m) !== curPage) continue; //다른 페이지 메모는 횟수만 쌓이고 떠내려가는 알갱이는 보이지 않음
    //칸 안에서의 배치/크기와 점 크기: 칸 그림판을 만들 때와 똑같은 값을 써서, 그림판에서 빠진 알갱이와 같은 알갱이를 얻음
    let ds = getMemoScale(m);
    let ratio = homeDotRatio * ds;
    let tr = getCellFit(sym, getCell(m.cell), cellPad);
    let dots = makeSand(
      sym,
      tr.sc,
      1 / (ratio * ratio),
      getFadeFrac(getFadeStep(m)),
      { washRange: [w0, w1] },
    );
    let r = Math.max(0.6, sandDotR * ratio);
    for (let k = 0; k < dots.length; k += 2) {
      washDots.push({
        x: tr.ox + dots[k] * tr.sc,
        y: tr.oy + dots[k + 1] * tr.sc,
        r: r,
        body: null,
        m: m,
      });
    }
  }
  saveMemos();
}

//휩쓸리는 알갱이와 물리 몸체를 모두 치움
function washEnd() {
  for (let d of washDots) {
    if (d.body !== null) Composite.remove(engine.world, d.body);
  }
  washDots = [];
  washLastF = null;
}

//한 프레임: 앞머리에 닿은 알갱이를 물체로 만들고, 파도 안에 있는 물체는 파도가 가는 방향(아래)으로 밀고 흔듦
function washStep(F, rows) {
  if (washDots.length === 0) return;
  let vFront =
    washLastF === null ? 0 : Math.max(0, Math.min(60, F - washLastF)); //앞머리가 한 프레임에 간 거리(px)
  washLastF = F;
  let t = millis() * 0.001;
  let alive = [];
  for (let d of washDots) {
    if (d.body === null) {
      //아직 제자리: 파도 앞머리가 이 알갱이의 높이까지 내려왔으면 물체가 됨
      let col = (d.x / WAVE_ROW) | 0;
      if (col < rows && waveFront[col] >= d.y) {
        let b = Bodies.circle(d.x, d.y, d.r, {
          frictionAir: 0.02,
          friction: 0,
          restitution: 0.3,
          collisionFilter: { group: -1 }, //알갱이끼리는 부딪히지 않음 (수천 개여도 가볍게)
        });
        Body.setVelocity(b, {
          x: (random() - 0.5) * 2.0,
          y: vFront * (0.8 + random() * 0.5),
        });
        Composite.add(engine.world, b);
        d.body = b;
      }
    } else {
      let b = d.body;
      let col = Math.max(0, Math.min(rows - 1, (b.position.x / WAVE_ROW) | 0));
      let inWave =
        waveFront[col] >= b.position.y && waveTail[col] <= b.position.y;
      if (inWave) {
        //파도 안: 앞머리 속도를 따라 내려가도록 속도를 끌어당기고, 옆으로 흔들림을 줌
        let wob =
          noise(b.position.x * 0.012, b.position.y * 0.012, t * 0.8) - 0.5;
        Body.setVelocity(b, {
          x: b.velocity.x * 0.92 + wob * washTurb * 2,
          y: lerp(b.velocity.y, vFront * washPush * 1.15, 0.2),
        });
      }
    }
    //화면 아래/옆으로 완전히 나갔으면 삭제 (알갱이는 이미 심볼 데이터에서 빠져 있음)
    if (
      d.body !== null &&
      (d.body.position.y > height + 40 ||
        d.body.position.x < -40 ||
        d.body.position.x > width + 40)
    ) {
      Composite.remove(engine.world, d.body);
      continue;
    }
    alive.push(d);
  }
  washDots = alive;
}

//휩쓸릴 알갱이 그리기: 심볼 알갱이와 같은 검은 원 (제자리인 것은 원래 자리에, 휩쓸린 것은 물체 위치에)
function drawWashDots() {
  if (washDots.length === 0) return;
  let ctx = drawingContext;
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  for (let d of washDots) {
    if (
      d.body === null &&
      (focusIdx !== -1 || homeHold === true || homeFadeStart >= 0)
    )
      continue; //심볼을 크게 보는 중에는 칸 안 알갱이를 그리지 않음
    let x = d.body === null ? d.x : d.body.position.x;
    let y = d.body === null ? d.y : d.body.position.y;
    ctx.moveTo(x + d.r, y);
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

// ───────────────── 세 손가락으로 쓸어서 메모 삭제 ─────────────────
// 심볼이 크게 커진 상태에서 손가락 3개로 화면을 쓸면, 심볼 알갱이가 모래처럼 불규칙하게 흩어지며 사라지고 그 메모의 데이터가 삭제됨
// 수업 코드처럼 p5의 touches 배열(화면에 닿은 손가락 목록)을 매 프레임 확인함. 터치 화면에서만 동작 (마우스는 손가락 1개)
// 알갱이 수천 개를 가볍게 움직이려고 물리엔진 물체 대신 숫자 배열로 직접 움직임 (알갱이끼리 부딪히지 않으니 결과는 비슷하고 훨씬 가벼움)
const SWIPE_FINGERS = 3; //쓰는 손가락 수 (이 수 이상이 닿아 있으면 쓸기로 봄)
const SWIPE_MIN_RATIO = 0.12; //손가락 무리의 중심이 이만큼(화면 짧은 변에 대한 비율) 움직이면 쓴 것으로 인정
const SCATTER_SWEEP_MS = 600; //쓴 방향으로 알갱이가 차례로 풀려나는 데 걸리는 시간 (손이 지나가는 느낌)
const SCATTER_DIST_MIN = 25; //알갱이가 쓴 방향으로 이동하는 거리 범위 (px): 대부분 조금만, 일부만 멀리
const SCATTER_DIST_MAX = 220;
const SCATTER_SPREAD = 0.4; //이동 방향이 쓴 방향에서 벌어지는 정도 (라디안, 작을수록 쓴 방향으로 모임)
const SCATTER_WOBBLE = 6; //이동하면서 제멋대로 흔들리는 폭 (px)
const SCATTER_LIFE_MIN = 1100; //알갱이가 풀려난 뒤 사라지기까지 시간 범위 (밀리초)
const SCATTER_LIFE_MAX = 2600;
const SCATTER_HOLD = 0.25; //수명의 이 비율까지는 진하게 유지하다가 그 뒤부터 투명해짐
const SCATTER_LEVELS = 10; //투명도 단계 수 (단계마다 한 번에 그려서 가볍게 함)
let swipe = null; //쓸고 있는 손가락 정보 { sx, sy: 시작 중심, done: 이미 삭제했는지 }
let homeHold = false; //세 손가락으로 메모를 지운 뒤, 알갱이가 다 사라지고 1초가 지날 때까지 홈 화면의 심볼을 숨기고 기다리는 중인지
let homeHoldAt = 0; //기다림이 끝날 시각 (0이면 알갱이가 아직 흩어지는 중이라 정해지지 않음)
const HOME_FADE_MS = 1800; //기다림이 끝난 뒤 홈 화면의 심볼들이 서서히 진해지며 나타나는 데 걸리는 시간
let homeAlpha = 1; //홈 화면 심볼의 투명도 (메모를 지운 뒤 서서히 나타날 때만 1보다 작음)
let homeFadeStart = -1; //나타나기 시작한 시각 (-1이면 나타나는 중 아님)
const HOME_HOLD_MS = 600; //알갱이가 다 사라진 뒤 홈 화면으로 넘어가기까지 기다리는 시간
let scatter = null; //흩어지는 알갱이들 { n, r, x0, y0, tx, ty, at, life, ph, wx, wy, tau }

//매 프레임: 손가락 3개가 닿아 있는지 보고, 중심이 충분히 움직였으면 삭제
function updateSwipe() {
  if (touches.length < SWIPE_FINGERS) {
    swipe = null;
    return;
  }
  let cx = 0;
  let cy = 0;
  for (let t of touches) {
    cx += t.x;
    cy += t.y;
  }
  cx /= touches.length;
  cy /= touches.length;
  if (swipe === null) {
    swipe = { sx: cx, sy: cy, done: false, prev: {} };
    swipe.prev = bgSnapshot();
    return;
  }
  //홈 화면(아무것도 누르지 않은 상태)에서는 배경 모래를 쓴 방향으로 밀어 줌 (삭제는 아님)
  if (focusIdx === -1 && opened === false && viewClosing === false)
    bgPush(swipe.prev);
  swipe.prev = bgSnapshot();
  if (swipe.done === true) return;
  //심볼이 다 커진 상태일 때만 (그 심볼이 지워질 메모)
  if (
    focusIdx === -1 ||
    focusOpen === false ||
    focusAmt < 0.98 ||
    opened === true
  )
    return;
  let dx = cx - swipe.sx;
  let dy = cy - swipe.sy;
  let len = Math.hypot(dx, dy);
  if (len < Math.max(70, SWIPE_MIN_RATIO * Math.min(width, height))) return;
  swipe.done = true; //한 번 쓸 때 한 번만
  deleteFocusedMemo(dx / len, dy / len);
}

//지금 손가락 위치를 기억 (다음 프레임에 얼마나 움직였는지 알기 위해)
function bgSnapshot() {
  let o = {};
  for (let i = 0; i < touches.length; i++) {
    o[touches[i].id !== undefined ? touches[i].id : i] = [
      touches[i].x,
      touches[i].y,
    ];
  }
  return o;
}

//크게 보던 메모를 삭제: 알갱이를 흩어지게 하고, 메모 데이터를 지움
function deleteFocusedMemo(dirX, dirY) {
  let m = memos[focusIdx];
  if (m === undefined || m.symbol === undefined) return;
  let sym = m.symbol;
  //크게 볼 때 그려지던 알갱이와 똑같은 알갱이를 얻음 (크게 볼 때 그림판을 만들 때와 같은 값)
  let ds = getMemoScale(m);
  let tr = getFocusFit(sym);
  let dots = makeSand(sym, tr.sc, 1 / (ds * ds), getFadeFrac(getFadeStep(m)));
  let n = dots.length / 2;
  let sc = {
    n: n,
    r: Math.max(0.6, sandDotR * ds),
    x0: new Float32Array(n),
    y0: new Float32Array(n),
    tx: new Float32Array(n), //풀려난 뒤 도착할 곳까지의 이동량
    ty: new Float32Array(n),
    at: new Float32Array(n), //풀려나기 시작할 시각 (시작 기준 ms)
    life: new Float32Array(n),
    ph: new Float32Array(n), //흔들림 시작 위상
    wx: new Float32Array(n), //흔들림 방향
    wy: new Float32Array(n),
    tau: new Float32Array(n), //이동이 느려지는 정도 (작을수록 금방 멈춤)
    xs: new Float32Array(n),
    ys: new Float32Array(n),
    lv: new Int8Array(n),
    t0: millis(),
  };
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < n; k++) {
    let x = tr.ox + dots[k * 2] * tr.sc;
    let y = tr.oy + dots[k * 2 + 1] * tr.sc;
    sc.x0[k] = x;
    sc.y0[k] = y;
    let v = x * dirX + y * dirY;
    sc.ty[k] = v; //임시로 쓴 방향 위치를 담아 둠
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  let base = Math.atan2(dirY, dirX);
  for (let k = 0; k < n; k++) {
    let u = hi > lo ? (sc.ty[k] - lo) / (hi - lo) : 0;
    //풀려나는 시각: 손이 지나가는 순서 + 알갱이마다 제멋대로 늦어짐
    sc.at[k] = u * SCATTER_SWEEP_MS + Math.random() * Math.random() * 500;
    //이동 거리: 제곱해서 대부분은 짧게, 일부만 멀리
    let q = Math.random();
    let dist =
      SCATTER_DIST_MIN + q * q * q * (SCATTER_DIST_MAX - SCATTER_DIST_MIN);
    //방향: 쓴 방향을 따라가되 알갱이마다 조금씩 어긋남
    let ang = base + (Math.random() + Math.random() - 1) * SCATTER_SPREAD;
    sc.tx[k] = Math.cos(ang) * dist;
    sc.ty[k] = Math.sin(ang) * dist;
    sc.life[k] =
      SCATTER_LIFE_MIN + Math.random() * (SCATTER_LIFE_MAX - SCATTER_LIFE_MIN);
    sc.ph[k] = Math.random() * 6.2832;
    let wa = Math.random() * 6.2832;
    sc.wx[k] = Math.cos(wa) * SCATTER_WOBBLE * (0.3 + Math.random());
    sc.wy[k] = Math.sin(wa) * SCATTER_WOBBLE * (0.3 + Math.random());
    sc.tau[k] = 250 + Math.random() * 500;
  }
  scatter = sc;
  homeHold = true;
  homeHoldAt = 0;
  //메모 데이터 삭제: 심볼은 바로 사라지고(알갱이가 대신 보임) 칸도 비워짐
  releaseSand(sym);
  clearRestoreFx();
  healDrag = null;
  memos.splice(focusIdx, 1);
  focusIdx = -1;
  focusOpen = false;
  focusAmt = 0;
  saveMemos();
}

//흩어지는 알갱이 그리기: 풀려난 알갱이는 조금 이동하며 천천히 느려지고, 수명 후반에 투명해지며 사라짐
function drawScatter() {
  if (scatter === null) return;
  let sc = scatter;
  let t = millis() - sc.t0;
  let alive = 0;
  for (let k = 0; k < sc.n; k++) {
    let a = t - sc.at[k]; //풀려난 뒤 지난 시간
    let x = sc.x0[k];
    let y = sc.y0[k];
    let lv = SCATTER_LEVELS;
    if (a >= 0) {
      let u = a / sc.life[k];
      if (u >= 1) {
        sc.lv[k] = 0;
        continue;
      }
      let e = 1 - Math.exp(-a / sc.tau[k]); //빠르게 출발해서 점점 느려짐 (0~1)
      let w = Math.sin(a * 0.004 + sc.ph[k]) * e;
      x += sc.tx[k] * e + sc.wx[k] * w;
      y += sc.ty[k] * e + sc.wy[k] * w;
      if (u > SCATTER_HOLD) {
        let f = 1 - (u - SCATTER_HOLD) / (1 - SCATTER_HOLD);
        lv = Math.ceil(f * f * SCATTER_LEVELS);
      }
    }
    sc.xs[k] = x;
    sc.ys[k] = y;
    sc.lv[k] = lv;
    alive++;
  }
  if (alive === 0) {
    scatter = null;
    return;
  }
  let ctx = drawingContext;
  ctx.save();
  ctx.fillStyle = "#000000";
  let r = sc.r;
  for (let L = 1; L <= SCATTER_LEVELS; L++) {
    ctx.globalAlpha = L / SCATTER_LEVELS;
    ctx.beginPath();
    let any = false;
    for (let k = 0; k < sc.n; k++) {
      if (sc.lv[k] !== L) continue;
      ctx.moveTo(sc.xs[k] + r, sc.ys[k]);
      ctx.arc(sc.xs[k], sc.ys[k], r, 0, 6.2832);
      any = true;
    }
    if (any) ctx.fill();
  }
  ctx.restore();
}
