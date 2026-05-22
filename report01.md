# Pixel Farm Game 深度研究報告

## 執行摘要

`pixel-farm-game` 不是單純的前端練習頁，而是一個已具備可運行基礎的 Web 遊戲原型：後端以 Node.js/Express 啟動，前端以原生 HTML/CSS/JavaScript 與 `<canvas>` 呈現，資料層使用 SQLite，並已接上 WebSocket、Push 通知、好友互動、簽到與成就等模組。`package.json` 的啟動點是 `server/index.js`，依賴包含 `express`、`better-sqlite3`、`ws`、`web-push`、`node-cron`、`jsonwebtoken` 等；Express 也直接靜態提供 `client` 目錄。citeturn39view0turn13view13turn13view14turn38view2turn16view4turn15view1

從產品角度看，這個專案最有價值的地方不是「種菜」，而是它已經把「陪伴式社交」做出雛形：可拜訪好友農場、幫好友澆水、發送留言、送種子、接收通知，且 README 明確把目標語境寫成「老年人專屬操作指南」。這讓它非常適合轉成 hackathon 的「長者社交園藝遊戲」Demo。citeturn22view0turn33view0turn33view1turn35view0turn38view3

但若以「高齡友善 Demo」看，現況仍有幾個關鍵缺口。專案雖然已有大字模式、高對比模式、語音播報、ARIA dialog/toast 等基礎可近用設計，但預設字級仍偏小，頂欄控制元件過密，主要互動仍落在 `<canvas>`，且 CSS 已使用多種動畫/transition，卻尚未對應 `prefers-reduced-motion`；同時全域 `touch-action: none` 也可能壓抑行動裝置原生觸控手勢。這些都不會阻止 Demo，但會顯著影響「長者一上手就會用」的成功率。citeturn17view0turn17view1turn18view0turn16view6turn29view0turn29view1turn29view2turn28view6turn43view4turn43view5

我的結論很明確：**這個專案已經達到「功能型原型」水位，下一步不該再擴張功能面，而是把介面簡化成長者第一天也能完成的社交循環。** 對 48–72 小時 hackathon 而言，最佳策略是把 Demo 收斂為「登入／快速進場 → 種一株 → 去好友家澆水 → 留一句暖心話 → 收到回饋通知」，並補上字級、按鈕尺寸、預設留言、事件指標與簡報敘事。這比再做排行榜、微信通知或更大型系統更有勝率。citeturn38view3turn34view0turn34view6turn24view1turn4view0

## 專案盤點與完整度

### 假設

| 項目 | 本報告採用的假設 |
|---|---|
| 部署目標 | 先以 Web 應用為主，優先支援本機或雲端 Node 部署；原因是 README 指引使用 `http://localhost:3000`，且 Express 直接提供前端靜態目錄。 |
| 使用裝置 | Demo 以「筆電投影 + 1 台手機或平板」為主；現有介面是瀏覽器頁面、`<canvas>` 遊戲區與 HTML modal 的組合。 |
| 團隊規模 | 假設 3–4 人：前端/互動 1、後端/API 1、產品/UI 1、測試/簡報或視覺支援 0.5–1。 |

上述部署與裝置假設，與現有 README 的啟動方式及 Express 靜態服務模式一致。citeturn38view3turn13view13turn17view0

### 主要檔案與資料夾

