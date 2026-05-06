# App Metadata

| 字段 | 值 |
|---|---|
| app_name | smart-home-app |
| display_name | Smart Home |
| domain | Smart Home / Home Automation |
| description | A smart home app for viewing room conditions, controlling devices, and managing home inventory and grocery lists. |
| web_url | smart-home.local |

# 锚点 App 信息

| 名称 | URL | 仿制范围 |
|---|---|---|
| Google Home | https://home.google.com/ | 参考智能家居首页、设备卡片、房间状态展示与设备控制入口；不仿制摄像头、语音助手、家庭成员权限等复杂能力。 |
| AnyList | https://www.anylist.com/ | 参考购物清单列表、数量/单位/优先级展示与维护方式；不仿制菜谱管理、多人协作、商店比价等复杂能力。 |

## Feature List（初始版）

### 房间状态域

- **查看房间环境概览**：用户在 Smart Home 页面查看当前房间的环境指标概览，包括 temperature、humidity，以及可选的 noise、light、air quality 等信息，且每个指标显示明确名称与单位。

### 恒温器控制域

- **管理恒温器设置**：用户查看 Thermostat 当前 mode 和目标温度，并可将 mode 切换为 comfort、eco 或 off，或调整目标温度（例如 68F），提交后页面展示更新后的设置值。

### 咖啡机计划任务域

- **管理咖啡机预约启动时间**：用户查看 Coffee Machine 当前预约启动时间，将 start_time 调整为更晚的时间（至少支持延后 20 分钟），并在提交后看到更新后的 start_time。

### 库存与购物清单域

- **管理 Fridge 与 Pantry 库存**：用户进入库存管理页面，分别查看 Fridge 和 Pantry 两个分区中的库存项，并对库存项进行新增、编辑、删除；每条库存项显示 item_name、quantity、unit，以及可选的 expiry_date、category、location 等字段。
- **查看与维护 Grocery List**：用户查看待购清单中的商品条目，并查看每条待购项的 item_name、target_quantity、unit，以及可选的 priority、status 等字段。