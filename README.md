# GlucoFit 控糖与代谢改善系统 · 代谢自动驾驶（Metabolic Autopilot v3.0）

面向**胰岛素抵抗（IR）与超重人群**的代谢管理 Web 应用。不依赖血糖仪、不测腰围，以**智能体脂秤（BIA 人体成分）**与**控糖饮食行为打卡**为数据基础，通过追踪脂肪量下降与蛋白质量维持，实现代谢灵活性重塑与健康减重。

v1.0 / v2.x 是「记录过去」的账本；**v3.0 进化为「预测未来、实时干预」的智能副驾**——基于生理学药代动力学的代谢数字孪生，在首页实时推演全天虚拟血糖/胰岛素潮汐曲线，并把 AI 干预节点前移到「动筷子前的 10 秒钟」。

**v2.2 起为多租户账号架构**：注册登录后数据托管于服务端 Cloudflare D1（多租户隔离），本地浏览器仅作缓存；未登录也能体验本地模式。

## 核心理念

- **去卡路里化，重注质与序**：进食顺序 `蔬菜 → 蛋白/脂肪 → 慢碳`，规避精制糖与高 GI 碳水
- **体成分精细追踪**：聚焦脂肪量下降与蛋白质/骨盐量维持，防止减重期掉肌肉
- **代谢体征自检闭环**：以餐后嗜睡（Food Coma）与抗饿时长作为胰岛素波动的主观生物标志物
- **餐后肌肉泵（GLUT4）**：餐后 30 分钟内 10-15 分钟轻运动，降低对胰岛素分泌总量的依赖
- **从记录到推演**：以简化药代动力学模型将行为数据实时转译为可感知的血糖/胰岛素浪潮，让干预发生在「事前」与「进行中」，而非事后打分

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
- **语音快记**：浏览器 Web Speech API 一句话口述餐食，LLM 自动解析为结构化打卡字段并预填表单
- **AI 控糖三餐推荐**：基于今日剩余热量/碳水预算 + 忌口与现有食材，生成三餐方案（食材克数、烹饪搭配、进食顺序），支持一键采纳记入打卡
- **AI 周度代谢诊断**：聚合近 7 天体成分变化、肌肉/脂肪比、稳糖均分与嗜睡频次，输出掉肌风险、胰岛素敏感度分析、平台期判定与行动建议
- **热量与碳水双轨预算**：基于去脂体重（FFM）的 Katch-McArdle TDEE 动态计算，热量赤字控制在 300-500 kcal，净碳水警戒线与精制碳水暴露预警

### 档案与运动（v2.1）
- **代谢初始档案（Onboarding）**：首访引导录入性别 / 出生年份 / 身高 / 初始体重与体成分 / 目标，三档目标智能推荐（保守 / 中性 / 激进），自动推导基线 BMI、BMR（Katch-McArdle，缺失体成分时回退 Mifflin-St Jeor）与初始 TDEE
- **减重里程碑条**：仪表盘顶部常驻展示初始体重 → 当前 → 目标的全周期进度
- **运动消耗与肌肉负荷打卡**：餐后肌肉泵 / 抗阻力量 / 中高强度有氧分类，METs 指数结合当前体重自动估算消耗，肌肉刺激体感标签，餐后标记
- **今日热量收支环**：净热量 = 摄入 − (静态 TDEE + 运动消耗)，赤字达成环形进度，运动过量时提示反跳性食欲风险

### 账号与云端托管（v2.2，多租户 SaaS）
- **邮箱注册 / 登录**：PBKDF2-SHA256 密码哈希 + HS256 JWT 会话（HttpOnly Cookie，30 天有效），登录/注册接口内置限流防爆破
- **数据云端托管**：体成分 / 饮食 / 运动 / 代谢档案 / AI 模型配置登录后持久化至 Cloudflare D1，所有业务表强制关联 `user_id` 实现多租户隔离
- **多端漫游**：换设备登录同一账号即自动拉取云端数据按 id 去重合并，换窗不丢数据
- **本地降级**：未登录时全部功能照常可用，数据仅存浏览器 localStorage

