# SillyTavern - Custom Models

Add custom model names to OpenAI, Claude, and Google/Gemini connections in SillyTavern.

## 功能特性

### 基础功能
- 为 OpenAI、Claude 和 Google/Gemini 连接添加自定义模型名称
- 手动添加、删除和管理自定义模型
- 持久化存储自定义模型列表

### 新增 API 轮询功能
- **自动发现 Gemini 模型**: 自动从 Google API 获取最新的 Gemini 模型列表
- **智能模型缓存**: 缓存已发现的模型，避免重复 API 调用
- **一键刷新**: 提供刷新按钮手动更新模型列表
- **API 调用计数**: 跟踪 Gemini API 的使用次数

### 使用方法
1. 在 SillyTavern 中配置 Google API 密钥
2. 扩展会自动获取可用的 Gemini 模型
3. 新发现的模型会自动添加到 "Custom Models" 分组中
4. 点击 Google 模型选择器旁边的刷新按钮可手动更新模型列表

### 注意事项
- 需要在 `config.yaml` 中设置 `allowKeysExposure: true` 才能访问 API 密钥
- API 轮询功能仅适用于 Google/Gemini 提供商
- API 调用计数会保存在本地存储中

| | |
|-|-|
|![](README/stcm-01.png)|![](README/stcm-02.png)|
