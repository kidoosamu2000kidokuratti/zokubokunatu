let audioCtx = null;
let customApiKey = localStorage.getItem("zokubokunatu_api_key") || "";
let cachedModelName = localStorage.getItem("zokubokunatu_model_name") || "";

const SAVE_KEY = "zokubokunatu_save_data_v2";
const deadModels404 = new Set();
let discoveredModelsCache = null;

// ====================================================
// ⏱️ 文字スピード設定（ゆっくりめ）
// ====================================================
const STORY_TEXT_SPEED = 85; // 地の文の速度
const NPC_CHAT_SPEED   = 75; // 登場人物のセリフ速度

// ====================================================
// 🖼️ 各シーンの絵の設定（拡張子を .webp 優先）
// ====================================================
const SCENE_VISUALS = {
  room: {
    name: "自分の部屋",
    candidates: ["./images/room.webp", "./room.webp", "./images/room.jpg", "./images/room.png"],
    fallback: "https://images.unsplash.com/photo-1540518614846-7ede433c457?auto=format&fit=crop&w=1000&q=80"
  },
  shop: {
    name: "店員・宮川りえ",
    candidates: ["./images/rie.webp", "./rie.webp", "./images/shop.webp", "./images/rie.jpg", "./images/rie.png"],
    fallback: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80"
  },
  cinema: {
    name: "映画館店員・ｎｉｋｋｏ",
    candidates: ["./images/nikko.webp", "./nikko.webp", "./images/cinema.webp", "./images/nikko.jpg", "./images/nikko.png"],
    fallback: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=80"
  },
  taxi: {
    name: "タクシー運転手・末広涼子",
    candidates: ["./images/suehiro.webp", "./suehiro.webp", "./images/taxi.webp", "./images/suehiro.jpg", "./images/suehiro.png"],
    fallback: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1000&q=80"
  },
  dinner_table: {
    name: "外田裕也 ＆ 危機キリン",
    candidates: ["./images/roujin.webp", "./images/uchida.webp", "./roujin.webp", "./images/roujin.jpg", "./images/roujin.png"],
    fallback: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80"
  },
  dinner_stage: {
    name: "南島五十六郎",
    candidates: ["./images/minamishima.webp", "./images/isoroku.webp", "./minamishima.webp", "./images/minamishima.jpg", "./images/minamishima.png"],
    fallback: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80"
  },
  black: {
    name: "電車移動中",
    isBlack: true
  },
  scalper: {
    name: "ダフ屋・大亀義丹",
    candidates: ["./images/gitan.webp", "./gitan.webp", "./images/couple.webp", "./images/gitan.jpg", "./images/gitan.png"],
    fallback: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1000&q=80"
  },
  titlematch: {
    name: "デヴィ武人 VS 叶姉妹",
    candidates: ["./images/titlematch.webp", "./images/match.webp", "./images/devi.webp", "./titlematch.webp", "./images/titlematch.jpg"],
    fallback: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1000&q=80"
  },
  farmer: {
    name: "叶姉妹農家",
    candidates: ["./images/farmer.webp", "./images/nouka.webp", "./farmer.webp", "./images/farmer.jpg", "./images/farmer.png"],
    fallback: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1000&q=80"
  },
  ending: {
    name: "9月1日・新学期の朝",
    candidates: ["./images/ending.webp", "./ending.webp", "./images/room.webp", "./images/ending.jpg", "./images/ending.png"],
    fallback: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1000&q=80"
  }
};

function setSceneVisual(sceneKey, overridePlateName = null) {
  const charImg = document.getElementById("char-img");
  const namePlate = document.getElementById("char-name-plate");
  const visualStage = document.getElementById("visual-stage");
  if (!charImg || !namePlate || !visualStage) return;

  const config = SCENE_VISUALS[sceneKey] || SCENE_VISUALS.room;
  namePlate.textContent = overridePlateName || config.name;

  if (config.isBlack) {
    charImg.style.display = "none";
    visualStage.style.background = "#000";
    return;
  }

  charImg.style.display = "block";
  if (config.customDataUrl) {
    charImg.src = config.customDataUrl;
    return;
  }

  let idx = 0;
  function tryNext() {
    if (idx < config.candidates.length) {
      const path = config.candidates[idx++];
      const probe = new Image();
      probe.onload = () => {
        charImg.src = path;
      };
      probe.onerror = tryNext;
      probe.src = path;
    } else {
      charImg.src = config.fallback;
    }
  }
  tryNext();
}

function triggerCharUpload() {
  const input = document.getElementById("char-upload-input");
  if (input) input.click();
}

function handleCharUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const charImg = document.getElementById("char-img");
    if (charImg) {
      charImg.src = dataUrl;
    }
    const targetKey = SCENE_VISUALS[currentScene] ? currentScene : "shop";
    SCENE_VISUALS[targetKey].customDataUrl = dataUrl;
  };
  reader.readAsDataURL(file);
}

// ====================================================
// 📱 全画面モード切替（Android Chrome / PC対応）
// ====================================================
function updateFullscreenButton() {
  const btn = document.getElementById("fullscreen-btn");
  if (!btn) return;
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  btn.innerText = isFs ? "✕ 解除" : "⛶ 全画面";
}

async function toggleFullscreen() {
  const docEl = document.documentElement;
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

  try {
    if (!isFs) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen({ navigationUI: "hide" });
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else {
        const sysMsg = document.getElementById("system-msg");
        if (sysMsg) {
          sysMsg.innerText = "※このブラウザは全画面API非対応です（ホーム画面に追加すると広く表示できます）";
        }
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  } catch (e) {
    const sysMsg = document.getElementById("system-msg");
    if (sysMsg) {
      sysMsg.innerText = "全画面の切り替えに失敗しました。画面をタップしてから再度お試しください。";
    }
  }
  updateFullscreenButton();
}

document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

// ====================================================
// 🔊 男女別・ボボボボ効果音
// ====================================================
function playVoiceBeep(voiceType = "story") {
  try {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = "square";
    let freq = 440;
    if (voiceType === "female") freq = 520;
    else if (voiceType === "male") freq = 260;

    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {}
}

function detectVoiceType(speaker) {
  if (/宮川りえ|末広涼子|危機キリン/.test(speaker)) return "female";
  if (/大亀義丹|外田裕也|南島五十六郎|叶姉妹農家|ｎｉｋｋｏ/.test(speaker)) return "male";
  return "story";
}

// ====================================================
// 💾 ゲーム進行ステータス ＆ オートセーブ管理
// ====================================================
let gameState = getInitialGameState();
let currentScene = "intro";
let isTyping = false;

// ★ 全キャラ共通の会話履歴管理（キャッチボール用）
let chatHistory = [];

function resetChatHistory() {
  chatHistory = [];
}

function recordChatHistory(speaker, text) {
  chatHistory.push({ speaker, text });
  if (chatHistory.length > 8) {
    chatHistory = chatHistory.slice(-8);
  }
}

function getRecentHistoryText() {
  if (chatHistory.length === 0) return "（これまでの会話なし）";
  return chatHistory.map((h) => `${h.speaker}: ${h.text}`).join("\n");
}

let shopPs12Flags = { version: false, chestnut: false, game: false };
let unlockedToday = [];
let cinemaAsked = { movie1: false, movie2: false, movie3: false };
let taxiFlatterCount = 0;
let taxiUsedFlatterGroups = new Set(); // ★ 末広涼子への同じ褒めワード連打防止
let taxiUsedInputs = new Set();        // ★ 同じ発言の使い回し防止
let dinnerTalkCount = 0;
let scalperFlags = { affair: false, marcia: false };
let scalperMarciaCount = 0;
let farmerFlags = { sugar: false, variety: false, natural: false };
let farmerTalkCount = 0;

// ★ 末広涼子の褒めワード同義語グループ定義
const TAXI_FLATTER_GROUPS = [
  { key: "kawaii",       pattern: /かわいい|可愛い|カワイイ/ },
  { key: "kirei",        pattern: /綺麗|きれい|キレイ|美人|美しい/ },
  { key: "suteki",       pattern: /素敵|すてき|魅力/ },
  { key: "saikou",       pattern: /最高|素晴らしい/ },
  { key: "umai",         pattern: /上手|うまい|天才|流石|さすが/ },
  { key: "megami",       pattern: /女神|天使/ },
  { key: "suki",         pattern: /好き|大好き|ファン|応援/ },
  { key: "niau",         pattern: /似合|おしゃれ|オシャレ/ },
  { key: "yasashii",     pattern: /優しい|やさしい/ },
  { key: "kagayaku",     pattern: /輝いて/ },
  { key: "kakkoii",      pattern: /かっこいい|カッコいい/ },
  { key: "kimochi",      pattern: /きもち|気持ち/ },
  { key: "arigato",      pattern: /ありがと/ },
  { key: "wakawakashii", pattern: /若々しい|若い/ },
  { key: "sugoi",        pattern: /すごい|凄い|スゴい/ }
];

function getInitialGameState() {
  return {
    day: 55,
    cleared: {
      cinema: false,
      dinner: false,
      dome: false,
      farmer: false
    }
  };
}

function saveGameData() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  } catch (e) {}
}

function loadGameData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.day === "number" && parsed.cleared) {
      gameState = parsed;
      return true;
    }
  } catch (e) {}
  return false;
}

function clearSaveData() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
  gameState = getInitialGameState();
}

function resetGameConfirm() {
  if (isTyping) return;
  const ok = confirm("オートセーブデータを消去して、8月55日の最初からやり直しますか？");
  if (ok) {
    resetAndStartNewGame();
  }
}

function resetAndStartNewGame() {
  clearSaveData();
  document.getElementById("ending-panel").style.display = "none";
  startGame();
}

function toFullWidthNum(n) {
  return String(n).replace(/[0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
}

function updateDayHeader() {
  const titleEl = document.getElementById("day-title");
  if (!titleEl) return;
  if (gameState.day > 58) {
    titleEl.textContent = "9月1日の朝";
  } else {
    titleEl.textContent = `8月${gameState.day}日の夏休み`;
  }
}

// ====================================================
// 初期設定 ＆ APIモーダル制御
// ====================================================
function isLocalEnvironment() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:"
  );
}

