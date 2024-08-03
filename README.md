# show-me-tabs

## TODO

- [ ] 自动排序
- [ ] 自动删除重复的 tabs

## Flow

- 新增标签页 | 将其他窗口标签页移动到当前窗口

  - 如果非分组标签页数量超过阈值

    - 如果不存在分组 More，则新建 More 分组并将多余标签页移到分组中

    - 如果存在分组 More，则将多余标签页移到分组中

      - 如果用户已经创建分组怎么办？

      - 如果用户有多个分组怎么办？

    - 如何定义非分组标签页

      - groupId === -1 && !pinned

    - 如何定义多余标签页？

      - 按照标签页的索引，最左侧的视为多余标签页

- 移除标签页 | 将当前窗口标签页移动到其他窗口

  - 如果非分组标签页数量低于阈值

    - 如果不存在分组 More，则不执行操作

    - 如果存在分组 More，则从分组中取出空闲标签页展示

    - 如何定义空闲标签页？

      - 按照标签页在分组中的索引，最右侧的视为空闲标签页
