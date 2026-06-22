# 4D Beige クロスフェード演出サンプル

LUNASOL「4D Beige」のスクロール連動クロスフェード演出デモです。

## プロジェクト構成

| フォルダ | 説明 |
|----------|------|
| `crossfade-demo-vanilla/` | 素の JavaScript 版 |
| `crossfade-demo-gsap/` | GSAP + ScrollTrigger 版（vanilla 移植） |
| `crossfade-demo-gsapV2/` | GSAP ハイブリッド版（タイムライン + scrub） |
| `4D Beige クロスフェード演出サンプル（スタンドアロン）.html` | 1ファイル配布用（バンドル済み） |

## 起動方法

`file://` ではフォント読み込み等で問題が出る場合があるため、ローカルサーバー経由での確認を推奨します。

### Vanilla 版

```bash
cd crossfade-demo-vanilla
python3 -m http.server 8765
```

ブラウザで [http://localhost:8765/](http://localhost:8765/) を開く。

### GSAP 版

GSAP は CDN から読み込むため、インターネット接続が必要です。

```bash
cd crossfade-demo-gsap
python3 -m http.server 8766
```

ブラウザで [http://localhost:8766/](http://localhost:8766/) を開く。

### GSAP V2 版（ハイブリッド）

Morph をタイムライン、Cross を scrub トゥイーンで制御する簡略版です。

```bash
cd crossfade-demo-gsapV2
python3 -m http.server 8767
```

ブラウザで [http://localhost:8767/](http://localhost:8767/) を開く。