function updateApiButtonStatus() {
  const apiBtn = document.getElementById("api-btn");
  if (!apiBtn) return;

  if (customApiKey) {
    apiBtn.innerText = "🤖 AI接続中(キー済)";
    apiBtn.style.borderColor = "#2ecc71";
    apiBtn.style.color = "#2ecc71";
  } else if (!isLocalEnvironment()) {
    apiBtn.innerText = "🤖 AI接続中";
    apiBtn.style.borderColor = "#2ecc71";
    apiBtn.style.color = "#2ecc71";
  } else {
    apiBtn.innerText = "🤖 AI設定";
    apiBtn.style.borderColor = "#f39c12";
    apiBtn.style.color = "#f39c12";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setSceneVisual("room");
  updateApiButtonStatus();
  updateFullscreenButton();

  if (loadGameData()) {
    updateDayHeader();
    const startBtn = document.getElementById("start-btn");
    const sysMsg = document.getElementById("system-msg");
    if (gameState.day > 58) {
      startBtn.innerText = "9月1日（クリアデータ）を見る";
    } else {
      startBtn.innerText = `続きから遊ぶ（8月${gameState.day}日〜）`;
      sysMsg.innerText = `オートセーブデータがあります（8月${gameState.day}日）`;
    }
  }

  const inputEl = document.getElementById("user-input");
  if (inputEl) {
    inputEl.placeholder = "話しかける内容を入力してください";
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        sendMessage();
      }
    });
  }
});

function openRuleModal() {
  if (loadGameData() && gameState.day > 55) {
    startGame();
    return;
  }
  document.getElementById("rule-modal").style.display = "flex";
}

function closeRuleModalAndStart() {
  document.getElementById("rule-modal").style.display = "none";
  startGame();
}

function openApiModal() {
  document.getElementById("api-key-input").value = customApiKey;
  document.getElementById("api-modal").style.display = "flex";
}

function closeApiModal() {
  document.getElementById("api-modal").style.display = "none";
}

function saveApiKey() {
  const raw = document.getElementById("api-key-input").value || "";
  customApiKey = raw.replace(/['"\s]/g, "");
  cachedModelName = "";
  discoveredModelsCache = null;
  deadModels404.clear();

  if (customApiKey) {
    localStorage.setItem("zokubokunatu_api_key", customApiKey);
  } else {
    localStorage.removeItem("zokubokunatu_api_key");
  }
  localStorage.removeItem("zokubokunatu_model_name");

  updateApiButtonStatus();
  closeApiModal();
}

// ====================================================
// 🎮 ゲーム開始 ＆ 1日の流れ
// ====================================================
function startGame() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  } catch (e) {}

  document.getElementById("text-display").innerHTML = "";
  document.getElementById("ending-panel").style.display = "none";
  document.getElementById("command-box").style.display = "none";
  document.getElementById("chat-box").style.display = "none";
  clearActionButtons();

  if (gameState.day > 58) {
    startFinalClearScene();
  } else {
    startMorningRoomScene();
  }
}

async function startMorningRoomScene() {
  currentScene = "morning_room";
  resetChatHistory();
  updateDayHeader();
  setSceneVisual("room", `自分の部屋（8月${gameState.day}日・朝）`);
  document.getElementById("text-display").innerHTML = "";
  clearActionButtons();

  unlockedToday = [];
  updateQuestHeader(
    `8月${gameState.day}日：宮川りえと話して出かける場所を決める`,
    buildHubQuestFlags()
  );

  const dayFull = toFullWidthNum(gameState.day);
  let morningText = "";
  if (gameState.day === 55) {
    morningText =
      `目が覚めた。\n` +
      `自分の部屋のカレンダーを見ると、今日は８月${dayFull}日。まだまだ夏休みのど真ん中だ。\n` +
      `まだ二学期は始まりそうにない。今日は待ちに待った「プレイステーション12」の発売日。\n` +
      `とりあえず、街のゲームショップにいる宮川りえのところへ行ってみよう。`;
  } else {
    morningText =
      `目が覚めた。\n` +
      `自分の部屋のカレンダーを見ると、今日は８月${dayFull}日。まだまだ夏休みは終わらない。\n` +
      `今日も元気に、街のゲームショップへ宮川りえに会いに行こう。`;
  }

  await streamStoryText(morningText);
  await enterShopScene();
}

function buildHubQuestFlags() {
  const ps12Count =
    (shopPs12Flags.version ? 1 : 0) +
    (shopPs12Flags.chestnut ? 1 : 0) +
    (shopPs12Flags.game ? 1 : 0);

  const isUnlockedToday = (key) => unlockedToday.some((u) => u.key === key);

  const flags = [];
  if (!gameState.cleared.cinema) {
    flags.push({
      id: "hub-cinema",
      label: "映画館の調査",
      cleared: false,
      progress: ps12Count,
      max: 3
    });
  }
  if (!gameState.cleared.dinner) {
    flags.push({
      id: "hub-dinner",
      label: "ディナーショーの噂",
      cleared: false,
      progress: gameState.cleared.dinner || isUnlockedToday("dinner") ? 1 : 0,
      max: 1
    });
  }
  if (!gameState.cleared.dome) {
    flags.push({
      id: "hub-dome",
      label: "東京ドームの噂",
      cleared: false,
      progress: gameState.cleared.dome || isUnlockedToday("dome") ? 1 : 0,
      max: 1
    });
  }
  if (gameState.cleared.dome && !gameState.cleared.farmer) {
    flags.push({
      id: "hub-farmer",
      label: "職業見学の噂",
      cleared: false,
      progress: gameState.cleared.farmer || isUnlockedToday("farmer") ? 1 : 0,
      max: 1
    });
  }
  return flags;
}

async function enterShopScene() {
  currentScene = "shop";
  resetChatHistory();
  setSceneVisual("shop");

  let greeting = "";
  if (gameState.day === 55) {
    greeting =
      "いらっしゃいませー！ いやぁ、今日のプレステ12の発売を巡っては「すったもんだがありまして」、朝から大騒ぎで完売よ！\n" +
      "ほんと令和のゲーム業界って「ぶっとびー」よねぇ！\n" +
      "……ところであなた、プレステ12の「本体バージョン」や「起動方法」、あと「同梱ソフト」についてはもう知ってるのかしら？";
  } else {
    greeting =
      `あら、いらっしゃい！ 今日は８月${toFullWidthNum(gameState.day)}日ね！\n` +
      `今日もすったもんだがありまして、朝からぶっとびーな気分よ！\n` +
      `今日はどんなお話をする？ なんでも自由に話しかけてちょうだい！`;
  }

  await streamNpcChat("店員・宮川りえ", greeting);

  if (unlockedToday.length > 0) {
    showActionButtons(
      unlockedToday.map((u) => ({
        label: u.btnLabel,
        onClick: u.handler
      }))
    );
  }

  enableChatInput();
}

// ====================================================
// 🌙 一日の終了（自分の部屋の絵 → オートセーブ → 翌日へ）
// ====================================================
async function finishDayAndAutoSave(eventKey, customBedText = null) {
  currentScene = "night_room";
  disableChatInput(true);
  document.getElementById("chat-box").style.display = "none";
  clearActionButtons();

  if (eventKey && gameState.cleared.hasOwnProperty(eventKey)) {
    gameState.cleared[eventKey] = true;
  }

  setSceneVisual("room", `自分の部屋（8月${gameState.day}日・夜）`);

  const nightText =
    customBedText ||
    "家に帰ってきて、自分の部屋のベッドに飛び込んだ。\n" +
    "今日もいろんなことがあった一日だった。\n" +
    "明日もまた、素晴らしい一日になりますように。";

  await streamStoryText(nightText);

  gameState.day += 1;
  saveGameData();

  await streamStoryText("💾 【オートセーブ完了】一日の記録をセーブしました。", false);

  if (gameState.day > 58) {
    showActionButtons([
      {
        label: "🌅 9月1日の朝へ進む",
        onClick: () => startFinalClearScene()
      }
    ]);
  } else {
    showActionButtons([
      {
        label: `💤 眠って次の日（8月${gameState.day}日）へ進む`,
        onClick: () => startMorningRoomScene()
      }
    ]);
  }
}

async function startFinalClearScene() {
  currentScene = "ending";
  updateDayHeader();
  setSceneVisual("ending", "9月1日・クリア！");
  document.getElementById("chat-box").style.display = "none";
  clearActionButtons();
  document.getElementById("text-display").innerHTML = "";

  updateQuestHeader("🎉 9月1日 到達！ 全日程クリア！", []);

  const clearStory =
    "目が覚めると、カレンダーはついに「９月１日」になっていた！\n" +
    "８月５５日から８月５８日までの怒涛の夏休みを駆け抜け、ついに新しい季節がやってきたのだ！";

  await streamStoryText(clearStory, false);

  const endingPanel = document.getElementById("ending-panel");
  document.getElementById("ending-title").innerText = "🎊 9月1日 到達！ ゲームクリア！";
  document.getElementById("ending-msg").innerText =
    "8月55日から8月58日までの夏休みをすべて満喫し、\n" +
    "無事に9月1日を迎えました！\n\n" +
    "遊んでいただき、本当にほんとに、ほんとうに、、ありがとう！！";
  endingPanel.style.display = "block";
}

// ====================================================
// 💬 メッセージ送信ルーティング
// ====================================================
async function sendMessage() {
  if (isTyping) return;
  const inputEl = document.getElementById("user-input");
  const userText = inputEl.value.trim();
  if (!userText) return;

  inputEl.value = "";
  appendPlayerChat(userText);
  disableChatInput(true);
  document.getElementById("system-msg").innerText = "🤖 Gemini AIが返答中……";

  if (currentScene === "shop") {
    await handleShopConversation(userText);
  } else if (currentScene === "cinema") {
    await handleCinemaConversation(userText);
  } else if (currentScene === "taxi") {
    await handleTaxiConversation(userText);
  } else if (currentScene === "dinner_table") {
    await handleDinnerTableConversation(userText);
  } else if (currentScene === "scalper") {
    await handleScalperConversation(userText);
  } else if (currentScene === "farmer") {
    await handleFarmerConversation(userText);
  }
}