| 路徑 | 類型 | 角色 | 觀察 |
|---|---|---|---|
| `client/` | 資料夾 | 前端應用根目錄 | 目前可見 `index.html`、`css/`、`js/`，前端是明確的原生 Web 結構。 citeturn11view0turn8view0turn9view0 |
| `client/index.html` | 檔案 | UI 骨架 | 含登入/註冊、遊戲頁、種子/通知/好友/留言/簽到/成就/送禮彈窗與 toast。 citeturn17view0turn17view1turn17view2turn17view3turn18view0 |
| `client/css/style.css` | 檔案 | 視覺樣式與可近用樣式 | 已有大字模式與高對比模式；預設字級仍偏小。 citeturn29view0turn29view1turn29view5 |
| `client/js/game.js` | 檔案 | 遊戲主迴圈與互動狀態 | 管理農場刷新、工具操作、好友農場模式、WebSocket 事件與動畫迴圈。 citeturn35view0turn16view3turn34view3turn34view4 |
| `client/js/ui.js` | 檔案 | UI 協調器 | 負責 modal、好友清單、留言、送禮、簽到、操作提示與 toast。 citeturn26view3turn16view1turn33view0turn33view1turn30view4 |
| `client/js/network.js` | 檔案 | API / WebSocket 管理 | 提供 GET/POST/DELETE 與同源 WebSocket 連線／重連機制。 citeturn16view4turn16view5turn15view1 |
| `client/js/renderer.js` | 檔案 | Canvas render 層 | 代表畫面主要由程式繪製，而非大量靜態 sprite 資產。 citeturn11view5turn17view0 |
| `client/js/push.js` | 檔案 | 推播訂閱流程 | 會註冊 Service Worker 並呼叫 `/api/notifications/subscribe`。 citeturn12view9turn24view1 |
| `client/js/voice.js` | 檔案 | 語音播報 | 使用 `window.speechSynthesis`，預設語言設為 `zh-CN`、播放速度 0.9。 citeturn16view6 |
| `database/` | 資料夾 | 本地資料檔目錄 | 後端程式明確把資料庫寫入 `./database/farm_game.db`。 citeturn0view0turn38view2 |
| `docs/screenshots/` | 資料夾 | 文件截圖資產 | 已有登入、主畫面、種子、種植、澆水、通知、好友等 PNG，利於簡報與 Demo 素材整理。 citeturn10view4 |
| `server/` | 資料夾 | 後端應用根目錄 | 結構分成 `jobs/`、`middleware/`、`notifications/`、`routes/`、`services/`，模組化清楚。 citeturn6view1turn10view2turn10view3turn10view1turn10view0turn9view6 |
| `server/app.js` | 檔案 | Express app | 含安全標頭、速率限制、靜態服務、API 掛載與健康檢查。 citeturn38view1turn13view12 |
| `server/index.js` | 檔案 | 伺服器啟動點 | 啟動 HTTP 與 WebSocket，預設列出 `localhost` 位址。 citeturn13view14 |
| `server/database.js` | 檔案 | SQLite 資料層 | 使用 `better-sqlite3`，並建立 `users` 等資料表。 citeturn12view13turn38view2 |
| `server/websocket.js` | 檔案 | 即時訊息分發 | 提供 `sendToUser` 與 `broadcast`。 citeturn13view15 |
| `server/routes/` | 資料夾 | REST API 路由 | 含 `auth`、`farm`、`crops`、`friends`、`notifications`、`checkin`、`achievements`。 citeturn10view2turn13view12 |
| `server/services/` | 資料夾 | 業務邏輯層 | 把農場、好友、簽到、成就、通知拆成 service。 citeturn10view3 |
| `server/notifications/` | 資料夾 | 通知 provider 架構 | 已預留 email / in-app / push / SMS / WeChat provider。 citeturn10view1 |
| `package.json` | 檔案 | 啟動腳本與依賴 | `start`/`dev` 都指向 `node server/index.js`；無 `test` script；`playwright` 被放在 dependencies 而非 devDependencies。 citeturn39view0 |
| `README.md` | 檔案 | 新手操作與說明 | 文件極度偏向「給長者看得懂」，這是很強的產品訊號。 citeturn38view3 |
| `ROADMAP.md` | 檔案 | 後續規劃 | 未來迭代已提到語音助手、微信通知、一鍵求助、數據後台等方向。 citeturn4view0 |

### 技術堆疊與目前完成度

就技術面而言，這個專案是**原生前端 + Node/Express + SQLite + WebSocket/Push** 的小型全端架構，而不是重框架專案。這有兩個直接好處：第一，hackathon 期間修改成本低；第二，UI/遊戲邏輯/API 邊界已經分得夠清楚，`UIManager`、`NetworkManager`、`FarmGame` 與 server `routes/services` 的拆分，足以支撐短期快速迭代。citeturn39view0turn26view3turn16view4turn35view0turn10view2turn10view3

完整度上，我會把它判為**「可玩原型已完成，長者版 Demo 尚未收斂」**。核心循環「選種子 → 種植 → 澆水 → 收成」已可跑；好友互動也不只是列表展示，而是已經做到搜尋、邀請、接受/拒絕、留言、送禮、拜訪好友農場與替好友澆水；通知、成就、簽到也都有前後端鉤子。這代表功能廣度其實已偏高。citeturn38view3turn16view3turn22view0turn33view0turn33view1turn24view0turn24view1turn30view4

