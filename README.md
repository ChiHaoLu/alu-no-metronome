# 節拍器

極簡節拍器 webapp。Vite + TypeScript，沒有前端框架，也沒有後端。

## 功能

- **BPM**：20–300，可以按 −/+（長按連續）、拖滑桿，或點數字直接輸入
- **音量**：播放中也能調整
- **重音**：每個音一格，勾選的就是重音；換音符時，重音會留在原本的拍子上
- **音符**：二分、附點四分、四分、八分、三連音、十六分、六連音、三十二分
- **每小節拍數**：1–16。除不盡小節的音符會停用，例如 3 拍時不能選二分音符
- **預備拍**：關、1 小節、2 小節。只打拍點，音色和正式拍不同，不計入自動變速
- **自動變速**：每 N 小節調整 BPM。`+4` 是每次加快，`-2` 是每次放慢，`+4 -2` 是兩者輪流

BPM 計的是「拍」，音符決定每拍之間要打多少下。例如 6/8 可以設成 2 拍 + 三連音，或 6 拍 + 四分音符。

鍵盤：`Space` 開始／停止，方向鍵調整 BPM。設定會存在瀏覽器裡。

## 開發

```bash
npm install
npm run dev
```

```bash
npm test
```

## 部署

網址：https://chihaolu.github.io/alu-no-metronome/

每次 push 到 `main`，GitHub Actions 會自動建置並部署到 GitHub Pages（[`deploy.yml`](.github/workflows/deploy.yml)）。Pages 的來源要設為 GitHub Actions。

`npm run build` 會先跑型別檢查和測試，任何一項失敗，該次部署就會失敗。

## 程式結構

| 檔案 | 用途 |
| --- | --- |
| `src/notes.ts` | 音符定義、小節格數、重音對應 |
| `src/sequencer.ts` | 節奏邏輯，不碰音訊和畫面，所以能精確測試 |
| `src/metronome.ts` | 用 Web Audio 排程發聲 |
| `src/timer.worker.ts` | 排程心跳，避免背景分頁的計時器被節流 |
| `src/main.ts` | 介面 |
| `src/store.ts` | 儲存設定、解析變速輸入 |
