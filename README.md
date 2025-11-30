# 🎄 Grand Luxury Interactive 3D Christmas Tree

> 一个基于 **React**, **Three.js (R3F)** 和 **AI 手势识别** 的高保真 3D 圣诞树 Web 应用。

这个项目不仅仅是一棵树，它是一个承载记忆的交互式画廊。成百上千个粒子、璀璨的彩灯和悬浮的拍立得照片共同组成了一棵奢华的圣诞树。用户可以通过手势控制树的形态（聚合/散开）和视角旋转，体验电影级的视觉盛宴。

![Project Preview](public/preview.png)
*(注：建议在此处上传一张你的项目运行截图)*

## ✨ 核心特性

* **极致视觉体验**：由 45,000+ 个发光粒子组成的树身，配合动态光晕 (Bloom) 和辉光效果，营造梦幻氛围。
* **记忆画廊**：照片以“拍立得”风格悬浮在树上，每一张都是一个独立的发光体，支持双面渲染。
* **AI 手势控制**：无需鼠标，通过摄像头捕捉手势即可控制树的形态（聚合/散开）和视角旋转。
* **丰富细节**：包含动态闪烁的彩灯、飘落的金银雪花、以及随机分布的圣诞礼物和糖果装饰。
* **高度可定制**：**支持用户轻松替换为自己的照片，并自由调整照片数量。**

## 🛠️ 技术栈

* **框架**: React 18, Vite
* **3D 引擎**: React Three Fiber (Three.js)
* **工具库**: @react-three/drei, Maath
* **后期处理**: @react-three/postprocessing
* **AI 视觉**: MediaPipe Tasks Vision (Google)

## 🚀 快速开始

### 1. 环境准备
确保你的电脑已安装 [Node.js](https://nodejs.org/) (建议 v18 或更高版本)。

### 2. 安装依赖
在项目根目录下打开终端，运行：```bash npm install
### 3. 启动项目
npm run dev
### 🖼️ 自定义照片
#### 方式 1：页面内上传（推荐）
* 运行项目后，左上角有“上传照片”按钮，支持一次选择多张图片。
* 上传后会立刻替换树上的拍立得，并按上传数量自动生成 120 ~ 400 张实例，保证树依然饱满。
* 点击“使用示例”可随时恢复内置照片。
* 建议：使用正方形或 4:3 比例，单张 500kb 以内体验更流畅。

#### 方式 2：替换内置照片文件（备用）
* 仍可将图片放在 `public/photos/` 下：
  * 顶端大图/封面图：`top.jpg`
  * 树身照片：`1.jpg`, `2.jpg`, `3.jpg` ...
* 如果你增加了默认照片数量，可在 `src/App.tsx` 中调整 `TOTAL_NUMBERED_PHOTOS`，让应用预加载更多文件。
### 🖐️ 手势控制说明
* **本项目内置了 AI 手势识别系统，请站在摄像头前进行操作（屏幕右下角有 DEBUG 按钮可查看摄像头画面）**：
🖐 张开手掌 (Open Palm)	Disperse (散开)	圣诞树炸裂成漫天飞舞的粒子和照片
✊ 握紧拳头 (Closed Fist)	Assemble (聚合)	所有元素瞬间聚合成一棵完美的圣诞树
👋 手掌左右移动	旋转视角	手向左移，树向左转；手向右移，树向右转
👋 手掌上下移动	俯仰视角	手向上移，视角抬高；手向下移，视角降低
### ⚙️ 进阶配置
* **如果你熟悉代码，可以在 src/App.tsx 中的 CONFIG 对象里调整更多视觉参数**：
  const CONFIG = {
  colors: { ... }, // 修改树、灯光、边框的颜色
  counts: {
    foliage: 15000,   // 修改树叶粒子数量 (配置低可能会卡)
    ornaments: 300,   // 修改悬挂的照片/拍立得数量
    lights: 400       // 修改彩灯数量
  },
  tree: { height: 22, radius: 9 }, // 修改树的大小
  // ...
};
### 📄 License
MIT License. Feel free to use and modify for your own holiday celebrations!
### Merry Christmas! 🎄✨