相對地，工程成熟度還停在 Demo 前一階段。`package.json` 沒有 `test` 指令，也未見可見的 CI/部署設定；`playwright` 雖在 dependencies 中，但目前並未在腳本層被正式接入。另一个小型技術債是套件同時帶了 `better-sqlite3` 與 `sqlite3`，但資料層程式碼明確使用的是前者。這些都不會阻止 hackathon，但若要在短時間內穩定展示，至少要補 smoke test、seed data 與部署檢查清單。citeturn39view0turn38view2turn0view0

## 長者社交適配評估

### 現有使用流程

以目前實作來看，使用者會先在登入/註冊頁建立帳號，再進入遊戲主畫面；主畫面頂欄顯示玩家名、金幣、經驗與一排功能按鈕，底部再切換工具模式。點地塊後，`game.js` 會依目前工具決定是查看、種植、澆水或收成。這種流程在一般遊戲使用者眼中合理，但對長者來說，**模式切換 + 畫布點擊** 是較高的學習負擔。citeturn17view0turn18view0turn16view3

社交流程則比我原先預期成熟。好友 modal 已可搜尋帳號、查看待處理請求、進入好友農場、留言、送種子、刪好友；拜訪好友農場後，系統還會隱藏「種植／收成」工具，只保留較合情境的操作，並把提示文改成「選擇澆水工具幫好友澆水」。這個設計其實很接近長者社交所需要的「低壓力、低競爭、溫和互動」。citeturn17view1turn17view2turn33view0turn33view1turn36view0turn34view6

### 與長者社交需求的契合度

| 面向 | 現況 | 判斷 |
|---|---|---|
| 可讀性 | 已有大字與高對比模式，但預設字級只有 `13px / 11px / 12px` 等級，提示文字與描述偏小。 citeturn29view0turn29view1turn29view4turn29view6 | **中** |
| 點擊負擔 | 工具按鈕約 `52x44`，關閉按鈕 `28x28`；W3C WCAG 2.2 對較小 target 的最低基準與 24px 有關，現況技術上未低於最低線，但對長者仍偏緊。 citeturn29view4turn30view1turn43view1 | **中偏低** |
| 互動簡單度 | 頂欄同時擺了種子、大字、對比、語音、推播、通知、簽到、成就、好友、刷新、登出等超過十個控制項；底部又有四種工具與鍵盤提示。 citeturn17view0turn12view2turn18view0 | **偏低** |
| 社交深度 | 好友搜尋、邀請、接受、留言、送禮、拜訪、代澆水都已存在，且通知與成就可形成回饋閉環。 citeturn22view0turn33view0turn33view1turn35view0 | **高** |
| 情緒支持 | README 的敘事是照顧型、陪伴型，訊息風格柔和，社交動作也偏互助。 citeturn38view3turn34view6 | **高** |
| 可近用廣度 | 已有語音播報與多個 ARIA role/live 區塊，但主互動仍在 `<canvas>`；CSS 有 pulse、modal slide、transition，尚未顯示依 `prefers-reduced-motion` 降低動畫；語音語系目前固定為 `zh-CN`。 citeturn16view6turn17view0turn18view0turn28view6turn28view7turn43view4turn43view5 | **中** |

整體而言，這個遊戲**對「社交陪伴」比對「高齡易用」做得更好**。它已經具備溫和社交的骨架，但 Demo 若要打中評審，不能只說「我們有大字模式」，而要讓使用者在第一分鐘就感受到「我這次不是來玩一個複雜遊戲，而是來照顧自己的園子、順便跟朋友互動」。這需要把現有十多個功能抽成 3–4 個大按鈕入口，而不是把所有能力都直接暴露。這是我的分析判斷，依據是目前的控件密度、字級設定與社交流程配置。citeturn17view0turn18view0turn29view0turn33view0turn36view0

## Hackathon MVP 建議

### 優先原則

對 hackathon 來說，現在最不缺的是「功能點」，最缺的是**一條能在 3 分鐘內穩定演完的長者社交故事線**。因此我建議把現有功能切成兩層：**Must-have = 一定做、直接提高 Demo 命中率**；**Nice-to-have = 有時間再做、但不影響主敘事**。同時，不建議這輪再往排行榜、微信通知、語音助手或更大型後台擴張，因為 `ROADMAP` 本來就把它們放在後續迭代，短期投入報酬不如收斂體驗。citeturn4view0

### 建議 MVP 功能清單

**估時以「人時」計，不是日曆時間。**

