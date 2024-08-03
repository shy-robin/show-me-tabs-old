let groupId;

const notify = (message) => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "./images/hi.png",
    title: "Show me tabs",
    message,
  });
};

const getTabsInCurrentWindow = async () => {
  const queryOptions = { currentWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  const tabs = await chrome.tabs.query(queryOptions);
  return tabs;
};

const getTabsInfo = async () => {
  const tabs = await getTabsInCurrentWindow();
  const ungroupedTabs = tabs.filter((tab) => tab.groupId === -1 && !tab.pinned);
  const pageWidth = tabs[0].width;
  const tabWidth = 230;
  const maxTabsCount = Math.floor(pageWidth / tabWidth);
  const normalTabsCount = ungroupedTabs.length;

  return {
    tabs,
    ungroupedTabs,
    maxTabsCount,
    normalTabsCount,
  };
};

const handleTabsOverThreshold = (ungroupedTabs, index) => {
  // FIXME: 如果用户已经创建分组怎么办？
  // 如果用户有多个分组怎么办？
  chrome.tabs.group(
    {
      groupId,
      tabIds: ungroupedTabs.slice(0, index).map((tab) => tab.id),
    },
    (id) => {
      groupId = id;
      chrome.tabGroups.update(id, {
        collapsed: true,
        color: "purple",
        title: "More",
      });
    }
  );
};

const handleTabsBelowThreshold = async () => {
  const groupTabs = await chrome.tabs.query({
    groupId,
  });
  const onlyOneTab = groupTabs.length === 1;
  const lastTabInGroup = groupTabs[groupTabs.length - 1];
  lastTabInGroup && chrome.tabs.ungroup(lastTabInGroup.id);
  if (onlyOneTab) {
    groupId = undefined;
  }
};

const handleIncrease = async () => {
  const { maxTabsCount, normalTabsCount, ungroupedTabs } = await getTabsInfo();

  notify(`Increase: ${normalTabsCount} / ${maxTabsCount}`);

  if (normalTabsCount > maxTabsCount) {
    handleTabsOverThreshold(ungroupedTabs, normalTabsCount - maxTabsCount);
  }
};

const handleDecrease = async () => {
  const { maxTabsCount, normalTabsCount } = await getTabsInfo();

  notify(`Decrease: ${normalTabsCount} / ${maxTabsCount}`);

  if (normalTabsCount < maxTabsCount && groupId) {
    handleTabsBelowThreshold();
  }
};

const init = async () => {
  const { maxTabsCount, normalTabsCount, ungroupedTabs } = await getTabsInfo();

  notify(`Init: ${normalTabsCount} / ${maxTabsCount}`);

  if (normalTabsCount > maxTabsCount) {
    handleTabsOverThreshold(ungroupedTabs, normalTabsCount - maxTabsCount);
  } else if (normalTabsCount < maxTabsCount && groupId) {
    handleTabsBelowThreshold();
  }
};

init();

// 当标签页附加到窗口时触发；例如，由于标签页在窗口之间移动。
chrome.tabs.onAttached.addListener(() => {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      // 标签页加载完成后,执行编辑操作
      handleIncrease();
    }
  });
});
// 当标签页与窗口分离时触发；例如，由于标签页在窗口之间移动。
chrome.tabs.onDetached.addListener(() => {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      // 标签页加载完成后,执行编辑操作
      handleDecrease();
    }
  });
});
// 创建标签页时触发
chrome.tabs.onCreated.addListener(() => {
  handleIncrease();
});
// 在标签页关闭时触发。
chrome.tabs.onRemoved.addListener(() => {
  handleDecrease();
});

// BUG:
// 取消分组，无法触发
// 附加或分离标签页，无法触发
