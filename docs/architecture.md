# 系统架构与数据流

[返回总览](../README.md) · [下一章：图像处理](image-pipeline.md)

系统采用“浏览器准备图片 → 本地工作台处理和规划 → ABB 执行”的组织方式。浏览器前端和 Tkinter 工作台由同一个 Python 应用组织，本地 HTTP 服务运行在该应用中。云端只承担被用户选择的图像编辑/结构整理，不参与实时机器人运动控制。

![系统架构](images/architecture.svg)

## 模块边界

| 模块 | 主要职责 | 实际入口 |
| --- | --- | --- |
| 浏览器前端 | 导入、拍照、图片编辑、抠图、语音指引、确认图片、请求拍照位 | `frontend/index.html`、`frontend/app.js`、`frontend/style.css` |
| 本地 HTTP 服务 | 图片资产管理、相机帧、异步操作、状态与图片交接 | `picture_frontend.py` |
| 绘图工作台 | 接收已确认图片、裁剪、skill 开关、二值化、路径编辑与机器人任务 | `FaceDrawingApp.py` |
| 云端图像适配器 | 提交图像编辑任务、轮询、下载、结构缓存 | `AiRepaint.py` |
| 本地图像算法 | 本地抠图、二值化、局部覆盖 | 本地抠图模块、`robot_path/drawing_pipeline.py`、`robot_path/binary_editor.py` |
| 路径算法 | 中心线、黑块区域、B-spline、填充排序、项目保存 | `robot_path/` |
| ABB 客户端 | 指令编码、缓冲容量判断、发送和完成确认 | `robot_path/abb_legacy_client.py` |
| ABB 控制器 | TCP 接收与入队、运动执行、完成标记 | 配套 RAPID 网络任务与运动任务 |

浏览器通过 `127.0.0.1` 的本地服务访问功能，默认端口为 8765，端口被占用时服务可选择空闲端口。Host/Origin 和会话令牌检查限制本地接口访问。API密钥由 Python 读取，前端不持有该密钥；用户确认的云端操作仍会把当前图片发送至API。

## 图片与状态交接

前端将原图、编辑结果和抠图结果作为不同图片资产保存。用户明确确认某个结果后，该图片进入交接队列，由工作台接收。相机的预览帧会缩放显示，拍摄结果保留完整图像，显示尺寸与处理尺寸分开。

图片准备与 AI 请求放在后台工作任务中，Tk 主线程通过队列更新状态。图片版本、任务代号和取消状态用于避免旧任务的结果覆盖后来选中的图片。更换图片、裁剪或修改二值图后，旧路径计划会失效，需要重新生成，避免发送与当前图像不一致的轨迹。

## 前端接口概览

| 接口组 | 作用 |
| --- | --- |
| `/api/state`、`/api/image/<id>` | 获取处理状态与已生成的图片 |
| `/api/upload`、`/api/restore` | 导入图片、恢复原图 |
| `/api/action` | 启动改图或抠图等异步操作 |
| `/api/camera/start`、`/api/camera/frame`、`/api/camera/shoot`、`/api/camera/stop` | 相机打开、预览、拍摄和关闭 |
| `/api/confirm`、`/api/handoff/<id>` | 确认图片与检查交接结果 |
| `/api/robot/photo-position` | 请求机器人前往控制器中已有的拍照位 |

拍照位按钮和相机功能位于前端。运动请求经过本地工作台转发至 ABB，实际位置由 RAPID 示教点定义。接口收到发送确认，不代表机器人已经物理到位；拍照前仍需确认机器人停稳。

## 数据在哪里

| 数据 | 工程内位置 | 用途 |
| --- | --- | --- |
| 前端图片资产 | `camera/frontend_sessions/` | 图片准备及结果交接 |
| skill 结构缓存 | `camera/structure_cache/` | 相同输入和规则的结果复用 |
| skill 规则 | `skills/portrait-structure/rules.txt` | 生成结构时追加的规则 |
| 固定语音 | `frontend/voice/` | 本地播放招呼与步骤提示 |
| 绘图项目 | 用户保存的 `.drawproj` | 二值图、初稿、编辑路径、填充关系等 |
| 云端配置 | `.painting-api.json` | 本机私有密钥和 API 配置，不进入公开仓库 |

`.drawproj` 用于恢复绘图编辑状态，不等同于整个图片准备会话的备份。公开文档不附带照片、密钥、控制器完整备份或模型权重。