| 優先級 | 功能 | 目的 | 估時 | 需要角色 |
|---|---|---:|---:|---|
| Must-have | 長者版首頁重構 | 把目前分散頂欄改成 3 個大入口：**種菜、看好友、今日任務** | 6–8h | 前端、UI |
| Must-have | Demo 帳號與假資料種子 | 免註冊卡關，進場直接可玩、可拜訪好友、可見通知 | 4–6h | 後端、前端 |
| Must-have | 一鍵社交循環 | 「去好友家 → 幫澆水 → 留預設訊息 → 收到回饋」做成最短路徑 | 6–8h | 前端、後端、產品 |
| Must-have | 預設留言與大按鈕送禮 | 降低文字輸入壓力，保留情感交流 | 4–5h | 前端、UI |
| Must-have | 無障礙快修包 | 預設大字、按鈕放大、減少動畫、強化 focus/對比、語音語系切換 `zh-TW`/`zh-CN` | 8–10h | 前端、UI、QA |
| Must-have | Demo 指標埋點 | 蒐集首次種植、首次社交、完成循環、按鈕使用率 | 3–5h | 前端、產品 |
| Nice-to-have | 推播提醒 Demo 化 | 保留現有訂閱能力，但做成「成熟提醒／好友回覆」展示版 | 4–6h | 前端、後端 |
| Nice-to-have | QR 快速加好友 | 現場掃碼配對第二台裝置，提高展示張力 | 4–6h | 前端、後端 |
| Nice-to-have | 成就摘要卡 | 把成就從列表改成「本日陪伴紀錄」 | 3–4h | 前端、UI |
| Nice-to-have | 家屬/志工模式 | 額外做「今日已關心幾位長者」簡短視圖 | 6–8h | 前端、後端、產品 |

如果團隊只有 3 人、48 小時左右，我建議 **只鎖 Must-have 六項，總量控制在 31–42 人時**。超過這個量，Demo 很容易變成功能多但演示鬆散。若團隊有第 4 人，才把 QR 配對或推播提醒列入衝刺延伸。

## 介面與體驗改造

### 具體 UI/UX 與無障礙調整

| 位置 | 目前問題 | 建議改法 | 依據 |
|---|---|---|---|
| 頂欄 | 控件過多，超過十個動作同列，易造成選擇壓力 | 收斂為「種子」「好友」「今日任務」「更多」四大入口，其餘收進二級面板 | 目前頂欄按鈕密度很高。 citeturn17view0turn12view2 |
| 預設字級 | 基準字級 `13px`、hint `11px`，對長者偏小 | 長者版預設直接套 `large-font`，並把提示／成就描述至少拉到 14–16px | 現有預設字級偏小。 citeturn29view0turn29view6 |
| 關閉按鈕 | `28x28` 雖不低於 WCAG 最小概念，但對老人手指仍偏小 | 放大至至少 40x40，並增加可點擊區域 | 現有 close button 尺寸與 WCAG target size 依據。 citeturn30view1turn43view1 |
| 動畫 | loading pulse、modal slide、progress transition 已存在 | 加上 `@media (prefers-reduced-motion: reduce)`，把 pulse/slide 改淡化或取消 | 專案已用動畫，但尚未對應 reduced-motion。 citeturn28view6turn28view7turn43view4turn43view5 |
| 語音 | 目前語音管理器語系寫成 `zh-CN` | 增加語音語系選擇，台灣 Demo 預設 `zh-TW`；保留開關 | 現有語音設定。 citeturn16view6 |
| 畫布互動 | 主交互落在 `<canvas>`，對閱讀器與第一次使用者都不夠直觀 | 在畫布上方加「可點格子高亮 + 單一步驟提示」，並為核心操作加 HTML 替代入口（例如「澆最近一格」快捷鍵鈕） | 目前主互動確實經由 canvas 與工具模式決定。 citeturn17view0turn16view3turn35view0 |
| 文字輸入 | 留言是自由輸入，長者可能不想打字 | 提供 6 個情境預設句：如「我來幫你澆水了」「今天也很棒」「一起收成吧」 | 目前留言是純文字輸入。 citeturn17view3turn33view1 |
| 觸控 | 全域 `touch-action: none` 可能壓抑原生手勢 | 只對真正需要的遊戲區局部套用，讓其他區域保留系統手勢 | 目前全域設定存在風險。 citeturn29view2 |

### 建議 Demo 使用者旅程

```mermaid
flowchart LR
    A[進入長者版首頁] --> B[點選開始照顧花園]
    B --> C[自動載入 Demo 帳號]
    C --> D[選一包種子]
    D --> E[在自己的花園種下第一株]
    E --> F[前往好友花園]
    F --> G[幫好友澆水]
    G --> H[送出預設暖心留言]
    H --> I[收到通知或成就回饋]
    I --> J[完成今天的陪伴任務]
```