### 代谢自动驾驶（v3.0，预测性代谢数字孪生）
- **虚拟动态血糖/胰岛素潮汐引擎**：仪表盘顶部常驻深色观测面板，依据当日打卡（进食时间、进食顺序、碳水拳数、精制碳水、餐后运动）以高斯脉冲模型推演全天 24h「血糖蓝潮 + 胰岛素紫潮」双波浪曲线，未来时段以预测虚线渲染
- **反应性低血糖提前预警**：大幅冲高后自动推演约 2 小时后的深谷，提前告知「15:00 你可能迎来强烈嗜睡或甜食渴望」
- **餐后急救削峰**：血糖冲高进行中出现脉冲按钮【开启 15 分钟提踵/快走 · 削峰 35%】，一键打卡后该餐标记肌肉泵激活，曲线实时压平（约 32%）
- **吃前扫一扫 · 菜单排雷**：饮食弹窗新增「吃前规划」模式，上传外卖截图/菜单照片或输入菜名，AI 三区排雷（🟢稳糖安全区 / 🟡隐藏刺客 / 🔴胰岛素炸弹）并生成 10 秒进食战术剧本与主食拳头量化建议
- **体脂秤水合解耦诊断**：对比最近两次称重的体重/体水分/脂肪量，自动判别涨跌来自储水、肌糖原充盈、脱水还是真实脂肪变化，趋势图上方渲染定性解读胶囊，消除体重焦虑
- **嘴馋急救 SOS**：悬浮胶囊新增闪电按钮，3 分钟多巴胺阻断交互——生理饥饿鉴别（水煮鸡胸测试）→ 替代处方（气泡水 + 巴旦木 / 60 秒呼吸动画）→ 10 分钟冲动延迟倒计时，结束后允许无罪恶感进食一小份并一键放宽明日断食窗口
- **工作日/周末双模引擎**：设置中开启后，工作日自动执行严格断食协议（16:8 / 18:6），周末/社交日切换为防御与平衡模式（14:10 / 12:12 / 弹性），断食计时器随星期几自动调整阈值
- **Argon 视觉体系（v5）**：浅色冷灰 `#F8FAFC` / 深色深空 `#0B0F17` 双主题（深色为 class 切换），白卡 + `rounded-2xl` + 漫反射双层阴影 + 玻璃拟态导航，Bento Grid 仪表盘布局，主品牌 blue→indigo 渐变，语义色达标 emerald / 预警 amber / 超标 rose / 提示 sky / AI 身份 violet

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 14（App Router）+ TypeScript |
| 样式 | Tailwind CSS（v5 Argon 设计系统）+ shadcn/ui 风格组件 + Lucide 图标 |
| 状态与缓存 | Zustand + localStorage 持久化（本地模式开箱即用） |
| 认证与存储 | PBKDF2-SHA256 + JWT（HttpOnly Cookie）；业务数据 Cloudflare D1（REST API 直连，多租户隔离） |
| 图表 | Recharts |
| AI | 任意 OpenAI 兼容接口（Chat Completions 协议），多模态视觉模型，服务端代理转发 |

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

**本地模式**：不配置任何环境变量即可运行，注册/登录不可用，数据仅存浏览器本地。

## 部署（云端托管模式）

### 1. 准备 Cloudflare D1 数据库

创建 D1 数据库并初始化表结构（任选其一）：

- `npx wrangler d1 execute <数据库名> --remote --file=./schema.sql`
- Cloudflare Dashboard → D1 → Console 粘贴执行 `schema.sql`
- 应用后端首次请求时会**自动幂等初始化表结构**，本步骤可跳过

### 2. 注入服务端环境变量

| 变量 | 说明 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 数据库 ID |
| `CLOUDFLARE_API_TOKEN` | API Token（需 D1 编辑权限） |
| `JWT_SECRET` | 会话签名密钥（HS256，自行生成强随机串） |

### 3. 使用

用户侧无需任何配置：注册账号登录后数据自动云端托管，多端登录同一账号即可互相同步。

## AI 模型配置（BYOK）

登录后点击右上角齿轮打开「AI 模型设置」：

1. 通过服务商预设快速填充，或手动填写任意 OpenAI 兼容接口：
   - **Base URL**：如 `https://api.openai.com/v1`、`https://api.deepseek.com/v1`、`https://dashscope.aliyuncs.com/compatible-mode/v1` 等
   - **文本模型**：用于食谱生成、代谢诊断与吃前排雷剧本（如 `deepseek-chat`、`qwen-plus`）
   - **视觉模型**：用于截图 OCR、餐食识别与菜单排雷（如 `gpt-4o-mini`、`qwen-vl-max`）
2. 填入 API Key，点击「测试连接」验证
3. 保存后即可使用全部 AI 功能，配置登录后云端跟随

### 隐私说明

- **账号**：密码仅以 PBKDF2-SHA256（12 万次迭代）哈希存储，明文不可逆；会话为 HS256 JWT 写入 HttpOnly Cookie
- **多租户隔离**：所有业务表强制关联服务端下发的 `user_id`，用户间数据完全隔离
- **AI Key**：API Key 由用户自备，云端存储经加密，读取仅限本人会话；所有 AI 请求经应用本地 `/api/ai` 代理转发至用户配置的接口，服务端不存储对话内容
- **图片附件**：餐食照片与体脂秤截图仅存浏览器本地，不同步云端

## 项目结构

