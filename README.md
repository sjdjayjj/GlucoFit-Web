# GlucoFit 控糖与代谢改善系统

面向**胰岛素抵抗（IR）与超重人群**的代谢管理 Web 应用。不依赖血糖仪、不测腰围，以**智能体脂秤（BIA 人体成分）**与**控糖饮食行为打卡**为数据基础，通过追踪脂肪量下降与蛋白质量维持，实现代谢灵活性重塑与健康减重。

支持**本地单机**与**云端多端同步**（BYOK Cloudflare D1）两种模式，未配置云同步时全部数据仅存本地浏览器。

## 核心理念

- **去卡路里化，重注质与序**：进食顺序 `蔬菜 → 蛋白/脂肪 → 慢碳`，规避精制糖与高 GI 碳水
- **体成分精细追踪**：聚焦脂肪量下降与蛋白质/骨盐量维持，防止减重期掉肌肉
- **代谢体征自检闭环**：以餐后嗜睡（Food Coma）与抗饿时长作为胰岛素波动的主观生物标志物
- **餐后肌肉泵（GLUT4）**：餐后 30 分钟内 10-15 分钟轻运动，降低对胰岛素分泌总量的依赖

## 功能一览

### 仪表盘（v1.0）
- **体脂秤最新状态**：体重 / BMI / 体脂率 / 脂肪量核心指标 + 体水分 / 蛋白质 / 骨盐 / 身体得分，自动对比上次称重增减
- **体成分趋势图表**：7/30 天切换；体重与体脂率双轴图；脂肪量 vs 蛋白质量对比图（直观判断减重是否掉肌）
- **稳糖评分体系**：单餐满分 100 = 进食顺序 30 + 控碳 30 + 餐后轻运动 20 + 无嗜睡 20
- **体成分智能预警**：优质减脂 / 脱水代谢受损风险 / 胰岛素敏感性向好（近 3 天无嗜睡且均分 ≥ 80）
- **间歇断食追踪**：16:8 / 14:10 / 12:12 进度环，区分「进食窗口」与「低胰岛素消脂维护期」并倒计时

### AI 赋能（v2.0，BYOK 自带 API Key）
- **体脂秤截图 OCR**：上传体脂秤 App 截图，视觉模型自动提取 8 项指标并预填表单，核对后一键存入
- **餐食拍照识别**：AI 估算菜品清单、热量与碳水/蛋白/脂肪/纤维克数（可手动修正），自动判定精制碳水并给出进食顺序建议
- **AI 控糖三餐推荐**：基于今日剩余热量/碳水预算 + 忌口与现有食材，生成三餐方案（食材克数、烹饪搭配、进食顺序），支持一键采纳记入打卡
- **AI 周度代谢诊断**：聚合近 7 天体成分变化、肌肉/脂肪比、稳糖均分与嗜睡频次，输出掉肌风险、胰岛素敏感度分析、平台期判定与行动建议
- **热量与碳水双轨预算**：基于去脂体重（FFM）的 Katch-McArdle TDEE 动态计算，热量赤字控制在 300-500 kcal，净碳水警戒线与精制碳水暴露预警

### 档案、运动与云同步（v2.1）
- **代谢初始档案（Onboarding）**：首访引导录入性别 / 出生年份 / 身高 / 初始体重与体成分 / 目标，自动推导基线 BMI、BMR（Katch-McArdle，缺失体成分时回退 Mifflin-St Jeor）与初始 TDEE
- **减重里程碑条**：仪表盘顶部常驻展示初始体重 → 当前 → 目标的全周期进度
- **运动消耗与肌肉负荷打卡**：餐后肌肉泵 / 抗阻力量 / 中高强度有氧分类，METs 指数结合当前体重自动估算消耗，肌肉刺激体感标签，餐后标记
- **今日热量收支环**：净热量 = 摄入 − (静态 TDEE + 运动消耗)，赤字达成环形进度，运动过量时提示反跳性食欲风险
- **云端多端同步（BYOK）**：填入自己的 Cloudflare D1 凭证与自定义同步码，双向拉取合并上传（id 去重、时间新者胜）；未配置时自动降级为本地 localStorage 存储

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 14（App Router）+ TypeScript |
| 样式 | Tailwind CSS + shadcn/ui 风格组件 + Lucide 图标 |
| 状态与存储 | Zustand + localStorage 持久化（开箱即用，零后端配置） |
| 图表 | Recharts |
| AI | 任意 OpenAI 兼容接口（Chat Completions 协议），多模态视觉模型 |
| 云同步（可选） | Cloudflare D1（REST API 直连，无需自建服务端） |

## 快速开始

```bash
# 要求 Node.js >= 18.17
npm install

# 开发模式
npm run dev

# 生产构建与运行
npm run build
npm run start
```