這條旅程的關鍵，不是把所有功能都演出來，而是把「**園藝 = 陪伴**」這件事講清楚。現有程式碼本來就支援好友農場、代澆水、留言、通知與成就，所以這條旅程主要是收斂入口與簡化触發，不是重寫整個產品。citeturn36view0turn33view0turn33view1turn35view0

### 簡化版首頁線框

```text
┌──────────────────────────────────────┐
│  早安，王奶奶 🌱                      │
│  今天有 1 株作物成熟、2 位好友互動      │
├──────────────────────────────────────┤
│  [ 開始照顧花園 ]   [ 去看看好友 ]      │
│                                      │
│  [ 今日任務：幫 1 位好友澆水 ]         │
│                                      │
│  你的花園預覽：                       │
│  ┌──────────────┐                    │
│  │ ■ ■ □ □      │                    │
│  │ ■ □ □ □      │                    │
│  │ □ □ □ □      │                    │
│  └──────────────┘                    │
│                                      │
│  快捷互動：                           │
│  [ 幫好友澆水 ] [ 傳一句問候 ] [ 收成 ] │
├──────────────────────────────────────┤
│  大字開 / 語音開 / 低動畫 / 更多        │
└──────────────────────────────────────┘
```

我建議把這個首頁當成 hackathon 主畫面，而不是直接把目前完整遊戲主畫面投給評審。因為現有主畫面功能雖多，但頂欄與工具列太滿；改成首頁式入口後，既能保留原始遊戲邏輯，又能把長者價值主軸前置。citeturn17view0turn18view0turn29view3turn29view4

## Demo 劇本與簡報主軸

### Demo 劇本

| 時間 | 畫面 | 台詞重點 |
|---|---|---|
| 0:00–0:20 | 長者版首頁 | 「我們把種菜遊戲改成長者每天願意打開的陪伴入口。」 |
| 0:20–0:50 | 種第一株作物 | 「操作只要一個主要按鈕；今天先種一株 1 分鐘成熟的小麥。」 |
| 0:50–1:20 | 去好友農場幫澆水 | 「社交不是競爭，而是互相照顧；我可以直接去好友家幫忙。」 |
| 1:20–1:45 | 傳預設留言/送種子 | 「對長者，最重要的是不用打很多字，也能把關心送出去。」 |
| 1:45–2:10 | 收到通知/成就 | 「每次互動都有回饋，讓陪伴被看見。」 |
| 2:10–2:40 | 切換大字 / 語音 / 低動畫 | 「它不是把老人硬塞進年輕人的遊戲，而是從可讀、可點、可聽開始重做。」 |
| 2:40–3:00 | 顯示指標面板 | 「我們追的不是留存數字，而是第一次就做到社交互動的成功率。」 |

這套 Demo 劇本能成立，是因為現有 README 已經把小麥 1 分鐘成熟、長者操作指引與核心循環寫清楚，而程式也已支援好友農場、留言、送禮、通知、語音與成就。citeturn38view3turn34view0turn34view6turn33view1turn35view0turn16view6

### 三分鐘 Pitch 大綱

第一段先講問題：高齡者常見的社交斷裂，不是他們不想互動，而是現代數位產品太複雜、太快、太擁擠。第二段講解法：我們把「種菜」變成一個低門檻社交儀式，使用者每天只要照顧花園、順手去好友家澆水，就完成一次陪伴。第三段講證據：專案已經不是概念圖，而是有後端、資料持久化、好友互動、通知與語音輔助的可運行原型。citeturn38view3turn39view0turn38view2turn22view0turn24view1turn16view6

Pitch 中最值得突出的新意有三個。第一，它把遊戲目標從「高刺激娛樂」換成「輕互助陪伴」。第二，它不是做聊天室，而是把社交埋進有情境的日常動作，例如代澆水、送種子、暖心留言。第三，它對長者不只做字體放大，而是同時設計閱讀、點擊、語音與回饋節奏。citeturn34view6turn33view0turn33view1turn17view0turn16view6

### Demo 要展示的指標

建議只展示 4 個指標，而且都要跟「長者社交」直接相關：