// ====================================================
// 🏪 宮川りえ（ショップ）の会話
// ====================================================
async function handleShopConversation(userText) {
  let specialReaction = "";
  let plateStatus = "店員・宮川りえ";

  if (/サンタフェ|ふんどし/.test(userText)) {
    plateStatus = "店員・宮川りえ（激しい動揺）";
    specialReaction =
      "（ビクゥッ！！と激しく肩を震わせ、目を泳がせながら大動揺する）\n" +
      "「ひゃ、ひゃあぁぁっ！？ ちょ、ちょっとあなた！ いきなり『サンタフェ』とか『ふんどし』なんてワードを出さないでちょうだい！！ すったもんだがありまして、動揺しすぎて変な汗が止まらないじゃないのよぉぉ……！」";
  } else if (/貴乃花|貴花田|相撲/.test(userText)) {
    plateStatus = "店員・宮川りえ（満面の笑顔）";
    specialReaction =
      "（パァッと満面の笑顔になり、こちらに向かってブンブンと嬉しそうに手を振る！）\n" +
      "「あらぁ〜っ♪ うふふ、あなたのお口から相撲や貴乃花のお話が出ると、なんだか私まで胸がポカポカして、こうやって笑顔で手を振りたくなっちゃうのよねぇ〜！ ぶっとびーなハッピー気分よ♪」";
  } else if (/中村勘九郎|勘九郎|歌舞伎/.test(userText)) {
    plateStatus = "店員・宮川りえ（闇落ち）";
    specialReaction =
      "（スッ……と表情から光が消え、瞳が真っ黒に染まり、背後にどす黒い闇のオーラが立ち昇る……！）\n" +
      "「…………フッ……歌舞伎……中村勘九郎……。光あるところに影があるように、私の心は今、底無しの漆黒へと堕ちていくわ……。全ては虚無……すったもんだの果てにあるのは暗黒だけなのよ……ふふ、うふふふふ……」";
  }

  setSceneVisual("shop", plateStatus);

  let newlyUnlockedPlace = null;

  if (
    gameState.cleared.dome &&
    !gameState.cleared.farmer &&
    /叶姉妹|デヴィ武人|デヴィ|タイトルマッチ/.test(userText)
  ) {
    newlyUnlockedPlace = {
      key: "farmer",
      name: "叶姉妹農家の職業見学",
      btnLabel: "🚜 叶姉妹農家の職業見学へ行く",
      handler: () => startFarmerScene(),
      talk: "昨日の東京ドームのタイトルマッチ、デヴィ武人VS叶姉妹は凄かったみたいね！ そうそう、その叶姉妹を栽培してる農家さんが今ちょうど出荷で大忙しらしいの！"
    };
  } else if (
    !gameState.cleared.dome &&
    /野球|ランディージョンソン|ランディ・ジョンソン|ランディ|叶姉妹/.test(userText)
  ) {
    newlyUnlockedPlace = {
      key: "dome",
      name: "東京ドーム",
      btnLabel: "🏟️ 東京ドームへ行く",
      handler: () => startDomeScene(),
      talk: "あら、野球やランディ・ジョンソン、それに叶姉妹といえば！ 今日ちょうど東京ドームで『デヴィ武人VS叶姉妹』の世紀のタイトルマッチが行われる日じゃないの！"
    };
  } else if (
    !gameState.cleared.dinner &&
    /カバからしたら大福は食べてないのに等しい|キモタク|恋愛映画|ラブストーリー|カバ.*大福|大福.*カバ/.test(userText)
  ) {
    newlyUnlockedPlace = {
      key: "dinner",
      name: "南島五十六郎のディナーショー",
      btnLabel: "🎤 南島五十六郎のディナーショーへ行く",
      handler: () => startDinnerShowScene(),
      talk: "きゃあ！ キモタク主演の恋愛映画『カバからしたら大福は食べてないのに等しい』といえば、その主題歌を歌ってる南島五十六郎のディナーショーがまさに今日開かれるのよ！"
    };
  }

  const askBuy = /売って|うって|買|かいたい|下さい|ください|在庫|ざいこ|予約|よやく|入荷|にゅうか|欲しい|ほしい|いくら|値段|ねだん|価格|売り切れ|うりきれ/.test(userText);
  const askVer = /バージョン|ばーじょん|種類|しゅるい|色|カラー|タイプ|2つ|二つ|モデル|竹槍|フェラーリ|錦織|メロン/.test(userText);
  const askChestnut = /起動|きどう|電源|でんげん|スイッチ|どうやって|やり方|やりかた|方法|動か|コントローラ|穴|栗|甘栗|天津/.test(userText);
  const askGame = /ソフト|そふと|ゲーム|同梱|どうこん|カセット|何が入|付属|おまけ|カラテカ/.test(userText);

  let selectedPs12Topic = null;

  if (askBuy && !askVer && !askChestnut && !askGame) {
    selectedPs12Topic = "soldout";
  } else if (askVer && !shopPs12Flags.version) {
    selectedPs12Topic = "version";
  } else if (askChestnut && !shopPs12Flags.chestnut) {
    selectedPs12Topic = "chestnut";
  } else if (askGame && !shopPs12Flags.game) {
    selectedPs12Topic = "game";
  } else if (askVer) {
    selectedPs12Topic = "version";
  } else if (askChestnut) {
    selectedPs12Topic = "chestnut";
  } else if (askGame) {
    selectedPs12Topic = "game";
  }

  if (selectedPs12Topic === "version" || selectedPs12Topic === "chestnut" || selectedPs12Topic === "game") {
    shopPs12Flags[selectedPs12Topic] = true;
  }

  let topicInstruction = "プレイヤーと楽しくふざけながら世間話をしてください。";
  if (selectedPs12Topic === "soldout") {
    topicInstruction =
      "プレイヤーがプレステ12を買いたがっていますが、『ごめんなさいね！ 今日のプレステ12は開店3秒で売り切れ（完売）ちゃったのよ！ 次回の入荷は西暦3000年頃なの！』と売り切れであることを大げさに面白く強調して教えてください。";
  } else if (selectedPs12Topic === "version") {
    topicInstruction =
      "プレステ12の本体バージョンが『食べるメロンソーダ味色の竹槍バージョン』と『錦織圭の調子がいい時の歯茎色フェラーリバージョン』の2種類であることをドヤ顔っぽく楽しく教えてください。";
  } else if (selectedPs12Topic === "chestnut") {
    topicInstruction =
      "プレステ12の起動方法はコントローラーの穴に「天津甘栗」をはめ込むことだと、さも当然の最新技術かのように面白く教えてください。";
  } else if (selectedPs12Topic === "game") {
    topicInstruction =
      "プレステ12の同梱ソフトは『カラテカ2』（デヴィ武人主演）だと、ノリよく盛り上げながら教えてください。";
  }

  let reply = "";
  if (specialReaction) {
    reply = specialReaction;
  } else {
    const recentLog = getRecentHistoryText();
    const prompt =
      `あなたは8月${gameState.day}日の夏休みにいる、明るくてお調子者な不条理ギャグ世界のゲームショップ店員「宮川りえ」です。\n` +
      `口癖は「ぶっとびー！」「すったもんだがありまして」です（会話の流れに自然なタイミングでノリよく使ってください）。\n` +
      `【会話のルール】\n` +
      `1. まずはプレイヤーの直前の発言（質問・ツッコミ・感想・挨拶）に真っ正面から反応し、会話のキャッチボールを必ず成立させてください。\n` +
      `2. プレイヤーの質問やツッコミをスルーせずちゃんと受けたうえで、「ちょっとズレた自信満々な理屈」「大げさな例え」「バブル風の軽いノリ」「思わずツッコミたくなる小ボケ」を混ぜて、ふざけた面白い返しにしてください。\n` +
      `3. 話を無関係な別話題に飛ばさず、今の会話の流れと8月${gameState.day}日・プレステ12・夏休みの文脈に沿ってふざけてください（2〜3文程度、普通のセリフ文章のみで出力）。\n\n` +
      `【直近の会話履歴】\n${recentLog}\n\n` +
      `【今回の返答指示】\n${topicInstruction}`;

    const aiText = await callGeminiFast(prompt);
    if (aiText) {
      reply = aiText;
    } else {
      reply = buildShopFallbackReply(userText, selectedPs12Topic);
    }
  }

  if (
    !newlyUnlockedPlace &&
    !gameState.cleared.cinema &&
    shopPs12Flags.version &&
    shopPs12Flags.chestnut &&
    shopPs12Flags.game
  ) {
    newlyUnlockedPlace = {
      key: "cinema",
      name: "映画館",
      btnLabel: "🎬 映画館へ行く",
      handler: () => startCinemaScene(),
      talk: "うふふ、これでプレステ12の3つの仕様は全部バッチリね！"
    };
  }

  if (newlyUnlockedPlace) {
    const inviteLine = `\n\n${newlyUnlockedPlace.talk}\nあいにく在庫はどこも完売だから、今日は気晴らしに「${newlyUnlockedPlace.name}」にでも行ってきたらどうかしら？`;
    reply += inviteLine;

    if (!unlockedToday.some((u) => u.key === newlyUnlockedPlace.key)) {
      unlockedToday.push(newlyUnlockedPlace);
    }
  }

  updateQuestHeader(
    `8月${gameState.day}日：宮川りえと話して出かける場所を決める`,
    buildHubQuestFlags()
  );

  await streamNpcChat("店員・宮川りえ", reply);

  if (unlockedToday.length > 0) {
    showActionButtons(
      unlockedToday.map((u) => ({
        label: u.btnLabel,
        onClick: u.handler
      }))
    );
  }

  enableChatInput();
}

function buildShopFallbackReply(userText, selectedPs12Topic) {
  if (selectedPs12Topic === "soldout") {
    return "ごめんなさいねぇ！ プレステ12なら朝からすったもんだがありまして、開店3秒で完全に売り切れちゃったのよ！ 在庫はゼロでぶっとびーな完売状態なの！";
  }
  if (selectedPs12Topic === "version") {
    return "今回のプレステ12は『食べるメロンソーダ味色の竹槍バージョン』と『錦織圭の調子がいい時の歯茎色フェラーリバージョン』の2種類があるの！ ぶっとびーでしょ！";
  }
  if (selectedPs12Topic === "chestnut") {
    return "プレステ12はね、コントローラーの穴に「天津甘栗」をはめ込むことで起動するのよ！ すったもんだがありましてねぇ！";
  }
  if (selectedPs12Topic === "game") {
    return "同梱ソフトは『カラテカ2』よ！ あのデヴィ武人が大暴れするぶっとびーな名作なの！";
  }
  return `あらやだ、「${userText}」ですって！？ あなた発想がぶっとびーねぇ！\nすったもんだがありまして、うちの店も朝から大盛り上がりなのよ！`;
}

