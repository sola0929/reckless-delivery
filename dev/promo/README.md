# 宣傳素材

成品都在 `export/`：主視覺各尺寸（keyart-*.png）、X 橫幅（header-1500x500.png）、截圖（shots/shot-N.png 乾淨版、shot-N-caption.png 社群版）。介紹文字在 `dev/notes/promo-text.md`。

- 主視覺：`node dev/promo-pose.mjs`（擺姿勢拍原始畫面，參數見檔頭）→ 複製成 `keyart-scene.png` → `node dev/promo-compose.mjs keyart <寬> <高>`
- 橫幅：`node dev/promo-compose.mjs header 1500 500`
- 截圖：`dev/promo-play.mjs <shots.json 裡的名稱>`、`dev/promo-ball.mjs`、`dev/promo-foot.mjs`、`dev/promo-result.mjs`，挑好放進 `export/shots/`
- 社群版說明文字：`captions.txt` 一行一張，`**` 包起來的字是黃色；用 `QUERY="img=export/shots/shot-N.png&text=…" node dev/promo-compose.mjs caption 1920 1080 export/shots/shot-N-caption.png`