| 指標 | 為何重要 |
|---|---|
| 首次種植完成率 | 驗證是否真的容易上手 |
| 首次社交完成率 | 驗證是否能把玩家從單人玩法拉到陪伴行為 |
| 完成一次「澆水 + 留言」所需步數 | 驗證介面是否足夠簡潔 |
| 大字 / 語音 / 低動畫開啟率 | 驗證可近用功能有沒有被真正用到 |

若要在 hackathon 快速埋點，`posthog-js` 是很實用的選擇；官方文件也提供 `posthog.init(...)` 的前端接法與預設 opt-out 能力。citeturn43view8

## 衝刺計畫與風險

### 48–72 小時衝刺安排

| 時段 | 目標 | 主要任務 | 里程碑 |
|---|---|---|---|
| 0–12h | 收斂產品範圍 | 決定 Demo 主旅程、切版長者首頁、整理 Demo 文案、建立假資料策略 | 有可走通的 storyboard |
| 12–24h | 完成主流程 | Demo 帳號、自動 seed data、首頁入口、快速跳轉自己/好友花園 | 可從首頁走到第一次社交 |
| 24–36h | 做可近用修正 | 預設大字、按鈕放大、降低動畫、語音語系切換、預設留言 | 長者版操作可一鏡到底 |
| 36–48h | 做展示加分項 | 指標埋點、成就/通知整理、簡報素材、錄製備援影片 | 完整彩排一次 |
| 48–72h | 緩衝與擴展 | 推播提醒展示、QR 加好友、最後 QA、錯誤處理/清單 | Demo 穩定度提升 |

### 主要風險與緩解

目前最大的風險不是功能做不出來，而是**流程太散、進場太慢、演出太多**。現有 UI 一次暴露太多按鈕，評審若第一次看到完整主畫面，容易先理解成「功能很多」，而不是「長者真的會用」。所以第一優先不是補更多模組，而是把主畫面重構成故事線。citeturn17view0turn18view0

第二個風險是推播與環境設定。前端推播流程會註冊 Service Worker，後端路由也要求 VAPID 公鑰；若現場環境沒配好，容易在 Demo 當下掉鏈子。因此建議把推播當成**可展示但非主路徑**，並準備通知 modal 的本地 fallback。citeturn12view9turn24view0turn24view1turn24view2

第三個風險是測試不足。`package.json` 沒有正式 `test` 指令，雖然依賴中有 `playwright`，但還沒有展示級的 smoke test 流程。最務實的補法是做一份「Demo 前檢查表」：登入、種植、成熟、好友澆水、留言、通知、返回自己農場，每一項都彩排。citeturn39view0turn34view0turn36view0turn33view1

## 建議新增套件與 API

### 優先清單

| 優先 | 套件 / API | 用途 | 為何適合這個專案 |
|---|---|---|---|
| 高 | **PostHog JS** | Demo 指標與事件分析 | 官方文件提供 `posthog.init(...)`，很適合快速量測「首次種植」「首次社交」「輔助功能開啟率」。 citeturn43view8 |
| 高 | **Zod** | 前後端 schema 驗證 | Zod 是 TypeScript-first 驗證庫，能快速把輸入檢查與錯誤格式化補齊；對目前多個 API body 很有幫助。 citeturn44view0 |
| 中高 | **axe-core** | 自動化無障礙檢查 | axe-core 官方定位就是 automated Web UI accessibility testing，很適合在最後 24 小時做 UI 快速掃描。 citeturn45view0turn45view1 |
| 中 | **i18next** | 字串外部化與 zh-TW / zh-CN 切換 | 目前 README 與介面語境多為簡中，若 demo 面向台灣或雙語評審，i18next 很適合快速整理字串。官方文件也提供簡單安裝方式。 citeturn43view7turn38view3turn16view6 |
| 中 | **node-qrcode** | 快速加好友 / Demo 掃碼入場 | 官方 README 同時提供 browser 與 server API，可用於「掃碼加好友」或「用第二台裝置快速進場」。 citeturn45view2 |

### 導入順序建議

若只有一次衝刺，我建議順序是：**PostHog → 無障礙快修 → Zod → i18next → QR 配對**。原因很簡單：hackathon 評審先看故事能不能成立，其次看你有沒有量測與驗證，再來才是工程整潔與擴展性。對這個專案而言，最優的勝利路徑不是大型改寫，而是把現有完整原型包裝成一個可被長者立即理解的陪伴產品。這個判斷建立在專案目前已具備的功能廣度，以及 W3C/MDN 對可近用基準的要求之上。citeturn22view0turn35view0turn42view0turn43view4turn43view5