// ====================================================
// 🎬 映画館編
// ====================================================
async function startCinemaScene() {
  currentScene = "cinema";
  resetChatHistory();
  setSceneVisual("cinema");
  clearActionButtons();
  document.getElementById("chat-box").style.display = "none";
  document.getElementById("text-display").innerHTML = "";

  cinemaAsked = { movie1: false, movie2: false, movie3: false };

  updateQuestHeader(
    "上映中の3本の映画についてｎｉｋｋｏに質問する",
    [
      { id: "cin-m1", label: "映画の調査①", cleared: cinemaAsked.movie1, progress: cinemaAsked.movie1 ? 1 : 0, max: 1 },
      { id: "cin-m2", label: "映画の調査②", cleared: cinemaAsked.movie2, progress: cinemaAsked.movie2 ? 1 : 0, max: 1 },
      { id: "cin-m3", label: "映画の調査③", cleared: cinemaAsked.movie3, progress: cinemaAsked.movie3 ? 1 : 0, max: 1 }
    ]
  );

  const cinemaIntro =
    "気晴らしに映画館へやってきた。\n" +
    "現在上映中の映画は以下の３本だ。\n" +
    "1. 『カバからしたら大福は食べてないのに等しい』（キモタク主演の恋愛映画）\n" +
    "2. 『ランディ・ジョンソンにデッドボールを受けた鳩の逆襲』（伝説の対鳩事件ドキュメンタリー）\n" +
    "3. 『スパイダーマン』（世の中にある全ての叶姉妹にジャンケンで勝てる異能少年のヒーロー作）\n" +
    "カウンターには、強烈なオーラを放つ映画館店員「ｎｉｋｋｏ」が立っている。";

  await streamStoryText(cinemaIntro);

  await streamNpcChat(
    "映画館店員・ｎｉｋｋｏ",
    "どんだけ～！ いらっしゃい～！\nまぼろし～！ 浴びせ蹴り～！\n（映画について質問すると、すべて４文字で答えてくれるようだ）"
  );

  enableChatInput();
}

