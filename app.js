const WAVE_MAP = {
  red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
  blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
  green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

const ROUND_SECONDS = 20;
const STARTING_BALANCE = 100000;
const STORAGE_KEY = "lucky49-predict-state";
const STORAGE_VERSION = 2;

const PLAY_OPTIONS = {
  size: [
    { value: "big", label: "买大", hint: "25 - 49", odds: 1.95 },
    { value: "small", label: "买小", hint: "1 - 24", odds: 1.95 }
  ],
  parity: [
    { value: "odd", label: "买单", hint: "奇数结果", odds: 1.95 },
    { value: "even", label: "买双", hint: "偶数结果", odds: 1.95 }
  ],
  wave: [
    { value: "red", label: "红波", hint: "红波号码", odds: 2.8 },
    { value: "blue", label: "蓝波", hint: "蓝波号码", odds: 2.8 },
    { value: "green", label: "绿波", hint: "绿波号码", odds: 2.8 }
  ]
};

const state = {
  balance: STARTING_BALANCE,
  pendingBets: [],
  history: [],
  round: 1,
  totalProfit: 0,
  selectedCategory: "size",
  selectedOption: "big",
  secondsLeft: ROUND_SECONDS,
  lastResult: null,
  timerId: null
};

const elements = {
  balanceDisplay: document.querySelector("#balanceDisplay"),
  betCountDisplay: document.querySelector("#betCountDisplay"),
  profitDisplay: document.querySelector("#profitDisplay"),
  roundDisplay: document.querySelector("#roundDisplay"),
  countdownDisplay: document.querySelector("#countdownDisplay"),
  timerBar: document.querySelector("#timerBar"),
  optionGrid: document.querySelector("#optionGrid"),
  categoryGroup: document.querySelector("#categoryGroup"),
  stakeInput: document.querySelector("#stakeInput"),
  ticketList: document.querySelector("#ticketList"),
  pendingStakeDisplay: document.querySelector("#pendingStakeDisplay"),
  resultNumber: document.querySelector("#resultNumber"),
  resultSize: document.querySelector("#resultSize"),
  resultParity: document.querySelector("#resultParity"),
  resultWave: document.querySelector("#resultWave"),
  resultMeta: document.querySelector("#resultMeta"),
  historyList: document.querySelector("#historyList"),
  noticePanel: document.querySelector("#noticePanel"),
  betForm: document.querySelector("#betForm")
};

function getWave(number) {
  return Object.keys(WAVE_MAP).find((wave) => WAVE_MAP[wave].includes(number)) || "red";
}

function getSize(number) {
  return number >= 25 ? "big" : "small";
}

function getParity(number) {
  return number % 2 === 0 ? "even" : "odd";
}

function formatCurrency(value) {
  return `¥${value.toLocaleString("zh-CN")}`;
}

function getCategoryLabel(category) {
  if (category === "size") return "大 / 小";
  if (category === "parity") return "单 / 双";
  return "波色";
}

function getOutcomeLabel(category, option) {
  const matched = PLAY_OPTIONS[category].find((item) => item.value === option);
  return matched ? matched.label : option;
}

function buildResult(number) {
  return {
    number,
    size: getSize(number),
    parity: getParity(number),
    wave: getWave(number)
  };
}

function saveState() {
  const snapshot = {
    version: STORAGE_VERSION,
    balance: state.balance,
    pendingBets: state.pendingBets,
    history: state.history,
    round: state.round,
    totalProfit: state.totalProfit,
    selectedCategory: state.selectedCategory,
    selectedOption: state.selectedOption,
    secondsLeft: state.secondsLeft,
    lastResult: state.lastResult
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function restoreState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    state.balance = parsed.balance ?? STARTING_BALANCE;
    state.pendingBets = parsed.pendingBets ?? [];
    state.history = parsed.history ?? [];
    state.round = parsed.round ?? 1;
    state.totalProfit = parsed.totalProfit ?? 0;
    state.selectedCategory = parsed.selectedCategory ?? "size";
    state.selectedOption = parsed.selectedOption ?? "big";
    state.secondsLeft = parsed.secondsLeft ?? ROUND_SECONDS;
    state.lastResult = parsed.lastResult ?? null;
  } catch (error) {
    console.warn("Failed to restore local state", error);
  }
}

function renderOptions() {
  elements.optionGrid.innerHTML = PLAY_OPTIONS[state.selectedCategory]
    .map((item) => {
      const active = item.value === state.selectedOption ? "active" : "";
      return `
        <button type="button" class="option-card ${active}" data-option="${item.value}">
          <strong>${item.label}</strong>
          <span>${item.hint} / ${item.odds}x</span>
        </button>
      `;
    })
    .join("");

  elements.optionGrid.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOption = button.dataset.option;
      renderAll();
      renderNotice("选项已更新", `当前将按“${getOutcomeLabel(state.selectedCategory, state.selectedOption)}”加入本期。`);
    });
  });
}

