# 来源与实现范围

本组交互图参考 [Archify 3.x](https://github.com/tt-a1i/archify) 的节点探索、上游/下游、有向路径追踪、演示与完整图导出思路。参考说明为 [Viewer Runtime](https://github.com/tt-a1i/archify/blob/main/archify/references/viewer-runtime.md)。

HTML 页面、交互脚本、图遍历算法和项目专用 SVG 渲染器在本项目中独立实现，没有使用旧的 2.0 HTML 模板，也不依赖 Archify CLI。其格式是 `xiaohua-diagram-v1`，不是官方 Archify JSON 接口；检查记录也不代表官方 3.x 的 finalize 结果。

为保留开源来源信息，附上 [Archify MIT 许可](ARCHIFY-LICENSE.txt)。图中的模块与关系依据小画项目说明整理；路径高亮只表示已定义的图关系，不代表实时运行状态或机器人运动优化。

实现包括：模块搜索、节点/连线详情、上下游遍历、有向最短路径、分支场景与有限分步播放、演示布局、缩放拖动、主题切换、完整图 SVG/PNG 导出。通信时序图仅按预设消息顺序演示，不从参与者聚合连线推断流程。未实现官方的全部功能，例如源码证据弹窗、雷达、分享卡片和 WebM 导出。