访问 http://localhost:3000 即可使用。首次打开会引导建立**代谢初始档案**（可跳过），并预置 7 天示例数据，可直接体验各功能。

## 云端多端同步（可选，BYOK Cloudflare D1）

应用默认本地运行；如需跨设备漫游数据：

1. 创建 Cloudflare D1 数据库并初始化表结构（三选一）：
   - `npx wrangler d1 execute <数据库名> --remote --file=./schema.sql`
   - Cloudflare Dashboard → D1 → Console 粘贴执行 `schema.sql`
   - 应用内「设置 → 云端同步 → 初始化表结构」（幂等，可重复执行）
2. 打开「设置 → 云端同步」，填入 **同步码**（自定义多端一致的唯一标识）、**Account ID**、**D1 Database ID** 与 **API Token**（需 D1 编辑权限），点击「测试连接」验证
3. 点击「立即同步」或顶栏云同步按钮：自动拉取云端数据按 id 去重合并后全量上行，多端填同一同步码即可互相同步

## AI 模型配置（BYOK）

点击右上角齿轮打开「AI 模型设置」：

1. 通过服务商预设快速填充，或手动填写任意 OpenAI 兼容接口：
   - **Base URL**：如 `https://api.openai.com/v1`、`https://api.deepseek.com/v1`、`https://dashscope.aliyuncs.com/compatible-mode/v1` 等
   - **文本模型**：用于食谱生成与代谢诊断（如 `deepseek-chat`、`qwen-plus`）
   - **视觉模型**：用于截图 OCR 与餐食识别（如 `gpt-4o-mini`、`qwen-vl-max`）
2. 填入 API Key，点击「测试连接」验证
3. 保存后即可使用全部 AI 功能

### 隐私说明

- API Key 与云同步凭证均经混淆加密后**仅保存在本浏览器** localStorage，不上传、不留存
- 所有 AI 请求经应用本地 `/api/ai` 代理、云同步请求经 `/api/sync` 代理转发至用户配置的接口，服务端不存储任何凭证与数据
- 全部健康数据（体成分、饮食、运动、目标）保存在浏览器本地；启用云同步后仅结构化数据写入你自己的 D1 数据库，图片附件暂不同步（仍仅存本地）

## 项目结构

```
glucofit-web/
├── app/
│   ├── page.tsx                  # 仪表盘主页
│   ├── layout.tsx                # 全局布局
│   ├── api/ai/route.ts           # AI 请求代理（自动探测系统代理）
│   └── api/sync/route.ts         # 云同步代理（Cloudflare D1 REST API）
├── components/
│   ├── OnboardingModal.tsx       # 代谢初始档案建档引导
│   ├── MilestoneBar.tsx          # 减重里程碑条
│   ├── BodyMetricsCard.tsx       # 体脂秤核心指标与代谢提示
│   ├── BodyCompositionDialog.tsx # 体脂秤数据录入（含截图 OCR）
│   ├── BodyImageUploader.tsx     # 体脂秤截图 AI 识别
│   ├── MealLogCard.tsx           # 单餐稳糖打卡卡片
│   ├── MealLogDialog.tsx         # 饮食打卡（拍照识别 + 行为自检）
│   ├── MealPlanner.tsx           # 热量碳水双轨预算 + AI 三餐推荐
│   ├── ExerciseLogDialog.tsx     # 运动录入（MET 估算 + 体感标签）
│   ├── EnergyBalanceCard.tsx     # 今日热量收支环 + 当日运动记录
│   ├── AIDiagnosisModal.tsx      # AI 周度代谢诊断
│   ├── FastingTracker.tsx        # 间歇断食进度环
│   ├── CompositionCharts.tsx     # 体成分多维趋势图表
│   ├── SettingsDialog.tsx        # 设置中心（AI 模型 / 代谢档案 / 云同步）
│   └── ui/                       # 基础组件（button/card/dialog 等）
├── lib/
│   ├── profile.ts                # 用户档案、BMR/TDEE 基线、里程碑与 MET 估算
│   ├── scoring.ts                # 稳糖评分与体成分预警算法
│   ├── nutrition.ts              # Katch-McArdle TDEE 与营养汇总
│   ├── ai-client.ts              # OpenAI 兼容客户端与结构化 Prompt
│   ├── cloud.ts                  # 云同步编排（拉取合并 → 推送）
│   ├── upstream-fetch.ts         # 服务端上游请求（系统代理探测）
│   ├── storage.ts                # Zustand 持久化存储（含凭证混淆加密）
│   └── image.ts                  # 图片压缩（适配视觉模型与本地存储）
├── schema.sql                    # Cloudflare D1 建表脚本
└── types/
    └── index.ts                  # 数据契约（档案/体成分/饮食/运动/同步配置等）
```

## License

MIT
