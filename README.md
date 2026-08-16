# Masterpiece Timer（番茄钟 × 画作上色）

以「专注过程逐步揭示艺术画作」为核心体验的番茄钟 App。
一次专注把一幅画从灰度逐步恢复为彩色：界面中存在一条细微的半透明上色边界线，
随有效专注进度从画作左侧向右侧移动，经过的区域恢复原色。

技术栈：**React 19 + TypeScript（strict）+ Vite + Capacitor 8**

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

### iOS 构建（重要）

Windows 本机**不能**编译 iOS 包。流程：

1. `npx cap add ios`（或在云端构建环境执行；需要先有 dist：`npm run build`）
2. 将仓库推送到 Git，在 Ionic Appflow（或其他可信 macOS CI）配置构建：
   - 构建栈需满足 Capacitor 8 要求：**Xcode 16+**
   - 构建命令：`npm ci && npm run build && npx cap sync ios`
3. 使用开发者本人的 Apple Developer 证书与 Provisioning Profile 签名，
   经 TestFlight 或 Ad Hoc 分发到真实 iPhone。
4. **真机必须验证**：视觉对齐、本地通知、后台/锁屏计时恢复、触感、
   相册导入、系统日期选择器 —— 这些不能以 Windows 模拟器结果代替。

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

## 三、关键实现说明

### 1. 画作上色（ArtworkReveal）

- 同一定位容器内叠放两个同 URI、同 `object-fit: contain`、同尺寸的 `<img>`；
  底层 `filter: grayscale(1)`，上层原色，用 `clip-path: inset(0 calc((1 - var(--reveal)) * 100%) 0 0)` 裁出左侧已完成区域。
- 上色边界线是绝对定位元素，`left: calc(var(--reveal) * 100%)`，坐标基准是
  **画作实际显示矩形**（JS 按可用空间与宽高比计算 contain 矩形），不会划过画框外留白。
- 进度更新只改 CSS 变量 `--reveal`，配合 240ms linear transition 平滑过渡，不生成新位图。
- `revealProgress = clamp(有效专注时长 / 计划专注时长, 0, 1)`（timer/engine.ts）。

### 2. 计时可靠性

- 不依赖定时回调累加。快照字段：`startedAtUtc / accumulatedEffectiveMs /
  segmentStartedAtUtc / accumulatedPausedMs / pauseStartedAtUtc / state`。
- 有效时长 = `accumulatedEffectiveMs + (running ? now - segmentStartedAtUtc : 0)`。
- `appStateChange`：进后台立即固化快照到 Preferences；回前台按 UTC 重算，
  锁屏/挂起/杀进程重开均不丢进度。重启后自动恢复到专注页。
- 倒计时开始/恢复时用本地通知调度结束提醒；暂停/提前结束/放弃时取消。
- rAF/setInterval 仅用于刷新显示（4Hz）。

### 3. 数据层

- SQLite（原生 `@capacitor-community/sqlite`；Web 预览 sql.js，同一套 SQL 与迁移），
  schema 版本由 `PRAGMA user_version` 管理，新增变更追加迁移脚本。
- 写操作走显式事务；常用查询字段已建索引。
- Preferences 只存设置与活动会话快照；画作文件在 Filesystem 私有目录。
- 编辑/删除记录后按全量会话 `recomputeArtworkAccumulation` 重算画作进度，保证统计一致。

### 4. 动态主题色

- 导入时对图片降采样做色相聚类取代表色；颜色过杂或失败回退中性色板。
- 派生色板时刻意降饱和（≤0.38）、按明暗模式控制明度并与基础背景混合，
  文字色固定、明度范围受控，保证可读性。
- 切换画作时通过 CSS transition 平滑过渡背景。

### 5. 补记与编辑

- 记录行左滑露出「补记 / 编辑」并列按钮（平台规范优先的稳定方案，
  未采用两段阈值连续手势以免破坏列表滚动）。
- 补记必须选起始+结束时间，不允许孤立分钟数；原生调用 iOS 系统日期选择器，
  Web 回退 `<input type="date">/<input type="time">`。
- 校验：结束晚于开始；禁止未来记录；时间重叠需勾选确认；跨日记录按重叠比例
  拆分进统计。补记/编辑分别打 `isManual` / `isEdited` 标记。

## 四、插件清单（版本已锁定）

| 插件 | 用途 |
| --- | --- |
| @capacitor/app | appStateChange 前后台恢复 |
| @capacitor/local-notifications | 倒计时结束通知 |
| @capacitor/preferences | 设置 + 会话快照 |
| @capacitor/filesystem | 画作原图/缩略图 |
| @capacitor/camera | 相册选图 |
| @capacitor/haptics | 完成触感 |
| @capacitor/status-bar / splash-screen | 状态栏样式 / 启动屏 |
| @capacitor-community/sqlite | 业务数据库 |
| @pantrist/capacitor-date-picker | iOS 系统日期/时间选择器（Web 有语义等价回退） |

## 五、验收自查（Web 预览即可验证大部分）

- [x] 计时开始画作全灰，随进度从左向右恢复；0%/50%/100% 与横/竖/方画幅对齐
- [x] 正/倒计时均有计划时长；暂停不计入有效时长；正计时超时单独显示
- [x] 后台/刷新/重开后按时间戳恢复计时与画作进度
- [x] 主流程：选项目 → 模式与时长 → 选画 → 专注 → 总结（含备注）
- [x] 项目新建/重命名/排序/归档/删除；记录补记/编辑/删除并触发统计重算
- [x] 统计：今日/指定日期/月/年/自定义；总量、项目分布、趋势
- [x] 完成画作进展览，未完成在「创作中」；同一画作只保留一件藏品、累计时长
- [x] 我的：资料、默认专注、声音/触感/通知、外观、画作管理、归档找回、JSON 备份
- [x] 动态主题色协调且可读；浅色/深色；安全区适配
- [x] 计时引擎与跨日拆分有纯函数测试（`npm test`）
- [ ] iOS 真机：通知/后台计时/触感/相册导入/系统日期选择器（需 macOS 云构建 + 真机）
- [ ] Android 真机：同上原生能力尚未在本机替代验收

## 六、已知限制与后续建议

- Web 预览的 SQLite 经 localStorage 持久化数据库文件（约 5MB 上限，仅开发用）；
  正式数据在原生 SQLite。
- Android 已锁定竖屏；iOS 需在云端工程的 Info.plist 中设置（画作本身已兼容横版）。
- JSON 备份不含画作原图/缩略图；换机后需重新导入图片。后续可加 WebDAV/云同步。
- 统计趋势图在「年」粒度按月聚合，「日」粒度按小时聚合；跨日记录按重叠比例分摊。
- 相册选择在系统回收应用后通过 `appRestoredResult` 恢复；须在 Android 真机验证。