function renderCategoryButtons() {
  elements.categoryGroup.querySelectorAll("[data-group='category']").forEach((button) => {
    const active = button.dataset.value === state.selectedCategory;
    button.classList.toggle("active", active);
  });
}

function renderTickets() {
  if (state.pendingBets.length === 0) {
    elements.ticketList.innerHTML = '<div class="empty-state">本期还没有预测记录，选一个方向直接加入即可。</div>';
    return;
  }

  elements.ticketList.innerHTML = state.pendingBets
    .map((bet) => {
      return `
        <article class="ticket-item">
          <div class="ticket-top">
            <div>
              <strong>${getCategoryLabel(bet.category)} / ${bet.label}</strong>
              <div class="ticket-meta">${formatCurrency(bet.stake)} / 赔率 ${bet.odds}x</div>
            </div>
            <span class="pill">#${bet.id}</span>
          </div>
          <div class="ticket-outcome">
            <span class="mini-pill">第 ${bet.round} 期</span>
            <span class="mini-pill">${bet.label}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResult() {
  if (!state.lastResult) {
    elements.resultNumber.textContent = "--";
    elements.resultSize.textContent = "大小待定";
    elements.resultParity.textContent = "单双待定";
    elements.resultWave.textContent = "波色待定";
    elements.resultMeta.textContent = "等待首期开奖";
    return;
  }

  elements.resultNumber.textContent = String(state.lastResult.number).padStart(2, "0");
  elements.resultSize.textContent = state.lastResult.size === "big" ? "本期结果: 大" : "本期结果: 小";
  elements.resultParity.textContent = state.lastResult.parity === "odd" ? "本期结果: 单" : "本期结果: 双";
  elements.resultWave.textContent = `本期结果: ${getOutcomeLabel("wave", state.lastResult.wave)}`;
  elements.resultMeta.textContent = `第 ${state.lastResult.round} 期开奖结果已更新`;
}

function renderHistory() {
  if (state.history.length === 0) {
    elements.historyList.innerHTML = '<div class="empty-state">开奖记录会在自动开奖后显示。</div>';
    return;
  }

  elements.historyList.innerHTML = state.history
    .map((item) => {
      return `
        <article class="history-item">
          <div class="history-top">
            <strong>第 ${item.round} 期</strong>
            <div class="history-meta">${item.summary}</div>
          </div>
          <div class="history-balls">
            <span class="mini-pill">号码 ${String(item.result.number).padStart(2, "0")}</span>
            <span class="mini-pill">${item.result.size === "big" ? "大" : "小"}</span>
            <span class="mini-pill">${item.result.parity === "odd" ? "单" : "双"}</span>
            <span class="mini-pill">${getOutcomeLabel("wave", item.result.wave)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderStats() {
  const totalPending = state.pendingBets.reduce((sum, item) => sum + item.stake, 0);
  elements.balanceDisplay.textContent = formatCurrency(state.balance);
  elements.betCountDisplay.textContent = String(state.pendingBets.length);
  elements.profitDisplay.textContent = formatCurrency(state.totalProfit);
  elements.roundDisplay.textContent = String(state.round);
  elements.pendingStakeDisplay.textContent = `总投入 ${formatCurrency(totalPending)}`;
}

function renderTimer() {
  elements.countdownDisplay.textContent = `${state.secondsLeft}s`;
  const scale = Math.max(state.secondsLeft / ROUND_SECONDS, 0);
  elements.timerBar.style.transform = `scaleX(${scale})`;
  window.dispatchEvent(
    new CustomEvent("lucky49:timer", {
      detail: {
        secondsLeft: state.secondsLeft,
        progress: scale
      }
    })
  );
}

function renderNotice(title = "已开启自动模式", content = "页面会自动倒计时开奖，你只需要在开奖前加入本期预测。") {
  elements.noticePanel.innerHTML = `
    <span class="tag">系统消息</span>
    <h3>${title}</h3>
    <p>${content}</p>
  `;
}

function renderAll() {
  renderCategoryButtons();
  renderOptions();
  renderTickets();
  renderResult();
  renderHistory();
  renderStats();
  renderTimer();
  saveState();
  window.dispatchEvent(
    new CustomEvent("lucky49:state", {
      detail: {
        round: state.round,
        pendingCount: state.pendingBets.length,
        balance: state.balance,
        selectedCategory: state.selectedCategory,
        selectedOption: state.selectedOption,
        lastResult: state.lastResult
      }
    })
  );
}

function evaluateBet(bet, result) {
  const isWin = result[bet.category] === bet.option;
  return isWin ? Math.round(bet.stake * bet.odds) : 0;
}

function addBet(event) {
  event.preventDefault();

  const stake = Number(elements.stakeInput.value);
  if (!stake || stake < 100) {
    renderNotice("分值无效", "单次投入至少为 100 分。");
    return;
  }

  if (stake > state.balance) {
    renderNotice("积分不足", "当前积分不足以加入这一条预测。");
    return;
  }

  const config = PLAY_OPTIONS[state.selectedCategory].find((item) => item.value === state.selectedOption);
  state.balance -= stake;
  state.pendingBets.unshift({
    id: String(Date.now()).slice(-6),
    round: state.round,
    category: state.selectedCategory,
    option: state.selectedOption,
    label: config.label,
    odds: config.odds,
    stake
  });

  renderNotice("已加入本期", `已加入“${config.label}”预测，系统会在倒计时结束后自动结算。`);
  renderAll();
}

function autoDrawRound() {
  const number = Math.floor(Math.random() * 49) + 1;
  const result = buildResult(number);
  const totalStake = state.pendingBets.reduce((sum, item) => sum + item.stake, 0);

  let payout = 0;
  let winCount = 0;

  state.pendingBets.forEach((bet) => {
    const win = evaluateBet(bet, result);
    payout += win;
    if (win > 0) {
      winCount += 1;
    }
  });

  state.balance += payout;
  state.totalProfit += payout - totalStake;

  const completedRound = state.round;
  state.lastResult = {
    ...result,
    round: completedRound
  };

  state.history.unshift({
    round: completedRound,
    result,
    summary: `命中 ${winCount} 条，结算 ${formatCurrency(payout)}`
  });

  state.history = state.history.slice(0, 6);
  state.pendingBets = [];
  state.round += 1;
  state.secondsLeft = ROUND_SECONDS;

  renderNotice(
    "本期已自动开奖",
    `第 ${completedRound} 期号码为 ${String(number).padStart(2, "0")}，共命中 ${winCount} 条，已自动进入下一期。`
  );
  renderAll();
  window.dispatchEvent(
    new CustomEvent("lucky49:draw", {
      detail: {
        round: completedRound,
        result: state.lastResult,
        pendingResolved: winCount
      }
    })
  );
}

function startCountdown() {
  if (state.timerId) {
    clearInterval(state.timerId);
  }

  state.timerId = window.setInterval(() => {
    state.secondsLeft -= 1;

    if (state.secondsLeft <= 0) {
      autoDrawRound();
      return;
    }

    renderTimer();
    saveState();
  }, 1000);
}

elements.categoryGroup.querySelectorAll("[data-group='category']").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedCategory = button.dataset.value;
    state.selectedOption = PLAY_OPTIONS[state.selectedCategory][0].value;
    renderAll();
    renderNotice("玩法已切换", `当前面板已切换到“${getCategoryLabel(state.selectedCategory)}”模式。`);
  });
});

elements.betForm.addEventListener("submit", addBet);

restoreState();
renderAll();
startCountdown();