```
glucofit-web/
├── app/
│   ├── page.tsx                        # 仪表盘主页（Bento Grid）
│   ├── layout.tsx                      # 全局布局（主题防 FOUC）
│   ├── api/ai/route.ts                 # AI 请求代理（自动探测系统代理）
│   ├── api/ai/diagnose/route.ts        # AI 周度代谢诊断
│   ├── api/ai/voice-parse/route.ts     # 语音快记结构化解析
│   ├── api/ai-settings/route.ts        # AI 模型配置云端存取（Key 加密）
│   ├── api/auth/{register,login,logout,me}/ # 注册 / 登录 / 登出 / 会话
│   ├── api/profile/route.ts            # 代谢初始档案
│   └── api/records/{body,exercise,meal}/ # 体成分 / 运动 / 饮食记录
├── components/
│   ├── VirtualMetabolicWave.tsx        # v3.0 代谢数字孪生：血糖/胰岛素潮汐引擎
│   ├── MilestoneBar.tsx                # 减重里程碑条
│   ├── BodyMetricsCard.tsx             # 体脂秤核心指标与代谢提示
│   ├── CompositionCharts.tsx           # 体成分多维趋势图表（含水合解耦诊断胶囊）
│   ├── FastingTracker.tsx              # 间歇断食进度环（v3.0 工作日/周末双模自动切换）
│   ├── EnergyBalanceCard.tsx           # 今日热量收支环 + 当日运动记录
│   ├── MealLogCard.tsx                 # 单餐稳糖打卡卡片
│   ├── MealPlanner.tsx                 # 热量碳水双轨预算 + AI 三餐推荐
│   ├── AIDiagnosisCard.tsx             # AI 周度代谢诊断
│   ├── FloatingActionCapsule.tsx       # 右下角悬浮胶囊（记饮食/运动/录体脂/SOS）
│   ├── ThemeToggle.tsx                 # 浅色/深色主题切换
│   ├── MealLogDialog.tsx               # 饮食打卡（吃前排雷 + 拍照识别 + 语音快记）
│   ├── MealVoiceInput.tsx              # 语音快记（Web Speech API + LLM 解析）
│   ├── PreMealRadar.tsx                # 吃前扫一扫：菜单排雷与进食战术剧本
│   ├── BodyCompositionDialog.tsx       # 体脂秤数据录入（含截图 OCR）
│   ├── BodyImageUploader.tsx           # 体脂秤截图 AI 识别
│   ├── ExerciseLogDialog.tsx           # 运动录入（MET 估算 + 体感标签）
│   ├── CravingSosDialog.tsx            # v3.0 嘴馋急救 SOS（多巴胺阻断交互）
│   ├── OnboardingModal.tsx             # 代谢初始档案建档引导
│   ├── AuthModal.tsx                   # 注册 / 登录（含云端数据合并）
│   ├── SettingsDialog.tsx              # 设置中心（AI 模型 / 代谢档案 / 周期双模）
│   └── ui/                             # 基础组件（button/card/dialog/badge 等）
├── lib/
│   ├── auth.ts                         # PBKDF2 密码哈希 + JWT 会话（服务端）
│   ├── auth-store.ts                   # 客户端认证状态（Zustand）
│   ├── db.ts                           # 集中式 D1 数据访问（多租户，服务端）
│   ├── cloud.ts                        # 登录后云端数据拉取合并（syncAll）
│   ├── rate-limit.ts                   # 认证接口限流
│   ├── profile.ts                      # 用户档案、BMR/TDEE 基线、里程碑与 MET 估算
│   ├── target-calculator.ts            # 三档目标推荐（保守/中性/激进）
│   ├── scoring.ts                      # 稳糖评分与体成分预警算法
│   ├── nutrition.ts                    # Katch-McArdle TDEE 与营养汇总
│   ├── metabolic-sim.ts                # v3.0 代谢数字孪生引擎（潮汐推演 + 双模协议）
│   ├── bodyCompAnalyzer.ts             # v3.0 水合解耦降噪算法
│   ├── ai-client.ts                    # OpenAI 兼容客户端与结构化 Prompt
│   ├── storage.ts                      # Zustand 持久化存储（本地缓存）
│   ├── upstream-fetch.ts               # 服务端上游请求（系统代理探测）
│   ├── utils.ts                        # 通用工具（日期、className、剪裁等）
│   └── image.ts                        # 图片压缩（适配视觉模型与本地存储）
├── schema.sql                          # Cloudflare D1 建表脚本（多租户）
└── types/
    ├── index.ts                        # 数据契约（档案/体成分/饮食/运动/账号等）
    └── v3.ts                           # v3.0 契约（潮汐节点/水合解耦/周期双模/排雷结果）
```

## License

MIT