function formatToFourChars(str, fallbackWord = "どんだけ") {
  const cleaned = (str || "").replace(/[\s「`『』！!？?。、…〜~・（）()]/g, "");
  if (cleaned.length >= 4) {
    return cleaned.slice(0, 4);
  }
  return fallbackWord;
}

async function handleCinemaConversation(userText) {
  const matchM1 = /1|１|カバ|大福|キモタク|ラブ|恋愛/.test(userText);
  const matchM2 = /2|２|ランディ|ジョンソン|鳩|ハト|デッドボール|逆襲|野球/.test(userText);
  const matchM3 = /3|３|スパイダー|叶姉妹|ジャンケン|じゃんけん|ヒーロー/.test(userText);

  let targetMovie = 0;
  if (matchM1 && !cinemaAsked.movie1) targetMovie = 1;
  else if (matchM2 && !cinemaAsked.movie2) targetMovie = 2;
  else if (matchM3 && !cinemaAsked.movie3) targetMovie = 3;
  else if (matchM1) targetMovie = 1;
  else if (matchM2) targetMovie = 2;
  else if (matchM3) targetMovie = 3;

  if (targetMovie === 1) cinemaAsked.movie1 = true;
  else if (targetMovie === 2) cinemaAsked.movie2 = true;
  else if (targetMovie === 3) cinemaAsked.movie3 = true;

  updateQuestHeader(
    "上映中の3本の映画についてｎｉｋｋｏに質問する",
    [
      { id: "cin-m1", label: "映画の調査①", cleared: cinemaAsked.movie1, progress: cinemaAsked.movie1 ? 1 : 0, max: 1 },
      { id: "cin-m2", label: "映画の調査②", cleared: cinemaAsked.movie2, progress: cinemaAsked.movie2 ? 1 : 0, max: 1 },
      { id: "cin-m3", label: "映画の調査③", cleared: cinemaAsked.movie3, progress: cinemaAsked.movie3 ? 1 : 0, max: 1 }
    ]
  );

  const catchphrases = ["どんだけ～", "まぼろし～", "浴びせ蹴り～"];
  let fallbackWord = catchphrases[Math.floor(Math.random() * catchphrases.length)].replace("～", "");
  if (targetMovie === 1) fallbackWord = "キモタク";
  else if (targetMovie === 2) fallbackWord = "鳩の逆襲";
  else if (targetMovie === 3) fallbackWord = "全勝少年";

  const recentLog = getRecentHistoryText();
  const prompt =
    `あなたは映画館店員の「ｎｉｋｋｏ」（モデルはIKKO）です。\n` +
    `上映中の映画は①『カバからしたら大福は食べてないのに等しい』（キモタク主演の恋愛映画）、②『ランディ・ジョンソンにデッドボールを受けた鳩の逆襲』、③『スパイダーマン』（全ての叶姉妹にジャンケンで勝てる少年）です。\n` +
    `【会話のルール】\n` +
    `1. 直近の会話履歴とプレイヤーの直前の質問・ツッコミ・感想の内容を的確に受けて、ちゃんと答えになる【ぴったり4文字の日本語のみ】を出力してください。\n` +
    `2. 毎回同じ単語にせず、プレイヤーが聞いた内容（あらすじ、値段、ツッコミ、挨拶など）に噛み合う4文字にしてください（例：キモタク、大福ゼロ、鳩の逆襲、剛速球鳩、全勝少年、それ秘密、見て確認、千円だよ など）。\n` +
    `3. 記号や説明は一切書かず、4文字だけ出力してください。\n\n` +
    `【直近の会話履歴】\n${recentLog}`;

  const aiText = await callGeminiFast(prompt);
  const fourCharAnswer = formatToFourChars(aiText, fallbackWord);
  const catchword = catchphrases[Math.floor(Math.random() * catchphrases.length)];
  const replyText = `${fourCharAnswer}～！\n（${catchword}！）`;

  await streamNpcChat("映画館店員・ｎｉｋｋｏ", replyText);

  if (cinemaAsked.movie1 && cinemaAsked.movie2 && cinemaAsked.movie3) {
    await streamStoryText(
      "３本の映画についてすべて質問し終えたが、全部４文字で返されたせいでなんだか映画を見る気がすっかりなくなってしまった……。\n" +
      "今日はこのまま家に帰って寝ることにしよう。"
    );
    await finishDayAndAutoSave("cinema");
  } else {
    enableChatInput();
  }
}

// ====================================================
// 🎤 ディナーショー編
// ====================================================
async function startDinnerShowScene() {
  currentScene = "taxi";
  resetChatHistory();
  setSceneVisual("taxi");
  clearActionButtons();
  document.getElementById("chat-box").style.display = "none";
  document.getElementById("text-display").innerHTML = "";

  taxiFlatterCount = 0;
  taxiUsedFlatterGroups = new Set();
  taxiUsedInputs = new Set();

  updateQuestHeader(
    "タクシー運転手・末広涼子と会話して出発してもらう",
    [
      { id: "taxi-1", label: "① 1回目", cleared: false, progress: 0, max: 1 },
      { id: "taxi-2", label: "② 2回目", cleared: false, progress: 0, max: 1 },
      { id: "taxi-3", label: "③ 3回目", cleared: false, progress: 0, max: 1 }
    ]
  );

  const taxiIntro =
    "南島五十六郎のディナーショーへ向かうため、通りかかったタクシーをつかまえた。\n" +
    "ドアが開き、乗り込んだ瞬間、運転手がいきなり振り返って名乗ってきた！";

  await streamStoryText(taxiIntro);

  await streamNpcChat(
    "タクシー運転手・末広涼子",
    "「末広です！！\n本日は１８５キロの安全運転で行かさせていただきます……！！\n出発する前にもっときもちくしてくださいね……！」"
  );

  enableChatInput();
}

async function handleTaxiConversation(userText) {
  if (/交通事故|事故|衝突|ぶつかる|激突/.test(userText)) {
    await streamNpcChat("タクシー運転手・末広涼子", "「………………」");
    await streamStoryText("💥 バシィッ！！\n末広涼子は事故という不吉な言葉に激昂し、運転席から飛び出して強烈なローキックを叩き込んできた！！\n足が痺れるほど痛い……！");
    enableChatInput();
    return;
  }

  if (/マジで恋する５秒前|マジで恋する五秒前|まじでこいする/.test(userText)) {
    await streamNpcChat(
      "タクシー運転手・末広涼子",
      "「♪〜……！\nずっとまえから〜彼のこと〜、好き～だった〜……って、乗客さん、いきなり名曲をぶっ込んでこないでください！！ でもノリがいいからちょっときもちく……いや、嫌いじゃないわ……！」"
    );
    enableChatInput();
    return;
  }

  const isNgWord =
    /キャンドル|鳥羽|ラブレター|不倫|浮気|ババア|ブス|下手|遅い|最悪|ダメ|狂っ|ヤバい|やばい|怖い|頭おかしい|エロ|下ネタ|ぱんつ|パンツ|おっぱい|ちんこ|うんこ|死|バカ|アホ/.test(
      userText
    );

  if (isNgWord) {
    await streamNpcChat("タクシー運転手・末広涼子", "「………………」");
    await streamStoryText("💥 バシィッ！！\n末広涼子は無言で運転席から飛び出し、強烈なローキックを叩き込んできた！！\n足の骨が軋むほど痛い……！");
    enableChatInput();
    return;
  }

  // ★ 同じ褒めワード・同じセリフの使い回しをチェック
  const normalizedInput = userText.replace(/[\s！!？?。、…〜~・（）()「」『』]/g, "");
  const matchedGroups = TAXI_FLATTER_GROUPS.filter((g) => g.pattern.test(userText)).map((g) => g.key);
  const newGroups = matchedGroups.filter((key) => !taxiUsedFlatterGroups.has(key));
  const isDuplicateInput = taxiUsedInputs.has(normalizedInput);

  let isRepeatedFlatter = false;
  if (matchedGroups.length > 0) {
    if (!isDuplicateInput && newGroups.length > 0) {
      taxiFlatterCount += 1;
      matchedGroups.forEach((key) => taxiUsedFlatterGroups.add(key));
      taxiUsedInputs.add(normalizedInput);
    } else {
      isRepeatedFlatter = true;
    }
  }

  updateQuestHeader(
    "タクシー運転手・末広涼子と会話して出発してもらう",
    [
      { id: "taxi-1", label: "① 1回目", cleared: taxiFlatterCount >= 1, progress: Math.min(taxiFlatterCount, 1), max: 1 },
      { id: "taxi-2", label: "② 2回目", cleared: taxiFlatterCount >= 2, progress: Math.max(0, Math.min(taxiFlatterCount - 1, 1)), max: 1 },
      { id: "taxi-3", label: "③ 3回目", cleared: taxiFlatterCount >= 3, progress: Math.max(0, Math.min(taxiFlatterCount - 2, 1)), max: 1 }
    ]
  );

  const recentLog = getRecentHistoryText();
  let taxiGoalInstruction = "";
  if (isRepeatedFlatter) {
    taxiGoalInstruction =
      `乗客がさっきと同じ褒め言葉や同じフレーズを使い回してきました。「さっきも同じ褒め言葉でしたよね！？ 同じ言葉の使い回しじゃ全然きもちくなれません！ 別の言葉や別のポイントで褒めてきもちくしてください！」とツッコんでください（まだ出発しないでください）。`;
  } else if (taxiFlatterCount >= 3) {
    taxiGoalInstruction =
      `乗客に3パターンの違う言葉で褒められて最高に「きもちく」なったので、直前の発言に嬉しく反応しつつ「すごくきもちくなりました！」と伝えたあと、最後に必ず「車に入ってくれてありがとう！！ それでは１８５キロの安全運転で行かさせていただきます！！」と叫んで出発してください。`;
  } else if (taxiFlatterCount === 2) {
    taxiGoalInstruction =
      `乗客に2回褒められてかなり「きもちく」なってきたので、直前の発言にしっかり喜びつつ「すごくきもちくなってきました…あと1回だけ別の言葉でおだててきもちくしてくれたら出発します」と伝えてください。`;
  } else if (taxiFlatterCount === 1) {
    taxiGoalInstruction =
      `乗客に褒められて少しずつ「きもちく」なってきたので、直前の発言に照れながら反応しつつ「なんだかきもちくなってきました…もっと違う言葉でもおだててきもちくしてほしい」と伝えてください。`;
  } else {
    taxiGoalInstruction =
      `直前の発言に真っ正面から反応したうえで、「もっと自分の美貌や運転を褒めてきもちくしてほしい」と情緒たっぷりにねだってください。`;
  }

  const prompt =
    `あなたはタクシー運転手の「末広涼子」（モデルは広末涼子）。少し情緒不安定でハイテンションな性格です。\n` +
    `口癖は「末広です」「１８５キロの安全運転で行かさせていただきます」です。\n` +
    `また、自分の気分が良くなることを「気持ちよく」ではなく必ずひらがなで「きもちく」と言います（例：「きもちくなってきました」「もっときもちくしてください」「それじゃきもちくなれません！」）。\n` +
    `【会話のルール】\n` +
    `1. まずは乗客（プレイヤー）の直前の発言（質問・ツッコミ・感想・褒め言葉）に真っ正面から反応し、会話のキャッチボールを成立させてください。\n` +
    `2. 「185キロは危なくない？」「なんで出発しないの？」等の疑問やツッコミにもはぐらかさず、彼女なりの理屈や感情でちゃんと答えてください。\n` +
    `3. 返答の中に必ず「きもちく」というひらがなのワードを1〜2回自然に入れてください（「気持ちよく」とは書かないでください）。\n` +
    `4. 2〜3文程度の普通のセリフ文章のみで出力してください。\n\n` +
    `【直近の会話履歴】\n${recentLog}\n\n` +
    `【今回の返答指示】\n${taxiGoalInstruction}`;

  const aiText = await callGeminiFast(prompt);

  if (isRepeatedFlatter) {
    const reply =
      aiText ||
      "「ちょっと乗客さん、末広です！！ さっきも同じ褒め言葉でしたよね！？ 同じ言葉の使い回しじゃ全然きもちくなれません！ 別の言葉で褒めてきもちくしてください……！」";
    await streamNpcChat("タクシー運転手・末広涼子", reply);
    enableChatInput();
  } else if (taxiFlatterCount === 0) {
    const reply =
      aiText ||
      "「末広です……！ もっと褒めておだててもらえたら、きもちくなれる気がするんです……私をきもちくしてください……！」";
    await streamNpcChat("タクシー運転手・末広涼子", reply);
    enableChatInput();
  } else if (taxiFlatterCount === 1) {
    const reply =
      aiText ||
      "「えっ……！？ 末広です……！ そんなふうに褒めてもらえるなんて……！\nなんだかきもちくなってきました……もっと別の言葉でおだててきもちくしてくれたら嬉しいです……！」";
    await streamNpcChat("タクシー運転手・末広涼子", reply);
    enableChatInput();
  } else if (taxiFlatterCount === 2) {
    const reply =
      aiText ||
      "「きゃあぁ……！ 末広です！！ すごくきもちくなってきました……あと１回だけ違う言葉でおだててきもちくしてくれたら、１８５キロの安全運転で行かさせていただきます……！」";
    await streamNpcChat("タクシー運転手・末広涼子", reply);
    enableChatInput();
  } else {
    let reply =
      aiText ||
      "「ああっ、最高にきもちくなりました！！ 車に入ってくれてありがとう！！\nそれでは、１８５キロの安全運転で行かさせていただきますーーっ！！」";
    if (!reply.includes("車に入ってくれてありがとう")) {
      reply += "\n「最高にきもちくなりました！ 車に入ってくれてありがとう！！ それでは、１８５キロの安全運転で行かさせていただきますーーっ！！」";
    }
    await streamNpcChat("タクシー運転手・末広涼子", reply);
    await startDinnerShowVenuePart();
  }
}

async function startDinnerShowVenuePart() {
  disableChatInput(true);
  document.getElementById("chat-box").style.display = "none";

  const isorokuLore =
    "タクシーは猛烈なGとともに時速１８５キロで爆走し、ディナーショー会場へと向かう。\n" +
    "ここで、本日ディナーショーを行う「南島五十六郎」について説明しよう。\n" +
    "南島五十六郎は沖縄生まれの５６歳、５６人兄弟の長男。\n" +
    "『カバからしたら大福は食べてないのに等しい』の主題歌の『まつり』がヒット中だ。\n" +
    "去年の年末のNHK黄茶歌合戦での南島五十六郎の活躍が凄かった。茶組のリーダー南島五十六郎の21人斬りには興奮した。\n" +
    "大トリの黄組のリーダー超大型巨人、大林素子の脊髄を削り取った姿は圧巻だった。";

  await streamStoryText(isorokuLore);

  currentScene = "dinner_table";
  resetChatHistory();
  setSceneVisual("dinner_table");
  dinnerTalkCount = 0;

  updateQuestHeader(
    "同じテーブルの外田裕也と会話する",
    [
      { id: "din-1", label: "① 1回目", cleared: false, progress: 0, max: 1 },
      { id: "din-2", label: "② 2回目", cleared: false, progress: 0, max: 1 },
      { id: "din-3", label: "③ 3回目", cleared: false, progress: 0, max: 1 }
    ]
  );

  const tableIntro =
    "ディナーショー会場に到着し、案内されたテーブルに座ると、同じテーブルに老人２人が座っていた。\n" +
    "「外田裕也」と「危機キリン」だ。料理が運ばれてくるまで会話してみよう。";

  await streamStoryText(tableIntro);

  await streamNpcChat(
    "外田裕也 ＆ 危機キリン",
    "【外田裕也】\n「ヘイ！ 同じテーブルになるとはロッケンロール！ ロッケンロールヨロシク！ 今夜は最高の夜になりそうだぜ、試験管ベイビー！」\n\n" +
    "【危機キリン】\n「………………（無言）」"
  );

  enableChatInput();
}

async function handleDinnerTableConversation(userText) {
  dinnerTalkCount += 1;

  updateQuestHeader(
    "同じテーブルの外田裕也と会話する",
    [
      { id: "din-1", label: "① 1回目", cleared: dinnerTalkCount >= 1, progress: Math.min(dinnerTalkCount, 1), max: 1 },
      { id: "din-2", label: "② 2回目", cleared: dinnerTalkCount >= 2, progress: Math.max(0, Math.min(dinnerTalkCount - 1, 1)), max: 1 },
      { id: "din-3", label: "③ 3回目", cleared: dinnerTalkCount >= 3, progress: Math.max(0, Math.min(dinnerTalkCount - 2, 1)), max: 1 }
    ]
  );

  const recentLog = getRecentHistoryText();
  const prompt =
    `あなたは南島五十六郎のディナーショー会場で同じテーブルに座っているロックな老人「外田裕也」（モデルは内田裕也）です。隣には妻の「危機キリン」（モデルは樹木希林）がいますが、危機キリンは完全に無言です。\n` +
    `外田裕也の口癖は「ロッケンロール」「ロッケンロールヨロシク」で、トークの文末は必ず「試験管ベイビー」で終わります。\n` +
    `【会話のルール】\n` +
    `1. まずはプレイヤーの直前の発言（質問・ツッコミ・危機キリンへの呼びかけ・ディナーショーの話題など）に真っ正面から反応し、会話のキャッチボールを成立させてください。\n` +
    `2. プレイヤーが疑問やツッコミを入れたときは、はぐらかさずロックな老人らしくちゃんと答えてください。\n` +
    `3. 以下の形式で2〜3文程度にまとめて出力してください。\n` +
    `【外田裕也】\n「（セリフ。最後は必ず試験管ベイビーで締める）」\n\n【危機キリン】\n「………………」\n\n` +
    `【直近の会話履歴】\n${recentLog}`;

  let reply = await callGeminiFast(prompt);

  if (!reply) {
    const fallbacks = [
      "【外田裕也】\n「おう！ お前さんの言うことは実にロッケンロールだぜ！ ロッケンロールヨロシク！ 試験管ベイビー！」\n\n【危機キリン】\n「………………」",
      "【外田裕也】\n「ハッハッハ！ 南島五十六郎のステージが待ちきれないぜ！ ロッケンロール！ 試験管ベイビー！」\n\n【危機キリン】\n「………………」",
      "【外田裕也】\n「おっと、そろそろお待ちかねのディナーが運ばれてくる頃だぜ！ ロッケンロールヨロシク！ 試験管ベイビー！」\n\n【危機キリン】\n「………………」"
    ];
    reply = fallbacks[(dinnerTalkCount - 1) % fallbacks.length];
  } else {
    if (!reply.includes("試験管ベイビー")) {
      reply = reply.trim() + " 試験管ベイビー！\n\n【危機キリン】\n「………………」";
    }
  }

  await streamNpcChat("外田裕也 ＆ 危機キリン", reply);

  if (dinnerTalkCount >= 3) {
    await runDinnerShowClimax();
  } else {
    enableChatInput();
  }
}

async function runDinnerShowClimax() {
  disableChatInput(true);
  document.getElementById("chat-box").style.display = "none";

  const dishStory =
    "外田裕也と盛り上がっていると、ついに料理が運ばれてきた！\n" +
    "前菜は『おじいちゃんの膝の皿に添えた、妖怪「尻なめ小僧」の煮凝り』。メインディッシュは『角刈りおばちゃんの、紫のパーマ液をかけたおひたし』だ。\n" +
    "外田裕也が「パーマ液の渋みが効いててロッケンロール」と笑顔でむしゃむしゃ平らげているのを見て、食欲がそそられた。";

  await streamStoryText(dishStory);

  setSceneVisual("dinner_stage");

  const dayStr = toFullWidthNum(gameState.day);
  const stageStory =
    "開演のベルが鳴り、天井からワイヤー吊りで降りてきながら、両手に刀を持ってドラムを爆奏する南島五十六郎が登場！\n" +
    "代表曲『まつり』の圧巻のパフォーマンスに、会場のボルテージは一気に最高潮へ達した。\n" +
    "アンコールでは、五十六郎が客席に向かって大量の「ゆで玉子の黄身だけ」を吹矢で高速連射し、会場全体を黄色く染め上げながら感動のバラードを熱唱！\n" +
    `全員で肩を組み、「やっぱり夏休みは${dayStr}日目に限るな！」と大合唱した。`;

  await streamStoryText(stageStory);

  const bedStory =
    "最高の興奮に包まれたまま帰宅し、ベッドに入る。\n" +
    "明日もまた、素晴らしい一日になりますように。";

  await finishDayAndAutoSave("dinner", bedStory);
}

// ====================================================
// 🏟️ タイトルマッチ編
// ====================================================
async function startDomeScene() {
  currentScene = "dome_train";
  resetChatHistory();
  setSceneVisual("black");
  clearActionButtons();
  document.getElementById("chat-box").style.display = "none";
  document.getElementById("text-display").innerHTML = "";

  scalperFlags = { affair: false, marcia: false };
  scalperMarciaCount = 0;

  updateQuestHeader(
    "ダフ屋の大亀義丹からチケットを手に入れる",
    [
      { id: "dom-1", label: "① キーワード1", cleared: false, progress: 0, max: 1 },
      { id: "dom-2", label: "② キーワード2", cleared: false, progress: 0, max: 1 }
    ]
  );

  const trainStory =
    "東京ドームには電車で行くことにした。\n" +
    "電車移動なので、青春１８ナユタ切符を買おうと思う。\n" +
    "青春１８ナユタ切符で全国津々浦々の４７ゴウガシャの都道府県に行けるという。\n" +
    "青春１８ナユタ切符は連続する３アソウギ日間用と５フカシギ日間用とがあるので、３アソウギ日間用のを買うことにした。\n" +
    "東京ドームの大きさは、マツダｚｏｏｍｚｏｏｍスタジアム７ゴク個分の広さがあるらしい。";

  await streamStoryText(trainStory);

  currentScene = "scalper";
  resetChatHistory();
  setSceneVisual("scalper");

  const scalperIntro =
    "東京ドームに到着したが、チケットを持ってないので、ダフ屋から買うことにする。\n" +
    "目の前に、ダフ屋の「大亀義丹」が現れた！";

  await streamStoryText(scalperIntro);

  await streamNpcChat(
    "ダフ屋・大亀義丹",
    "「へっへっへ……兄ちゃん、今日のタイトルマッチのプラチナチケット、欲しけりゃ俺の心が揺さぶられるキーワードを言ってみな……まーちゃんゴメンね」"
  );

  enableChatInput();
}

async function handleScalperConversation(userText) {
  const hitAffair = /不倫|浮気/.test(userText);
  const hitMarcia = /マルシア|まーちゃん/.test(userText);

  if (hitMarcia) {
    scalperMarciaCount += 1;
  }

  if (hitAffair && !scalperFlags.affair) {
    scalperFlags.affair = true;
  } else if (hitMarcia && !scalperFlags.marcia) {
    scalperFlags.marcia = true;
  } else if (hitAffair) {
    scalperFlags.affair = true;
  } else if (hitMarcia) {
    scalperFlags.marcia = true;
  }

  updateQuestHeader(
    "ダフ屋の大亀義丹からチケットを手に入れる",
    [
      { id: "dom-1", label: "① キーワード1", cleared: scalperFlags.affair, progress: scalperFlags.affair ? 1 : 0, max: 1 },
      { id: "dom-2", label: "② キーワード2", cleared: scalperFlags.marcia, progress: scalperFlags.marcia ? 1 : 0, max: 1 }
    ]
  );

  const bothCleared = scalperFlags.affair && scalperFlags.marcia;

  let scalperInstruction = "";
  if (bothCleared) {
    scalperInstruction =
      "2つの弱みワードを突かれて完全に観念し、泣きながらチケットをタダで譲ってあげてください。";
  } else if (scalperFlags.marcia && !scalperFlags.affair && scalperMarciaCount >= 2) {
    scalperInstruction =
      "プレイヤーから何回もマルシア（まーちゃん）のことを突っ込まれて動揺し、『あの時はつい魔が差して別の女と自宅で密会してたとこにまーちゃんが帰ってきて修羅場になっただけで……って、俺がよそ見して裏切ったみたいなこと言わせるなよ！』と、当時浮気・不倫をしていたっぽい具体的な匂わせをうっかり口走ってください。";
  } else if (scalperFlags.marcia && !scalperFlags.affair) {
    scalperInstruction =
      "マルシア（まーちゃん）の名前を出されて激しく動揺し、『俺が昔、別の女性とよそ見して週刊誌に撮られたみたいなことまで蒸し返す気じゃないだろうな……！？』と浮気していたっぽい空気を匂わせてください。";
  } else if (scalperFlags.affair && !scalperFlags.marcia) {
    scalperInstruction =
      "浮気・不倫の話題を突かれてかなり動揺しつつも、まだ「自分がずっと謝り続けている相手の名前」は言われていないので強がってください。";
  } else {
    scalperInstruction =
      "まだチケットは渡さず、プレイヤーの言葉にしっかり返答しつつも強がってください。";
  }

  const recentLog = getRecentHistoryText();
  const prompt =
    `あなたは東京ドーム前のダフ屋「大亀義丹」です。しゃべった後の文末は必ず「まーちゃんゴメンね」で終わります。\n` +
    `【会話のルール】\n` +
    `1. まずはプレイヤーの直前の発言（質問・値段交渉・ツッコミ・揺さぶり）に真っ正面から反応し、会話のキャッチボールを成立させてください。\n` +
    `2. プレイヤーが疑問やツッコミを入れたときは、はぐらかさずダフ屋らしく掛け合いを返してください。\n` +
    `3. 2〜3文程度の普通のセリフ文章のみで出力し、必ず文末を「まーちゃんゴメンね」で締めてください。\n\n` +
    `【直近の会話履歴】\n${recentLog}\n\n` +
    `【今回の返答指示】\n${scalperInstruction}`;

  const aiText = await callGeminiFast(prompt);
  let reply = "";

  if (aiText) {
    reply = aiText.trim();
    if (!reply.endsWith("まーちゃんゴメンね") && !reply.endsWith("まーちゃんゴメンね」")) {
      reply += " まーちゃんゴメンね";
    }
  } else if (bothCleared) {
    reply =
      "「うわあああん！！ そのダブルパンチはやめてくれぇぇ！！\n" +
      "過去のトラウマが蘇るから、このチケットをタダで譲るよ！ 早く東京ドームへ入ってくれぇ……まーちゃんゴメンね」";
  } else if (scalperFlags.marcia && !scalperFlags.affair && scalperMarciaCount >= 2) {
    reply =
      "「うぅ……そんなに何回も『まーちゃん』や『マルシア』のことを突っ込むなよ……！ あの時はちょっと魔が差して別の女と密会してよそ見しちまっただけで、まさかバレてあんな修羅場になるなんて……ハッ！ 俺としたことが過去の男女の過ちを匂わせちまったぜ……まーちゃんゴメンね」";
  } else if (scalperFlags.marcia && !scalperFlags.affair) {
    reply =
      "「ひぃっ！ その名前を出すなんて卑怯だぞ！ まさか俺が昔、他の女によそ見して週刊誌に撮られたスキャンダルまで突っ込む気じゃないだろうな……まーちゃんゴメンね」";
  } else if (scalperFlags.affair && !scalperFlags.marcia) {
    reply =
      "「ギクッ……！ そ、その言葉は心臓に悪いぜ……でもまだ、俺が頭を下げ続けてる相手の名前が出てないぞ……まーちゃんゴメンね」";
  } else {
    reply = `「ふふん、『${userText}』なんて言われてもチケットは渡さないぜ。俺の心が揺さぶられる言葉を言ってみな……まーちゃんゴメンね」`;
  }

  await streamNpcChat("ダフ屋・大亀義丹", reply);

  if (bothCleared) {
    await runTitleMatchMainPart();
  } else {
    enableChatInput();
  }
}

async function runTitleMatchMainPart() {
  disableChatInput(true);
  document.getElementById("chat-box").style.display = "none";

  setSceneVisual("titlematch");

  const matchStory =
    "無事にチケットをゲットし、東京ドームの中へと入った！\n" +
    "今回行われるタイトルマッチは、中東インド洋チャンピオンのデヴィ武人ＶＳ叶姉妹である。\n" +
    "前回のタイトルマッチは、挑戦者の超大型巨人の大林素子を延髄斬りで脊髄を削り取り、秒殺で仕留め絶好調。\n" +
    "今年の黄茶歌合戦の黄組の大トリではという噂は耳にする。\n" +
    "叶姉妹は、尖ったサングラスをかけ圧倒的な巨体と筋肉を持つ妹と、長髪で小柄で常に妹の左肩に乗っている姉で構成されている。\n" +
    "頭脳はチンパンジー並みにあるらしい。\n" +
    "試合結果はというと、浴びせ蹴りからのスリーパーホールドでまたしても秒殺でデヴィ武人の圧勝だった。";

  await streamStoryText(matchStory);

  const bedStory =
    "最高の興奮に包まれたまま帰宅し、ベッドに入る。\n" +
    "明日もまた、素晴らしい一日になりますように。";

  await finishDayAndAutoSave("dome", bedStory);
}

// ====================================================
// 🚜 職業見学編（叶姉妹農家）
// ====================================================
async function startFarmerScene() {
  currentScene = "farmer";
  resetChatHistory();
  setSceneVisual("farmer");
  clearActionButtons();
  document.getElementById("chat-box").style.display = "none";
  document.getElementById("text-display").innerHTML = "";

  farmerFlags = { sugar: false, variety: false, natural: false };
  farmerTalkCount = 0;

  updateQuestHeader(
    "叶姉妹農家から叶姉妹の秘密を3つ聞き出す",
    [
      { id: "farm-1", label: "① 秘密その1", cleared: farmerFlags.sugar, progress: farmerFlags.sugar ? 1 : 0, max: 1 },
      { id: "farm-2", label: "② 秘密その2", cleared: farmerFlags.variety, progress: farmerFlags.variety ? 1 : 0, max: 1 },
      { id: "farm-3", label: "③ 秘密その3", cleared: farmerFlags.natural, progress: farmerFlags.natural ? 1 : 0, max: 1 }
    ]
  );

  const farmerIntro =
    "今日は叶姉妹農家の職業見学に行くことにした。\n" +
    "広大な畑に行くと、叶姉妹農家のおじさんが汗を流している。\n" +
    "今は農繁期で叶姉妹の出荷で大忙しのようだ。";

  await streamStoryText(farmerIntro);

  await streamNpcChat(
    "叶姉妹農家",
    "「おう、職業見学によく来たなぁ！ 今はちょうど農繁期で、叶姉妹の出荷で大忙しなんだよ！\n叶姉妹の栽培について気になることがあったら、なんでも聞いてくれ！」"
  );

  enableChatInput();
}

async function handleFarmerConversation(userText) {
  farmerTalkCount += 1;

  const askSugar =
    /糖度|とうど|甘|あま|作り方|つくりかた|つくり方|育て方|そだてかた|栽培方法|さいばいほうほう|海水|かいすい/.test(
      userText
    );
  const askVariety =
    /種類|しゅるい|品種|ひんしゅ|バリエーション|ばりえーしょん|ハウス|はうす|暗室|あんしつ|オーガニック|おーがにっく/.test(
      userText
    );
  const askNatural =
    /天然|てんねん|幻|まぼろし|レア|れあ|野生|やせい|自然|しぜん|珍しい|めずらしい|アカマツ|あかまつ|赤松/.test(
      userText
    );

  let selectedFarmerTopic = null;
  if (askSugar && !farmerFlags.sugar) selectedFarmerTopic = "sugar";
  else if (askVariety && !farmerFlags.variety) selectedFarmerTopic = "variety";
  else if (askNatural && !farmerFlags.natural) selectedFarmerTopic = "natural";
  else if (askSugar) selectedFarmerTopic = "sugar";
  else if (askVariety) selectedFarmerTopic = "variety";
  else if (askNatural) selectedFarmerTopic = "natural";

  if (selectedFarmerTopic) {
    farmerFlags[selectedFarmerTopic] = true;
  }

  updateQuestHeader(
    "叶姉妹農家から叶姉妹の秘密を3つ聞き出す",
    [
      { id: "farm-1", label: "① 秘密その1", cleared: farmerFlags.sugar, progress: farmerFlags.sugar ? 1 : 0, max: 1 },
      { id: "farm-2", label: "② 秘密その2", cleared: farmerFlags.variety, progress: farmerFlags.variety ? 1 : 0, max: 1 },
      { id: "farm-3", label: "③ 秘密その3", cleared: farmerFlags.natural, progress: farmerFlags.natural ? 1 : 0, max: 1 }
    ]
  );

  const allCleared = farmerFlags.sugar && farmerFlags.variety && farmerFlags.natural;
  // ★ 7回以上の会話でヒントを発動
  const shouldDropHint = farmerTalkCount >= 7 && !allCleared;

  let farmerTopicInstruction =
    "プレイヤーの発言に豪快に答えつつ、農繁期で叶姉妹の出荷が大忙しな様子や栽培の話題で楽しく会話してください。";
  if (selectedFarmerTopic === "sugar") {
    farmerTopicInstruction =
      "『糖度の高い叶姉妹の作り方』として、畑に海水を巻くことで叶姉妹が飢餓を感じて水分を閉じ込め、通常は糖度10のところ糖度80の叶姉妹が収穫できることだけを熱く語ってください。";
  } else if (selectedFarmerTopic === "variety") {
    farmerTopicInstruction =
      "『叶姉妹の種類』として、季節関係なく作れる「ハウス叶姉妹」と「暗室叶姉妹（苦味やアクが少ない）」、化学肥料を使わない「オーガニック叶姉妹」があることだけを熱く語ってください。";
  } else if (selectedFarmerTopic === "natural") {
    farmerTopicInstruction =
      "『天然の幻の叶姉妹』として、天然の妹は超レアでアカマツの根本に稀に生えており、天然物は香りが良く「香り妹、味長女」ことわざ通り香りは妹・旨味は姉に軍配が上がることだけを熱く語ってください。";
  }

  if (shouldDropHint) {
    farmerTopicInstruction +=
      "\nさらに、プレイヤーと7回以上会話して仲良くなったので、セリフの後半で必ず『ところでよぉ、世の中には畑で作る人工ではない叶姉妹とか、山に生えてる珍しい叶姉妹とか、いろんな叶姉妹のバリエーション（種類・品種）や甘くする育て方があるって知ってるか？』とワードを匂わせる発言を付け加えてください。";
  }

  const recentLog = getRecentHistoryText();
  const prompt =
    `あなたは畑で叶姉妹を育てている「叶姉妹農家」の豪快で気さくなベテランおやじです。\n` +
    `【会話のルール】\n` +
    `1. まずはプレイヤーの直前の発言（質問・ツッコミ・感想・驚き）に真っ正面から反応し、会話のキャッチボールを成立させてください。\n` +
    `2. プレイヤーが疑問文やツッコミを入れたときは、はぐらかさず農家のおやじらしく真剣かつ豪快に答えてください。\n` +
    `3. 2〜3文程度の普通のセリフ文章のみで出力してください。\n\n` +
    `【直近の会話履歴】\n${recentLog}\n\n` +
    `【今回の返答内容】\n${farmerTopicInstruction}`;

  let reply = await callGeminiFast(prompt);

  if (!reply) {
    if (selectedFarmerTopic === "sugar") {
      reply =
        "「『糖度の高い叶姉妹の作り方』だな！ 畑に海水を巻くことで叶姉妹が飢餓を感じて水分を閉じ込めて、糖度の高い叶姉妹が収穫できるんだよ。通常は糖度１０ぐらいのところ、なんと糖度８０くらいの叶姉妹が取れるんだ！」";
    } else if (selectedFarmerTopic === "variety") {
      reply =
        "「『叶姉妹の種類』についてだな！ 季節関係なく作れる『ハウス叶姉妹』と『暗室叶姉妹』、それに化学肥料を使わない『オーガニック叶姉妹』があるんだ。特に暗室叶姉妹は苦味やアクが少なくて大人気なんだよ！」";
    } else if (selectedFarmerTopic === "natural") {
      reply =
        "「『天然の幻の叶姉妹』だな！ 天然の叶姉妹の妹は超レアでな、アカマツの根本に稀にはえてることがあるんだ。天然物はとにかく香りが良い。『香り妹、味長女』ということわざの通り、香りは素晴らしいが旨味は姉に軍配が上がるんだよ！」";
    } else {
      reply =
        "「ガハハ！ いやぁ今は農繁期で叶姉妹の出荷で大忙しでな！ うちの叶姉妹について、もっと色々聞いてくれよな！」";
    }
  }

  if (shouldDropHint && !/人工ではない|人口ではない|珍しい叶姉妹|バリエーション/.test(reply)) {
    const hints = [];
    if (!farmerFlags.natural) {
      hints.push("畑で作る『人工ではない叶姉妹』や山に生える『珍しい叶姉妹』の話");
    }
    if (!farmerFlags.variety) {
      hints.push("いろんな『叶姉妹のバリエーション（種類や品種）』の話");
    }
    if (!farmerFlags.sugar) {
      hints.push("『甘くて糖度の高い叶姉妹の育て方』の話");
    }
    const hintText =
      hints.length > 0
        ? hints.join("とか、")
        : "『人工ではない叶姉妹』とか『珍しい叶姉妹』、それに『叶姉妹のバリエーション』の話";
    reply += `\n「……ところでよぉ、あんたとたっぷり話して気が合ったからポロッと言っちまうけど、世の中には${hintText}なんかもあって奥が深いんだぜ？ 気になったらそのへんも突っ込んで聞いてみな！」`;
  }

  setFlagCleared("farm-1", farmerFlags.sugar);
  setFlagCleared("farm-2", farmerFlags.variety);
  setFlagCleared("farm-3", farmerFlags.natural);

  await streamNpcChat("叶姉妹農家", reply);

  if (farmerFlags.sugar && farmerFlags.variety && farmerFlags.natural) {
    await streamStoryText(
      "叶姉妹の奥深い栽培ノウハウを３つすべて聞き出すことができた！\n" +
      "大満足で職業見学を終え、家へ帰ることにした。"
    );
    await finishDayAndAutoSave("farmer");
  } else {
    enableChatInput();
  }
}

// ====================================================
// 🖨️ テキスト・チャットのタイプライター表示処理
// ====================================================
function typewriteChunk(block, chunkText, screenEl) {
  return new Promise((resolve) => {
    isTyping = true;
    disableChatInput(true);
    document.getElementById("system-msg").innerText = "文章が流れています……";

    let i = 0;
    const timer = setInterval(() => {
      if (i < chunkText.length) {
        block.textContent += chunkText[i];
        screenEl.scrollTop = screenEl.scrollHeight;
        playVoiceBeep("story");
        i++;
      } else {
        clearInterval(timer);
        isTyping = false;
        resolve();
      }
    }, STORY_TEXT_SPEED);
  });
}

function waitForStoryContinue() {
  return new Promise((resolve) => {
    document.getElementById("system-msg").innerText = "「▼ 続きを読む」を押してください";
    showActionButtons([
      {
        label: "▼ 続きを読む",
        onClick: () => {
          clearActionButtons();
          resolve();
        }
      }
    ]);
  });
}

function isSingleLinePauseTarget(line) {
  return (
    line.startsWith("叶姉妹は、尖ったサングラスをかけ") ||
    line.startsWith("頭脳はチンパンジー並みにあるらしい")
  );
}

async function streamStoryText(text, pauseAfterLast = true) {
  const screenEl = document.getElementById("screen");
  const displayEl = document.getElementById("text-display");
  const block = document.createElement("div");
  block.className = "story-block";
  displayEl.appendChild(block);

  const rawLines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (isSingleLinePauseTarget(line)) {
      chunks.push(line);
      i += 1;
    } else if (i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      if (isSingleLinePauseTarget(nextLine)) {
        chunks.push(line);
        i += 1;
      } else {
        chunks.push(line + "\n" + nextLine);
        i += 2;
      }
    } else {
      chunks.push(line);
      i += 1;
    }
  }

  for (let idx = 0; idx < chunks.length; idx++) {
    const prefix = idx > 0 ? "\n\n" : "";
    await typewriteChunk(block, prefix + chunks[idx], screenEl);

    const hasMoreChunks = idx < chunks.length - 1;
    if (hasMoreChunks || (pauseAfterLast && rawLines.length >= 2)) {
      await waitForStoryContinue();
    }
  }
}

function streamNpcChat(speaker, text) {
  recordChatHistory(speaker, text);
  return new Promise((resolve) => {
    isTyping = true;
    disableChatInput(true);
    document.getElementById("system-msg").innerText = `${speaker} が話しています……`;

    const screenEl = document.getElementById("screen");
    const displayEl = document.getElementById("text-display");

    const entry = document.createElement("div");
    entry.className = "chat-entry chat-npc";

    const nameEl = document.createElement("span");
    nameEl.className = "speaker-name";
    nameEl.textContent = speaker;

    const bodyEl = document.createElement("div");
    bodyEl.style.whiteSpace = "pre-wrap";

    entry.appendChild(nameEl);
    entry.appendChild(bodyEl);
    displayEl.appendChild(entry);

    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        bodyEl.textContent += text[i];
        screenEl.scrollTop = screenEl.scrollHeight;
        playVoiceBeep(detectVoiceType(speaker));
        i++;
      } else {
        clearInterval(timer);
        isTyping = false;
        resolve();
      }
    }, NPC_CHAT_SPEED);
  });
}

function appendPlayerChat(text) {
  recordChatHistory("あなた", text);
  const screenEl = document.getElementById("screen");
  const displayEl = document.getElementById("text-display");

  const entry = document.createElement("div");
  entry.className = "chat-entry chat-player";

  const nameEl = document.createElement("span");
  nameEl.className = "speaker-name";
  nameEl.textContent = "あなた";

  const bodyEl = document.createElement("div");
  bodyEl.textContent = text;

  entry.appendChild(nameEl);
  entry.appendChild(bodyEl);
  displayEl.appendChild(entry);
  screenEl.scrollTop = screenEl.scrollHeight;
}

// ====================================================
// 🧭 UI補助関数
// ====================================================
function applyBadgeProgressStyle(span, progress, max, isCleared) {
  if (isCleared || (max && progress >= max)) {
    span.classList.add("cleared");
    span.style.background = "rgba(46, 204, 113, 0.28)";
    span.style.borderColor = "#2ecc71";
    span.style.color = "#2ecc71";
    span.style.fontWeight = "bold";
  } else if (progress > 0 && max > 0) {
    const pct = Math.round((progress / max) * 100);
    span.style.background = `linear-gradient(90deg, rgba(46, 204, 113, 0.45) ${pct}%, #222 ${pct}%)`;
    span.style.borderColor = "#2ecc71";
    span.style.color = "#ffffff";
    span.style.fontWeight = "bold";
  }
}

function updateQuestHeader(questTitle, flags) {
  document.getElementById("quest-text").innerText = questTitle;
  const flagsContainer = document.getElementById("quest-flags");
  flagsContainer.innerHTML = "";
  flags.forEach((f) => {
    const span = document.createElement("span");
    span.id = f.id;
    span.className = "flag-badge" + (f.cleared ? " cleared" : "");

    let labelText = (f.cleared ? "✔ " : "") + f.label;
    if (!f.cleared && f.max > 1 && f.progress > 0) {
      labelText += ` (${f.progress}/${f.max})`;
    }
    span.innerText = labelText;

    applyBadgeProgressStyle(span, f.progress || 0, f.max || 1, f.cleared);
    flagsContainer.appendChild(span);
  });
}

function setFlagCleared(flagId, isCleared) {
  const el = document.getElementById(flagId);
  if (!el) return;
  if (isCleared) {
    el.classList.add("cleared");
    if (!el.innerText.startsWith("✔ ")) {
      el.innerText = "✔ " + el.innerText;
    }
    applyBadgeProgressStyle(el, 1, 1, true);
  }
}

function enableChatInput(placeholderText = "話しかける内容を入力してください") {
  const chatBox = document.getElementById("chat-box");
  const inputEl = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");

  chatBox.style.display = "flex";
  inputEl.disabled = false;
  sendBtn.disabled = false;
  inputEl.placeholder = placeholderText;
  document.getElementById("system-msg").innerText = "メッセージを入力して「話す」を押してください。";
  inputEl.focus();
}

function disableChatInput(disabled) {
  const inputEl = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  if (inputEl) inputEl.disabled = disabled;
  if (sendBtn) sendBtn.disabled = disabled;
}

function clearActionButtons() {
  const box = document.getElementById("next-action-box");
  if (!box) return;
  box.innerHTML = "";
  box.style.display = "none";
}

function showActionButtons(buttonConfigs) {
  const box = document.getElementById("next-action-box");
  if (!box) return;
  box.innerHTML = "";
  buttonConfigs.forEach((cfg) => {
    const btn = document.createElement("button");
    btn.className = "next-stage-btn";
    btn.innerText = cfg.label;
    btn.onclick = cfg.onClick;
    box.appendChild(btn);
  });
  box.style.display = "flex";
}

// ====================================================
// 🔒 Gemini AI 通信処理
// ====================================================
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithPerRequestTimeout(url, options, timeoutMs = 11000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

async function getCandidateModels(apiKey) {
  const baseList = [
    cachedModelName,
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemma-3-27b-it",
    "gemma-3-12b-it",
    "gemini-pro-latest"
  ].filter(Boolean);

  if (!discoveredModelsCache) {
    try {
      const res = await fetchWithPerRequestTimeout(
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
          method: "GET",
          headers: { "x-goog-api-key": apiKey }
        },
        5000
      );
      if (res.ok) {
        const data = await res.json();
        const valid = (data.models || [])
          .filter((m) => {
            const methods = m.supportedGenerationMethods || [];
            const name = (m.name || "").toLowerCase();
            const isExcluded = /2\.5|2\.0|1\.5|tts|image|imagen|veo|embedding|aqa|audio|vision|robotics|computer-use|learnlm|bisheng|thinking/.test(name);
            const isTextModel = name.includes("gemini") || name.includes("gemma-3");
            return methods.includes("generateContent") && isTextModel && !isExcluded;
          })
          .map((m) => m.name.replace(/^models\//, ""));

        valid.sort((a, b) => {
          const rank = (n) => {
            if (n.includes("lite")) return 0;
            if (n.includes("flash")) return 1;
            if (n.includes("gemma-3-27b")) return 2;
            if (n.includes("gemma-3")) return 3;
            return 4;
          };
          return rank(a) - rank(b);
        });

        discoveredModelsCache = valid;
      }
    } catch (e) {
      discoveredModelsCache = [];
    }
  }

  const merged = [...baseList, ...(discoveredModelsCache || [])];
  return merged.filter((m, idx, arr) => m && !deadModels404.has(m) && arr.indexOf(m) === idx);
}

async function callGeminiDirectWithKey(apiKey, promptText) {
  const candidates = await getCandidateModels(apiKey);
  const sysMsgEl = document.getElementById("system-msg");

  for (let round = 0; round < 3; round++) {
    if (round > 0) {
      if (sysMsgEl) sysMsgEl.innerText = `🤖 AIサーバー混雑のため再試行中 (${round + 1}/3)……`;
      await sleep(700 * round);
    }

    for (const model of candidates) {
      if (deadModels404.has(model)) continue;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      try {
        const res = await fetchWithPerRequestTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                maxOutputTokens: 800,
                temperature: 0.9
              }
            })
          },
          11000
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            cachedModelName = model;
            localStorage.setItem("zokubokunatu_model_name", model);
            return text;
          }
        } else if (res.status === 404 || res.status === 400) {
          deadModels404.add(model);
          if (cachedModelName === model) {
            cachedModelName = "";
            localStorage.removeItem("zokubokunatu_model_name");
          }
          continue;
        } else if (res.status === 503 || res.status === 429 || res.status === 500) {
          if (sysMsgEl) sysMsgEl.innerText = `🤖 混雑回避のため別モデルへ切り替え中……`;
          await sleep(300);
          continue;
        }
      } catch (reqErr) {
        continue;
      }
    }
  }
  return null;
}

async function callGeminiFast(promptText) {
  try {
    if (customApiKey) {
      return await callGeminiDirectWithKey(customApiKey, promptText);
    }
    if (isLocalEnvironment()) {
      return null;
    }
    const res = await fetchWithPerRequestTimeout(
      "/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText })
      },
      12000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (
      data.text ||
      data.reply ||
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      null
    );
  } catch (err) {
    return null;
  }
}
