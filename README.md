# Masterpiece Timer（番茄钟 × 画作上色）

以「专注过程逐步揭示艺术画作」为核心体验的番茄钟 App。
一次专注把一幅画从灰度逐步恢复为彩色：界面中存在一条细微的半透明上色边界线，
随有效专注进度从画作左侧向右侧移动，经过的区域恢复原色。

技术栈：**React 19 + TypeScript（strict）+ Vite + Capacitor 8**

## 在线体验

Web 预览：https://magicspirit007.github.io/MasterpieceTimer/

浏览器即可走完主流程（选项目、专注上色、统计、展览）。通知、触感、系统日期选择器等原生能力不可用；数据存在本机浏览器，清站点数据会丢失。


## 许可

本仓库源码按 [PolyForm Noncommercial License 1.0.0](LICENSE) 发布（SPDX：`PolyForm-Noncommercial-1.0.0`）。

| 用途 | 是否允许 |
| --- | --- |
| 个人学习、研究、自用、爱好项目 | 允许 |
| 学校、公益、公共研究等非营利机构 | 允许 |
| 任何商业用途（上架商店、收费、嵌入产品、公司内部商用等） | **须先与作者协商并取得书面许可** |

商用请开 [Issue](https://github.com/MagicSpirit007/MasterpieceTimer/issues) 说明用途，或通过 GitHub 联系 [@MagicSpirit007](https://github.com/MagicSpirit007)。

内置名画影像为公有领域复制件，出处见 [ATTRIBUTION.md](ATTRIBUTION.md)，不受上表约束。

---

## 一、快速开始（Windows）

```bash
npm install          # 依赖已由 package-lock.json 锁定
npm run dev          # 浏览器预览 Web 层（功能完整可用）
npm run build        # 产物输出到 dist/
```

### Android 容器

```bash
npm run build
npx cap sync android        # 拷贝 dist 并同步插件
npx cap open android        # 用 Android Studio 打开，模拟器/真机运行
```

前置：已安装 Android Studio 与 Android SDK（Capacitor 8 要求 Android Studio Ladybug+ / SDK 35）。


## 二、目录结构

```
src/
  types/models.ts        数据模型（Project / Artwork / FocusSession / UserSettings / ActiveSessionSnapshot）
  db/
    database.ts          驱动抽象：原生 @capacitor-community/sqlite；Web 预览用 sql.js（SQLite WASM）
    schema.ts            DDL + PRAGMA user_version 显式迁移脚本
    repositories/        projects / artworks / sessions 仓库层（全部 SQL 集中于此）
    events.ts            数据变更事件（页面自动重取）
  services/
    settings.ts          轻量偏好 → @capacitor/preferences
    activeSession.ts     进行中会话快照 → Preferences（后台/杀进程恢复的真值来源）
    notifications.ts     倒计时结束通知（@capacitor/local-notifications，Web 降级 no-op）
    feedback.ts          触感 + WebAudio 合成完成音（均可在设置关闭）
    color.ts             主题色提取（色相聚类）与低饱和动态色板派生
    artworkStorage.ts    画作文件复制进应用私有目录、缩略图、URI 解析
    datePicker.ts        iOS 系统日期选择器（@pantrist/capacitor-date-picker），Web 回退 input
    statsService.ts      统计聚合（跨日记录按重叠比例拆分）
    dataBackup.ts        导出/导入/清空（JSON，不含画作二进制）
    seed.ts              默认项目 + 内置预设画作（public/presets/*.svg）
  timer/
    engine.ts            计时纯函数：有效时长 = 固化累计 + (now - 段起点)，UTC 时间戳为唯一真值
    focusController.ts   会话生命周期单例：开始/暂停/恢复/结束/放弃、快照持久化、通知调度、appStateChange
    useFocusTimer.ts     显示层 hook（4Hz 刷新显示，不参与计时）
  components/
    ArtworkReveal.tsx    双层同图叠放 + clip-path 遮罩 + 边界线（核心视觉组件）
    ui.tsx / charts.tsx / TabBar.tsx
  pages/                 首页 / 项目详情 / 专注设置 / 专注页 / 统计 / 展览 / 我的 / 画作管理
```
