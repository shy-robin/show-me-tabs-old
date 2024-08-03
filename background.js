let groupId;
let currentWindowId;
const tabInfoMap = new Map();

const notify = (message) => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "./images/hi.png",
    title: "Show me tabs",
    message,
  });
};

const getTabsInfo = async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  tabs.forEach((tab) => {
    const info = tabInfoMap.get(tab.id) ?? {};
    tab.lastAccessed &&
      tabInfoMap.set(tab.id, {
        ...info,
        lastAccessed: tab.lastAccessed,
      });
  });
  const ungroupedTabs = tabs.filter((tab) => tab.groupId === -1 && !tab.pinned);
  if (!ungroupedTabs.length) {
    return null;
  }
  // const pageWidth = tabs[0].width;
  // const tabWidth = 230;
  // const maxTabsCount = Math.floor(pageWidth / tabWidth);
  const maxTabsCount = 3;
  const normalTabsCount = ungroupedTabs.length;

  return {
    tabs,
    ungroupedTabs,
    maxTabsCount,
    normalTabsCount,
  };
};

const handleTabsOverThreshold = async (ungroupedTabs, index) => {
  // FIXME: 如果用户已经创建分组怎么办？ 如果用户有多个分组怎么办？

  // NOTE: 当标签页移动后，lastAccessed 会变为 undefined
  const tabs = ungroupedTabs.slice().map((tab) => ({
    ...tab,
    lastAccessed: tab.lastAccessed || tabInfoMap.get(tab.id)?.lastAccessed || 0,
  }));
  console.log(
    "before",
    tabs.map((item) => ({
      title: item.title,
      lastAccessed: item.lastAccessed,
    }))
  );
  // 需要移入分组的标签页 id
  const tabIds = tabs
    .sort((a, b) => a.lastAccessed - b.lastAccessed)
    .slice(0, index)
    .map((tab) => tab.id);
  console.log(
    "after",
    tabs
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .map((item) => ({
        title: item.title,
        lastAccessed: item.lastAccessed,
      }))
  );
  // 创建分组
  const newGroupId = await chrome.tabs.group({
    groupId,
    tabIds,
  });
  groupId = newGroupId;
  // 将分组移到首位
  await chrome.tabGroups.move(newGroupId, {
    index: 0,
  });
  // 更新分组的状态
  await chrome.tabGroups.update(newGroupId, {
    collapsed: true,
    color: "purple",
    title: "More",
  });
};

const handleTabsBelowThreshold = async () => {
  const groupTabs = await chrome.tabs.query({
    groupId,
  });
  const onlyOneTab = groupTabs.length === 1;
  const lastTabInGroup = groupTabs[groupTabs.length - 1];
  if (lastTabInGroup) {
    await chrome.tabs.ungroup(lastTabInGroup.id);
  }
  if (onlyOneTab) {
    groupId = undefined;
  }
  if (groupId) {
    await chrome.tabGroups.move(groupId, {
      index: 0,
    });
  }
};

const handleIncrease = async () => {
  const tabsInfo = await getTabsInfo();
  if (!tabsInfo) {
    return;
  }
  const { maxTabsCount, normalTabsCount, ungroupedTabs } = tabsInfo;

  if (normalTabsCount > maxTabsCount) {
    handleTabsOverThreshold(ungroupedTabs, normalTabsCount - maxTabsCount);
  }
};

const handleDecrease = async () => {
  const tabsInfo = await getTabsInfo();
  if (!tabsInfo) {
    return;
  }
  const { maxTabsCount, normalTabsCount } = tabsInfo;

  if (normalTabsCount < maxTabsCount && groupId) {
    handleTabsBelowThreshold();
  }
};

const init = async () => {
  const window = await chrome.windows.getCurrent();
  currentWindowId = window.id;

  const tabsInfo = await getTabsInfo();
  if (!tabsInfo) {
    return;
  }
  const { maxTabsCount, normalTabsCount, ungroupedTabs } = tabsInfo;

  if (normalTabsCount > maxTabsCount) {
    handleTabsOverThreshold(ungroupedTabs, normalTabsCount - maxTabsCount);
  } else if (normalTabsCount < maxTabsCount && groupId) {
    handleTabsBelowThreshold();
  }
};

init();

// 创建标签页时触发
chrome.tabs.onCreated.addListener(() => {
  handleIncrease();
});
// 在标签页关闭时触发。
chrome.tabs.onRemoved.addListener(() => {
  handleDecrease();
});
// TODO:
// 当标签页附加到窗口时触发；例如，由于标签页在窗口之间移动。
// chrome.tabs.onAttached.addListener(() => {
//   try {
//     handleIncrease();
//   } catch (err) {
//     console.log(err);
//   }
// });
// TODO:
// 当标签页与窗口分离时触发；例如，由于标签页在窗口之间移动。
// chrome.tabs.onDetached.addListener(async () => {
//   const tabs = await chrome.tabs.query({
//     windowId: currentWindowId,
//   });
//   const ungroupedTabs = tabs.filter((tab) => tab.groupId === -1 && !tab.pinned);
//   console.log(currentWindowId);
//   console.log(ungroupedTabs);
//   if (!ungroupedTabs.length) {
//     return;
//   }
//   const pageWidth = tabs[0].width;
//   const tabWidth = 230;
//   const maxTabsCount = Math.floor(pageWidth / tabWidth);
//   const normalTabsCount = ungroupedTabs.length;
//
//   if (normalTabsCount < maxTabsCount && groupId) {
//     const groupTabs = await chrome.tabs.query({
//       groupId,
//       windowId: currentWindowId,
//     });
//     console.log(groupId);
//     const onlyOneTab = groupTabs.length === 1;
//     const lastTabInGroup = groupTabs[groupTabs.length - 1];
//     lastTabInGroup && chrome.tabs.ungroup(lastTabInGroup.id);
//     if (onlyOneTab) {
//       groupId = undefined;
//     }
//   }
// });
// chrome.tabs.onMoved.addListener(() => {
//   console.log("moved");
// });
// 在窗口中的活动标签页发生变化时触发。
chrome.tabs.onActivated.addListener(async () => {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const [tab] = tabs;
  const isGroupedTab = tab && tab.groupId === groupId;
  if (isGroupedTab) {
    setTimeout(async () => {
      const tabsInfo = await getTabsInfo();
      if (!tabsInfo) {
        return;
      }
      const { ungroupedTabs } = tabsInfo;
      const firstAccessedTab = ungroupedTabs.sort(
        (a, b) => a.lastAccessed - b.lastAccessed
      )[0];

      if (firstAccessedTab) {
        await chrome.tabs.move([firstAccessedTab.id], {
          index: 0,
        });
        await chrome.tabs.group({
          groupId,
          tabIds: [firstAccessedTab.id],
        });
      }

      await chrome.tabs.ungroup(tab.id);

      await chrome.tabGroups.update(groupId, {
        collapsed: true,
        color: "purple",
        title: "More",
      });
    }, 100);
  }
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  currentWindowId = windowId;
});
chrome.tabGroups.onRemoved.addListener((tabGroup) => {
  const { id } = tabGroup;
  if (id === groupId) {
    groupId = undefined;
  }
});

// BUG:
// 取消分组，无法触发
// 附加或分离标签页，无法触发
// 新窗口增加 tab 会影响旧窗口
// 多窗口

// TODO:
// 收缩其他自定义组
